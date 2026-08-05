"use client";

import { useEffect, useState } from "react";
import { subscribeQueue, subscribeSyncing, mediaCountOf, flushQueue, type QueuedSubmission } from "@/lib/offline/queue";
import { formatDistanceToNow } from "date-fns";
import { CloudOff, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

/** Persistent, page-level view of whatever this page has queued while
 * offline -- reads straight from IndexedDB via subscribeQueue, so unlike
 * the uploader components' own item lists (which are just in-memory React
 * state and vanish on navigation/refresh), this survives leaving the page
 * and coming back. Filtered by `kind` so the report page only shows queued
 * incidents and the results page only shows queued result sheets. */
export function PendingSubmissionsList({ kind }: { kind: "incident" | "result" }) {
  const [queue, setQueue] = useState<QueuedSubmission[]>([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const unsubQueue = subscribeQueue(setQueue);
    const unsubSyncing = subscribeSyncing(setSyncing);
    return () => {
      unsubQueue();
      unsubSyncing();
    };
  }, []);

  const items = queue.filter((i) => i.kind === kind);
  if (items.length === 0) return null;

  // A manual fallback alongside the automatic online-event/30s-poll
  // triggers -- those can miss a real reconnection on some mobile
  // browsers/networks, so this gives the agent a way to just push it
  // themselves instead of waiting and wondering whether it's stuck.
  async function handleSyncNow() {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("Still offline — connect to the internet and try again.");
      return;
    }
    await flushQueue();
  }

  return (
    <div className="mb-4 space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-500/20 dark:bg-amber-500/5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
          {syncing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Syncing {items.length} saved on this device…
            </>
          ) : (
            <>
              <CloudOff className="h-3.5 w-3.5" />
              {items.length} saved on this device
            </>
          )}
        </div>
        <button
          type="button"
          onClick={handleSyncNow}
          disabled={syncing}
          className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-200 disabled:cursor-wait disabled:opacity-60 dark:bg-amber-500/20 dark:text-amber-300 dark:hover:bg-amber-500/30"
        >
          <RefreshCw className={syncing ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      </div>
      {!syncing && (
        <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
          Will send automatically once you&apos;re online, or tap Sync now to try immediately.
        </p>
      )}
      <ul className="space-y-1.5">
        {items.map((item) => {
          const count = mediaCountOf(item);
          return (
            <li key={item.id} className="rounded-lg bg-white px-3 py-2 text-xs shadow-sm dark:bg-slate-900">
              {item.kind === "incident" ? (
                <>
                  <p className="font-medium">{item.input.type || "Incident report"}</p>
                  {item.input.description && (
                    <p className="truncate text-muted-foreground">{item.input.description}</p>
                  )}
                </>
              ) : (
                <p className="font-medium">
                  Result sheet · {item.input.total_accredited_voters.toLocaleString()} accredited voters
                </p>
              )}
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Saved {formatDistanceToNow(item.createdAt, { addSuffix: true })}
                {count > 0 && ` · ${count} attachment${count > 1 ? "s" : ""}`}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
