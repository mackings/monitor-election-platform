"use client";

import { useEffect, useState } from "react";
import { subscribeQueue, subscribeSyncing, mediaCountOf, flushQueue, type QueuedSubmission } from "@/lib/offline/queue";
import { PU_STATUS_LABEL } from "@/components/map/statusColors";
import { formatDistanceToNow } from "date-fns";
import { CloudOff, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

function labelFor(item: QueuedSubmission): { title: string; danger?: boolean } {
  switch (item.kind) {
    case "incident":
      return { title: item.input.type || "Incident report" };
    case "result":
      return { title: `Result sheet · ${item.input.total_accredited_voters.toLocaleString()} accredited voters` };
    case "checkin":
      return { title: "Check-in" };
    case "checkout":
      return { title: "Check-out" };
    case "status":
      return { title: `Status update · ${PU_STATUS_LABEL[item.input.status]}` };
    case "distress":
      return { title: "Distress alert", danger: true };
  }
}

/** Persistent, page-level view of whatever this page has queued while
 * offline -- reads straight from IndexedDB via subscribeQueue, so unlike
 * a form's own item lists (which are just in-memory React state and
 * vanish on navigation/refresh), this survives leaving the page and
 * coming back. Filtered by `kinds` so each page only shows what it cares
 * about (the report page shows queued incidents, the home page shows
 * check-ins/status/distress, etc). */
export function PendingSubmissionsList({ kinds }: { kinds: QueuedSubmission["kind"][] }) {
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

  const items = queue.filter((i) => kinds.includes(i.kind));
  if (items.length === 0) return null;

  // A manual fallback alongside the automatic online-event/30s-poll
  // triggers -- those can miss a real reconnection on some mobile
  // browsers/networks, so this gives the agent a way to just push it
  // themselves instead of waiting and wondering whether it's stuck.
  async function handleSyncNow() {
    // Logged unconditionally, before anything else -- if this line
    // never shows up in the console when the button is tapped, the
    // click itself isn't reaching React (a hit-area/overlay problem),
    // not a bug in what happens after.
    console.debug("[offline-queue] Sync now tapped");
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("Still offline — connect to the internet and try again.");
      return;
    }
    toast.info("Syncing…");
    await flushQueue();
  }

  const hasDistress = items.some((i) => i.kind === "distress");

  return (
    <div
      className={
        hasDistress
          ? "mb-4 space-y-2 rounded-xl border border-red-200 bg-red-50/60 p-3 dark:border-red-500/30 dark:bg-red-500/5"
          : "mb-4 space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-500/20 dark:bg-amber-500/5"
      }
    >
      <div className="flex items-center justify-between gap-2">
        <div
          className={
            hasDistress
              ? "flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400"
              : "flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400"
          }
        >
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
          // min-h-9 (36px) rather than letting text-xs padding alone
          // decide the tap target -- comfortably above the ~24px this
          // was rendering at before, which is small enough on a real
          // touchscreen (as opposed to a mouse cursor) to plausibly
          // explain taps missing it outright.
          className={
            hasDistress
              ? "flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-red-100 px-3.5 py-2 text-xs font-medium text-red-700 transition-colors hover:bg-red-200 active:bg-red-300 disabled:cursor-wait disabled:opacity-60 dark:bg-red-500/20 dark:text-red-300 dark:hover:bg-red-500/30"
              : "flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-amber-100 px-3.5 py-2 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-200 active:bg-amber-300 disabled:cursor-wait disabled:opacity-60 dark:bg-amber-500/20 dark:text-amber-300 dark:hover:bg-amber-500/30"
          }
        >
          <RefreshCw className={syncing ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      </div>
      {!syncing && (
        <p
          className={
            hasDistress ? "text-[11px] text-red-700/80 dark:text-red-400/80" : "text-[11px] text-amber-700/80 dark:text-amber-400/80"
          }
        >
          {hasDistress
            ? "A distress alert hasn't reached supervisors yet — it'll send the instant you're back online. If you need help now, contact your supervisor directly."
            : "Will send automatically once you're online, or tap Sync now to try immediately."}
        </p>
      )}
      <ul className="space-y-1.5">
        {items.map((item) => {
          const count = mediaCountOf(item);
          const { title, danger } = labelFor(item);
          return (
            <li key={item.id} className="rounded-lg bg-white px-3 py-2 text-xs shadow-sm dark:bg-slate-900">
              <p className={danger ? "font-medium text-red-600 dark:text-red-400" : "font-medium"}>{title}</p>
              {item.kind === "incident" && item.input.description && (
                <p className="truncate text-muted-foreground">{item.input.description}</p>
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
