import { create } from "zustand";

interface CollationState {
  /** Bumped on every live "result.submitted" WS event. The Collation page
   * depends on this in its fetch effect so a new submission anywhere
   * (app, SMS-logged, or an offline queue flush) refetches the current
   * view automatically -- real-time without polling. */
  resultsVersion: number;
  bumpResultsVersion: () => void;
}

export const useCollationStore = create<CollationState>((set) => ({
  resultsVersion: 0,
  bumpResultsVersion: () => set((s) => ({ resultsVersion: s.resultsVersion + 1 })),
}));
