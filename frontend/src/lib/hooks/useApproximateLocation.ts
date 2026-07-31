"use client";

import { useCallback, useState } from "react";
import { useGeolocation } from "./useGeolocation";
import { getIPLocation } from "@/lib/api/geo";

/** For desktop "near me" filters where GPS-level precision was never the
 * point -- sorting/filtering polling units by rough proximity. Tries the
 * browser's own geolocation first (fast, no round trip); if the OS/browser
 * won't hand over a location at all (Location Services off, a corporate
 * network blocking it, permission revoked...) falls back to an IP-based
 * approximate location from the backend instead of failing the whole
 * feature. City-level accurate at best -- never use this for the field
 * app's check-in/incident/proof-of-location flows, which need the real
 * device fix or nothing. */
export function useApproximateLocation() {
  const { locate: locateDevice } = useGeolocation();
  const [loading, setLoading] = useState(false);

  const locate = useCallback(
    async (options?: { timeoutMs?: number }): Promise<{ lat: number; lng: number; approximate: boolean }> => {
      setLoading(true);
      try {
        try {
          const { lat, lng } = await locateDevice({
            enableHighAccuracy: false,
            timeoutMs: options?.timeoutMs ?? 15000,
          });
          return { lat, lng, approximate: false };
        } catch {
          const { lat, lng } = await getIPLocation();
          return { lat, lng, approximate: true };
        }
      } finally {
        setLoading(false);
      }
    },
    [locateDevice],
  );

  return { locate, loading };
}
