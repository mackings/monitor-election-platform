import { create } from "zustand";

interface SessionState {
  /** True once an authenticated request has come back 401 -- the token
   * itself (not a single request's business logic) is no longer valid.
   * Read outside React by client.ts (a plain module, not a component),
   * which is why this lives in its own tiny store rather than on
   * useAuthStore. */
  expired: boolean;
  markExpired: () => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  expired: false,
  markExpired: () => set({ expired: true }),
  clear: () => set({ expired: false }),
}));
