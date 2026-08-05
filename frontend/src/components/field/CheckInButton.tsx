"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useResolvedLocation } from "@/lib/hooks/useResolvedLocation";
import { checkIn, checkOut } from "@/lib/api/officers";
import { queueCheckIn, queueCheckOut } from "@/lib/offline/queue";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { useAssignedPU } from "@/components/field/AssignedPUContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { MapPin, LogOut } from "lucide-react";

export function CheckInButton() {
  const { resolve } = useResolvedLocation();
  const assignedPU = useAssignedPU();
  const user = useAuthStore((s) => s.user);
  const updateLocalStatus = useAuthStore((s) => s.updateLocalStatus);
  const [submitting, setSubmitting] = useState(false);

  const isActive = user?.status === "active";

  async function handleClick() {
    setSubmitting(true);
    if (isActive) {
      try {
        await checkOut();
        updateLocalStatus("offline");
        toast.success("Checked out");
      } catch (err) {
        if (err instanceof ApiError) {
          toast.error("Couldn't check out — the server rejected it. Try again.");
        } else {
          await queueCheckOut();
          updateLocalStatus("offline");
          toast.info("No connection — checkout saved and will send automatically once you're back online.");
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }

    let lat: number, lng: number, approximate: boolean;
    try {
      ({ lat, lng, approximate } = await resolve(assignedPU));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't get your location.");
      setSubmitting(false);
      return;
    }
    if (approximate) {
      toast.info("Couldn't get your device's GPS — using your assigned polling unit's location instead.");
    }
    try {
      await checkIn(lat, lng);
      updateLocalStatus("active");
      toast.success("Checked in — your location has been shared");
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error("Couldn't check in — the server rejected it. Try again.");
      } else {
        await queueCheckIn(lat, lng);
        updateLocalStatus("active");
        toast.info("No connection — check-in saved and will send automatically once you're back online.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Button
      size="lg"
      className={cn(
        "h-10 w-full gap-2 rounded-xl text-sm font-semibold shadow-sm",
        isActive
          ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          : "bg-indigo-600 text-white hover:bg-indigo-500",
      )}
      variant={isActive ? "outline" : "default"}
      disabled={submitting}
      onClick={handleClick}
    >
      {isActive ? <LogOut className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
      {submitting ? "Working…" : isActive ? "Check out" : "Check in at my PU"}
    </Button>
  );
}
