"use client";

import { useState } from "react";
import { useInstallPrompt } from "@/lib/hooks/useInstallPrompt";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

const DISMISS_KEY = "monitor_install_banner_dismissed";

/** A nudge to install the field app to the home screen -- full-screen, no
 * browser chrome, works offline. Renders nothing once already installed,
 * dismissed for this session, or on a browser that can neither prompt for
 * install (Chrome/Edge/Android) nor be pointed at manual steps (iOS
 * Safari, which has no programmatic install API at all). */
export function InstallAppBanner() {
  const { canInstall, installed, promptInstall, isIOS } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1",
  );
  const [showIOSSteps, setShowIOSSteps] = useState(false);

  if (installed || dismissed || (!canInstall && !isIOS)) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  function handlePrimaryClick() {
    if (isIOS) {
      if (showIOSSteps) dismiss();
      else setShowIOSSteps(true);
    } else {
      promptInstall();
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/10">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
        <Download className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Install this app</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {isIOS && showIOSSteps
            ? "Tap the Share icon in Safari, then “Add to Home Screen.”"
            : "Add it to your home screen for faster access and offline support."}
        </p>
        <div className="mt-2 flex items-center gap-3">
          <Button
            type="button"
            size="sm"
            className="rounded-lg bg-indigo-600 text-white hover:bg-indigo-500"
            onClick={handlePrimaryClick}
          >
            {isIOS && showIOSSteps ? "Got it" : "Download App"}
          </Button>
          <button type="button" onClick={dismiss} className="text-xs text-muted-foreground hover:text-foreground">
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
