"use client";

import { useEffect, useState } from "react";

/** Delays reflecting `value` until it's stopped changing for `delayMs`.
 * Used to keep an input feeling instant while deferring expensive
 * derived work (filtering thousands of records, restyling map markers)
 * until the user pauses typing. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
