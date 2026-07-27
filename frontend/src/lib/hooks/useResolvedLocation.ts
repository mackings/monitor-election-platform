"use client";

import { useCallback } from "react";
import { useGeolocation } from "./useGeolocation";
import { getPollingUnit } from "@/lib/api/pollingUnits";

export interface ResolvedLocation {
  lat: number;
  lng: number;
  /** True when this came from the PU's registered coordinates rather
   * than the device's own GPS. */
  approximate: boolean;
}

/** Resolves a location for tagging check-ins/incidents/distress alerts.
 * Tries the device's real GPS first; if that fails (permission denied,
 * no fix, insecure origin...) falls back to the assigned polling unit's
 * known coordinates instead of blocking the action outright — an officer
 * standing at their PU with a flaky GPS should still be able to report.
 * The original geolocation error is preserved and rethrown if there's no
 * PU to fall back to, or the PU lookup itself fails. */
export function useResolvedLocation() {
  const { locate } = useGeolocation();

  const resolve = useCallback(
    async (puCode?: string): Promise<ResolvedLocation> => {
      try {
        const { lat, lng } = await locate();
        return { lat, lng, approximate: false };
      } catch (geoErr) {
        if (!puCode) throw geoErr;
        try {
          const pu = await getPollingUnit(puCode);
          return { lat: pu.lat, lng: pu.lng, approximate: true };
        } catch {
          throw geoErr;
        }
      }
    },
    [locate],
  );

  return { resolve };
}
