import { create } from "zustand";
import { clearToken, getToken, setToken } from "@/lib/api/client";
import { useSessionStore } from "@/lib/store/useSessionStore";
import type { OfficerStatus, User } from "@/types";

interface AuthState {
  user: User | null;
  token: string | null;
  hydrated: boolean;
  setSession: (token: string, user: User) => void;
  updateLocalStatus: (status: OfficerStatus) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  hydrated: false,
  setSession: (token, user) => {
    setToken(token);
    if (typeof window !== "undefined") {
      localStorage.setItem("monitor_user", JSON.stringify(user));
    }
    set({ token, user });
  },
  updateLocalStatus: (status) => {
    const { user } = get();
    if (!user) return;
    const updated = { ...user, status };
    if (typeof window !== "undefined") {
      localStorage.setItem("monitor_user", JSON.stringify(updated));
    }
    set({ user: updated });
  },
  logout: () => {
    clearToken();
    if (typeof window !== "undefined") localStorage.removeItem("monitor_user");
    set({ token: null, user: null });
    // Every logout path (the header button, or re-authenticating from the
    // session-expired dialog) should leave a clean slate -- otherwise the
    // next login would immediately re-trigger that dialog on stale state.
    useSessionStore.getState().clear();
  },
  hydrate: () => {
    const token = getToken();
    if (!token) {
      set({ hydrated: true });
      return;
    }
    const raw = typeof window !== "undefined" ? localStorage.getItem("monitor_user") : null;
    set({ token, user: raw ? (JSON.parse(raw) as User) : null, hydrated: true });
  },
}));
