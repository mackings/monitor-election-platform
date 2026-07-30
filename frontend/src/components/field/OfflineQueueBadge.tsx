"use client";

import { useEffect, useState } from "react";
import { flushQueue, subscribeQueue, type QueuedSubmission } from "@/lib/offline/queue";
import { CloudOff } from "lucide-react";

export function OfflineQueueBadge() {
  const [queue, setQueue] = useState<QueuedSubmission[]>([]);

  useEffect(() => {
    flushQueue();
    return subscribeQueue(setQueue);
  }, []);

  if (queue.length === 0) return null;

  return (
    <div
      className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
      title="Saved on this device — will send automatically once you're back online"
    >
      <CloudOff className="h-3.5 w-3.5" />
      {queue.length} pending
    </div>
  );
}
