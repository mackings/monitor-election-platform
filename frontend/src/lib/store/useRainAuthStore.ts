import { create } from "zustand";
import type { RainLeaderUser, RainMe } from "@/types/rain";

const TOKEN_KEY = "rain_leader_token";
const USER_KEY = "rain_leader_user";

interface RainAuthState {
  token: string | null;
  user: RainLeaderUser | null;
  me: RainMe | null;
  hydrated: boolean;
  setSession: (token: string, user: RainLeaderUser) => void;
  setMe: (me: RainMe) => void;
  logout: () => void;
  hydrate: () => void;
}

// A separate session from the agent's own Monitor login (useAuthStore) --
// this is RAIN's own phone+password auth for community leaders, a
// different persona entirely, so it gets its own token/storage key
// rather than being layered onto the existing auth store.
export const useRainAuthStore = create<RainAuthState>((set) => ({
  token: null,
  user: null,
  me: null,
  hydrated: false,
  setSession: (token, user) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
    set({ token, user });
  },
  setMe: (me) => set({ me }),
  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    set({ token: null, user: null, me: null });
  },
  hydrate: () => {
    if (typeof window === "undefined") {
      set({ hydrated: true });
      return;
    }
    const token = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(USER_KEY);
    set({ token, user: raw ? (JSON.parse(raw) as RainLeaderUser) : null, hydrated: true });
  },
}));
