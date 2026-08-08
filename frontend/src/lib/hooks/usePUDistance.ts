"use client";

import { useCallback, useState } from "react";
import { useResolvedLocation, type ResolvedLocation } from "./useResolvedLocation";
import { haversineKm } from "@/lib/geo/distance";
import type { PollingUnit } from "@/types";

export interface DistanceCheck {
  location: ResolvedLocation | null;
  /** Straight-line distance to the PU, in km. Null while unresolved, or
   * when the location itself is only approximate (the PU's own
   * coordinates used as a GPS fallback) -- distance-from-itself would
   * always read as 0, which would be a lie, not a fallback. */
  km: number | null;
  loading: boolean;
  error: string | null;
  approximate: boolean;
  check: () => Promise<void>;
}

/** Resolves the officer's current location and how far that puts them
 * from their assigned PU -- backs every guided confirm step in the field
 * app's arrival/departure and status-update flows, so an agent sees
 * "you're 6km away" before confirming something that's supposed to be
 * happening where they're standing. Re-resolves fresh every time `check`
 * is called rather than caching, since the whole point is a live read at
 * the moment of confirming. */
export function usePUDistance(pu: PollingUnit | null): DistanceCheck {
  const { resolve } = useResolvedLocation();
  const [location, setLocation] = useState<ResolvedLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loc = await resolve(pu ?? undefined);
      setLocation(loc);
    } catch (err) {
      setLocation(null);
      setError(err instanceof Error ? err.message : "Couldn't get your location.");
    } finally {
      setLoading(false);
    }
  }, [resolve, pu]);

  const km =
    location && !location.approximate && pu ? haversineKm(location.lat, location.lng, pu.lat, pu.lng) : null;

  return { location, km, loading, error, approximate: location?.approximate ?? false, check };
}
