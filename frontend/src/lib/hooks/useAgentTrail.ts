"use client";

import { useState } from "react";
import { haversineKm } from "@/lib/geo/distance";
import type { Location } from "@/types";

/** A consumer GPS fix drifts by 5-20m even standing still -- anything
 * smaller than this between two consecutive pings is jitter, not motion. */
const MOVEMENT_THRESHOLD_METERS = 25;

/** Cap on accumulated points -- at the ~25s ping interval (see
 * PING_INTERVAL_MS) this covers roughly the last 50 minutes, plenty for a
 * live-viewing session without the array growing unbounded if a sheet is
 * left open for hours. */
const MAX_TRAIL_POINTS = 120;

export interface TrailPoint extends Location {
  at: number;
}

export interface AgentTrail {
  /** Every distinct position received this viewing session, oldest first.
   * Empty until the first ping arrives -- there is no server-side history
   * to seed from (see officer.Usecase.UpdateLocation's rationale for not
   * persisting GPS breadcrumbs), so this always starts fresh. */
  points: TrailPoint[];
  /** true/false once at least two points exist; null while there's only
   * one point and not enough data yet to call it either way. */
  moving: boolean | null;
  /** Timestamp (ms) the officer arrived at their current stable spot --
   * i.e. the oldest point in the run of points that are all within
   * MOVEMENT_THRESHOLD_METERS of the latest one. Null while moving, or
   * while there isn't enough data yet. */
  stationarySinceMs: number | null;
}

function metersBetween(a: Location, b: Location): number {
  return haversineKm(a.lat, a.lng, b.lat, b.lng) * 1000;
}

interface TrailState {
  officerId: string;
  points: TrailPoint[];
}

/** Accumulates an officer's live position pings into a trail for as long
 * as the caller stays mounted, and derives whether they're currently
 * moving or have settled somewhere. Resets whenever officerId changes, so
 * switching between agents in a list never mixes one officer's trail into
 * another's.
 *
 * Updates state directly during render (React's documented pattern for
 * deriving state from a changed prop -- see "Storing information from
 * previous renders") rather than in a useEffect, since appending here is
 * conceptually a render-time adjustment keyed off officerId/lastSeenAt
 * changing, not a subscription to an external system. */
export function useAgentTrail(officerId: string, location?: Location, lastSeenAt?: string): AgentTrail {
  const [state, setState] = useState<TrailState>({ officerId, points: [] });

  let points = state.points;
  if (state.officerId !== officerId) {
    points = [];
    setState({ officerId, points });
  } else if (location && lastSeenAt) {
    const at = new Date(lastSeenAt).getTime();
    const last = points[points.length - 1];
    // Same ping delivered twice (e.g. a store update that didn't actually
    // change lastSeenAt) -- nothing new to record.
    if (Number.isFinite(at) && (!last || last.at !== at)) {
      const next = [...points, { lat: location.lat, lng: location.lng, at }];
      points = next.length > MAX_TRAIL_POINTS ? next.slice(next.length - MAX_TRAIL_POINTS) : next;
      setState({ officerId, points });
    }
  }

  if (points.length < 2) {
    return { points, moving: null, stationarySinceMs: null };
  }

  const latest = points[points.length - 1];
  const prev = points[points.length - 2];
  const moving = metersBetween(prev, latest) > MOVEMENT_THRESHOLD_METERS;

  let stationarySinceMs: number | null = null;
  if (!moving) {
    let i = points.length - 1;
    while (i > 0 && metersBetween(points[i - 1], latest) <= MOVEMENT_THRESHOLD_METERS) i--;
    stationarySinceMs = points[i].at;
  }

  return { points, moving, stationarySinceMs };
}
