"use client";

import { useEffect, useRef } from "react";
import { useGeolocation } from "./useGeolocation";
import { updateOfficerLocation } from "@/lib/api/officers";

export const PING_INTERVAL_MS = 25000;

/** Periodically reports the officer's live location while checked in, so
 * the admin map/roster can show real-time position and motion instead of
 * only the one-shot location captured at check-in time. Best-effort: a
 * missed fix (denied permission, momentary GPS loss) is silently skipped
 * rather than surfaced, since this runs continuously in the background
 * and shouldn't interrupt the officer with a toast every 25 seconds. */
export function useLocationPing(active: boolean) {
  const { locate } = useGeolocation();
  const inFlight = useRef(false);

  useEffect(() => {
    if (!active) return;

    async function ping() {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const { lat, lng } = await locate({ enableHighAccuracy: true, timeoutMs: 20000 });
        await updateOfficerLocation(lat, lng);
      } catch {
        // best-effort; next interval tick will just try again
      } finally {
        inFlight.current = false;
      }
    }

    ping();
    const id = setInterval(ping, PING_INTERVAL_MS);
    return () => clearInterval(id);
  }, [active, locate]);
}
