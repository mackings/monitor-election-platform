"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import type { DistanceCheck } from "@/lib/hooks/usePUDistance";
import { formatDistanceKm } from "@/lib/geo/distance";
import { Loader2, MapPin } from "lucide-react";

/** Below this, "6km away" reads as noise -- someone standing at their PU
 * doesn't need a precise number, just confirmation they're in the right
 * place. */
const AT_PU_THRESHOLD_KM = 0.15;

function DistanceLine({ distance, puName }: { distance: DistanceCheck; puName?: string }) {
  if (distance.loading) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Checking your location…
      </p>
    );
  }
  if (distance.km != null) {
    const atPU = distance.km < AT_PU_THRESHOLD_KM;
    return (
      <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
        <MapPin className="h-3.5 w-3.5 text-indigo-500" />
        {atPU
          ? `You're right at${puName ? ` ${puName}` : " your polling unit"}`
          : `You are ${formatDistanceKm(distance.km)} away${puName ? ` from ${puName}` : ""}`}
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
      <MapPin className="h-3.5 w-3.5" />
      {distance.approximate
        ? "Couldn't get your exact location — you can still continue."
        : (distance.error ?? "Couldn't check your location.")}
    </p>
  );
}

interface DistanceConfirmCardProps {
  question: string;
  distance: DistanceCheck;
  puName?: string;
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
  primaryLoading?: boolean;
}

/** One step of a guided field-app flow: a question, a live "how far are
 * you from your PU" readout, and a confirm/cancel pair -- shared by the
 * arrival/departure flow and every status-update flow so agents get the
 * same deliberate, hard-to-fat-finger confirmation everywhere. Fetches
 * a fresh location the moment it mounts. */
export function DistanceConfirmCard({
  question,
  distance,
  puName,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  primaryLoading = false,
}: DistanceConfirmCardProps) {
  useEffect(() => {
    distance.check();
    // Only on mount -- this step exists for exactly one confirmation, a
    // fresh read every re-render would just spam the geolocation API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="font-heading text-base font-bold text-slate-900 dark:text-white">{question}</p>
      <DistanceLine distance={distance} puName={puName} />
      <div className="space-y-2">
        <Button
          size="lg"
          className="h-10 w-full rounded-xl bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-500"
          onClick={onPrimary}
          disabled={primaryLoading}
        >
          {primaryLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {primaryLabel}
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-10 w-full rounded-xl text-sm font-semibold"
          onClick={onSecondary}
          disabled={primaryLoading}
        >
          {secondaryLabel}
        </Button>
      </div>
    </div>
  );
}
