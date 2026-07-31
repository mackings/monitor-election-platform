"use client";

import { useCallback } from "react";
import { useGeolocation } from "./useGeolocation";
import type { PollingUnit } from "@/types";

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
 * The fallback PU comes from the caller (AssignedPUContext, already
 * resolved once and cached) rather than a fresh API lookup here -- a
 * network fetch would defeat the point for exactly the case that matters
 * most: no GPS fix AND no connection at the same moment. The original
 * geolocation error is preserved and rethrown if there's no PU to fall
 * back to. */
export function useResolvedLocation() {
  const { locate } = useGeolocation();

  const resolve = useCallback(
    async (fallbackPU?: PollingUnit | null): Promise<ResolvedLocation> => {
      try {
        const { lat, lng } = await locate();
        return { lat, lng, approximate: false };
      } catch (geoErr) {
        if (!fallbackPU) throw geoErr;
        return { lat: fallbackPU.lat, lng: fallbackPU.lng, approximate: true };
      }
    },
    [locate],
  );

  return { resolve };
}
