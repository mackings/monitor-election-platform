"use client";

import { useCallback, useState } from "react";

const STORAGE_KEY = "community_identity";

export interface CommunityIdentity {
  full_name: string;
  phone: string;
}

/** Caches the name/phone a field agent enters once for RSVPs and WhatsApp
 * group joins, so they don't retype it on every subsequent one -- exactly
 * what the API docs suggest ("cache on the device after the first
 * capture"). Stored in localStorage since this identity has nothing to do
 * with the agent's own Monitor login. */
export function useCommunityIdentity() {
  const [identity, setIdentityState] = useState<CommunityIdentity | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CommunityIdentity) : null;
    } catch {
      return null;
    }
  });

  const setIdentity = useCallback((next: CommunityIdentity) => {
    setIdentityState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // best-effort; a failed write just means it'll ask again next time
    }
  }, []);

  return { identity, setIdentity };
}
