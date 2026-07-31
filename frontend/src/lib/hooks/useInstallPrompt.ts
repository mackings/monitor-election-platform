"use client";

import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari's own flag -- there's no `display-mode` media query
    // support there pre-installation.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** Wraps the browser's install prompt. Chrome/Edge (desktop and Android)
 * fire `beforeinstallprompt`, which we capture so it can be triggered on
 * demand from a "Download App" button instead of the browser's own
 * unprompted mini-infobar. iOS Safari never fires this event at all --
 * there's no programmatic install API there, only the user's own Share ->
 * Add to Home Screen -- so `canInstall` stays false there and callers
 * should show instructions instead (see `isIOS`). */
export function useInstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredEvent(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferredEvent(null);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    await deferredEvent.userChoice;
    setDeferredEvent(null);
  }, [deferredEvent]);

  const isIOS = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

  return { canInstall: !!deferredEvent && !installed, installed, promptInstall, isIOS };
}
