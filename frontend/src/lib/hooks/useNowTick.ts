"use client";

import { useEffect, useState } from "react";

/** Ticks every intervalMs so components deriving "how long ago" state
 * (e.g. whether an agent's last location ping is still recent enough to
 * count as "moving") re-render periodically even when no new data has
 * arrived to trigger it naturally. */
export function useNowTick(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
