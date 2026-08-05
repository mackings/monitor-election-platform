"use client";

import { useEffect, useState } from "react";
import { flushQueue, subscribeQueue, subscribeSyncing, type QueuedSubmission } from "@/lib/offline/queue";
import { CloudOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function OfflineQueueBadge() {
  const [queue, setQueue] = useState<QueuedSubmission[]>([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    flushQueue();
    const unsubQueue = subscribeQueue(setQueue);
    const unsubSyncing = subscribeSyncing(setSyncing);
    return () => {
      unsubQueue();
      unsubSyncing();
    };
  }, []);

  if (queue.length === 0) return null;

  // A manual fallback alongside the automatic online-event/30s-poll
  // triggers -- those can miss a real reconnection on some mobile
  // browsers/networks, so this gives the agent a way to just push it
  // themselves instead of waiting and wondering.
  async function handleSyncNow() {
    console.debug("[offline-queue] header badge tapped");
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("Still offline — connect to the internet and try again.");
      return;
    }
    toast.info("Syncing…");
    await flushQueue();
  }

  return (
    <button
      type="button"
      onClick={handleSyncNow}
      disabled={syncing}
      title={
        syncing
          ? "Syncing…"
          : "Saved on this device — tap to try sending now, or it'll send automatically once you're online"
      }
      className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-amber-100 px-3.5 py-2 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-200 active:bg-amber-300 disabled:cursor-wait dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/25"
    >
      {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudOff className="h-3.5 w-3.5" />}
      {syncing ? "Syncing…" : `${queue.length} pending`}
    </button>
  );
}
