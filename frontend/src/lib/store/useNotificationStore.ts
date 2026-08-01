import { create } from "zustand";

export type NotificationSection = "incidents" | "collation" | "activity";

const KEY_PREFIX = "monitor_last_seen_";

function readLastSeen(section: NotificationSection): number {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(KEY_PREFIX + section)) || 0;
}

interface NotificationState {
  /** Epoch ms an admin last opened each section, persisted across
   * sessions -- the sidebar bubble compares this against each store's
   * own live data (incidents/feed timestamps, collation's live counter)
   * rather than this store tracking counts itself. */
  lastSeen: Record<NotificationSection, number>;
  markSeen: (section: NotificationSection) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  lastSeen: {
    incidents: readLastSeen("incidents"),
    collation: readLastSeen("collation"),
    activity: readLastSeen("activity"),
  },
  markSeen: (section) => {
    const now = Date.now();
    if (typeof window !== "undefined") localStorage.setItem(KEY_PREFIX + section, String(now));
    set((s) => ({ lastSeen: { ...s.lastSeen, [section]: now } }));
  },
}));
