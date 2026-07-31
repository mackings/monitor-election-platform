"use client";

import { useEffect, useRef } from "react";

/** Re-runs `refetch` when the tab/window regains focus after being away,
 * throttled so quick tab-switching doesn't spam the API. Shell-level data
 * (polling units, officers, the assigned PU) is otherwise only ever
 * fetched once at mount -- if a laptop sleeps or a phone backgrounds the
 * tab for a few hours, the WebSocket that would normally keep it current
 * quietly dies too, and nothing tells the app to catch up. This is what
 * makes "left it open, came back hours later" look identical to "the app
 * is broken" even when the session itself is still valid. */
export function useRefetchOnForeground(refetch: () => void, minIntervalMs = 30_000) {
  const lastRun = useRef(0);
  const refetchRef = useRef(refetch);

  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  useEffect(() => {
    lastRun.current = Date.now();
    function trigger() {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRun.current < minIntervalMs) return;
      lastRun.current = now;
      refetchRef.current();
    }
    document.addEventListener("visibilitychange", trigger);
    window.addEventListener("focus", trigger);
    return () => {
      document.removeEventListener("visibilitychange", trigger);
      window.removeEventListener("focus", trigger);
    };
  }, [minIntervalMs]);
}
