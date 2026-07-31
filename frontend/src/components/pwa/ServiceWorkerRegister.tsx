"use client";

import { useEffect } from "react";

/** Registers the runtime-caching service worker app-wide. Silently a
 * no-op on browsers without support -- nothing here is load-bearing for
 * the app to function, it only improves install-ability and offline
 * resilience where available. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
