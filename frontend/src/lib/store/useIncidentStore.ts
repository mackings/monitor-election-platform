import { create } from "zustand";
import type { Incident } from "@/types";

const MAX_FEED = 100;

interface FeedItem {
  id: string;
  label: string;
  detail: string;
  at: string;
  kind: "incident" | "distress" | "status" | "result" | "officer";
}

interface IncidentState {
  incidents: Incident[];
  feed: FeedItem[];
  setIncidents: (incidents: Incident[]) => void;
  addIncident: (incident: Incident) => void;
  pushFeedItem: (item: FeedItem) => void;
  /** Hydrates from persisted history (GET /activity). Merges rather than
   * replaces — a live event can arrive over WS before this REST call
   * resolves, and it shouldn't get clobbered. */
  hydrateFeed: (items: FeedItem[]) => void;
}

function sortByRecency(items: FeedItem[]): FeedItem[] {
  return [...items].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export const useIncidentStore = create<IncidentState>((set) => ({
  incidents: [],
  feed: [],
  setIncidents: (incidents) => set({ incidents: incidents ?? [] }),
  addIncident: (incident) =>
    set((state) => {
      if (state.incidents.some((i) => i.id === incident.id)) return state;
      return { incidents: [incident, ...state.incidents].slice(0, MAX_FEED) };
    }),
  pushFeedItem: (item) =>
    set((state) => {
      if (state.feed.some((f) => f.id === item.id)) return state;
      return { feed: sortByRecency([item, ...state.feed]).slice(0, MAX_FEED) };
    }),
  hydrateFeed: (items) =>
    set((state) => {
      const existingIds = new Set(state.feed.map((f) => f.id));
      const merged = [...state.feed, ...items.filter((i) => !existingIds.has(i.id))];
      return { feed: sortByRecency(merged).slice(0, MAX_FEED) };
    }),
}));

export type { FeedItem };
