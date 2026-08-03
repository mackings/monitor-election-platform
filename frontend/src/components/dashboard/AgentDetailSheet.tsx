"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EditOfficerDialog } from "@/components/dashboard/EditOfficerDialog";
import { haversineKm, formatDistanceKm } from "@/lib/geo/distance";
import { reverseGeocode } from "@/lib/api/geo";
import { deleteOfficer } from "@/lib/api/officers";
import { PING_INTERVAL_MS } from "@/lib/hooks/useLocationPing";
import { useNowTick } from "@/lib/hooks/useNowTick";
import type { PollingUnit, User } from "@/types";
import { Phone, MapPin, Loader2, Pencil, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const AgentLocationMiniMap = dynamic(
  () => import("./AgentLocationMiniMap").then((m) => m.AgentLocationMiniMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-56 w-full items-center justify-center rounded-lg bg-slate-50 text-sm text-muted-foreground dark:bg-slate-900">
        Loading map…
      </div>
    ),
  },
);

// An agent counts as "moving now" if their last location ping landed
// within this window; older than that just shows as a stale last-known
// position instead of implying they're still there.
const MOTION_WINDOW_MS = PING_INTERVAL_MS * 3;

const STATUS_VARIANT: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  offline: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  distress: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

interface AgentDetailSheetProps {
  officer: User | null;
  assignedPU?: PollingUnit;
  onOpenChange: (open: boolean) => void;
  /** Refetches the officer list -- called after a successful edit or
   * delete, matching the same pattern CreateOfficerDialog's onCreated
   * already uses rather than this component owning any store mutation
   * logic itself. */
  onChanged?: () => void;
}

/** Resolves the agent's last known lat/lng to a human-readable place name.
 * Rounded to ~11m precision so ordinary GPS jitter between pings doesn't
 * trigger a fresh lookup every 25 seconds -- only a real, meaningful move
 * does. Best-effort: a failed lookup just leaves the name blank, the
 * distance/coordinates already convey the essential information. */
function usePlaceName(lat?: number, lng?: number) {
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const key = lat != null && lng != null ? `${lat.toFixed(4)},${lng.toFixed(4)}` : null;
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!key || key === lastKey.current) return;
    lastKey.current = key;
    setLoading(true);
    setName(null);
    const [roundedLat, roundedLng] = key.split(",").map(Number);
    reverseGeocode(roundedLat, roundedLng)
      .then((res) => setName(res.name))
      .catch(() => setName(null))
      .finally(() => setLoading(false));
  }, [key]);

  return { name, loading };
}

export function AgentDetailSheet({ officer, assignedPU, onOpenChange, onChanged }: AgentDetailSheetProps) {
  const now = useNowTick(15000);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!officer) return;
    setDeleting(true);
    try {
      await deleteOfficer(officer.id);
      toast.success("Agent removed");
      setConfirmDeleteOpen(false);
      onChanged?.();
      onOpenChange(false);
    } catch {
      toast.error("Couldn't remove this agent. Try again.");
    } finally {
      setDeleting(false);
    }
  }

  const lastSeenMs = officer?.last_seen_at ? new Date(officer.last_seen_at).getTime() : 0;
  const moving =
    !!officer && officer.status !== "offline" && !!officer.last_location && now - lastSeenMs < MOTION_WINDOW_MS;
  const distanceKm =
    officer?.last_location && assignedPU
      ? haversineKm(officer.last_location.lat, officer.last_location.lng, assignedPU.lat, assignedPU.lng)
      : null;
  const { name: placeName, loading: placeLoading } = usePlaceName(
    officer?.last_location?.lat,
    officer?.last_location?.lng,
  );

  return (
    <Sheet open={!!officer} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        {officer && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3 pr-8">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="bg-slate-100 font-semibold dark:bg-slate-800">
                    {initials(officer.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="truncate">{officer.name}</SheetTitle>
                  <SheetDescription className="truncate">{officer.username}</SheetDescription>
                </div>
                <Badge variant="secondary" className={`shrink-0 ${STATUS_VARIANT[officer.status]}`}>
                  {officer.status}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  aria-label="Edit agent"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                  aria-label="Remove agent"
                  onClick={() => setConfirmDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </SheetHeader>

            <div className="space-y-4 p-4">
              <Button
                className="w-full gap-2 bg-indigo-600 text-white hover:bg-indigo-500"
                nativeButton={false}
                render={<a href={`tel:${officer.phone}`} />}
              >
                <Phone className="h-4 w-4" />
                Call {officer.phone}
              </Button>

              <div className="space-y-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>Location</span>
                </div>
                {officer.last_location ? (
                  <>
                    <AgentLocationMiniMap
                      agent={officer.last_location}
                      pu={assignedPU ? { lat: assignedPU.lat, lng: assignedPU.lng } : undefined}
                    />
                    <p className="flex items-start gap-1.5">
                      {placeLoading && <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
                      <span>
                        {placeName ?? (placeLoading ? "Resolving location name…" : "Location name unavailable")}
                      </span>
                    </p>
                    <p>
                      {distanceKm != null
                        ? `${formatDistanceKm(distanceKm)} from ${assignedPU?.pu_name ?? "assigned PU"}`
                        : "Distance to assigned PU unavailable"}
                    </p>
                    {moving && (
                      <p className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                        </span>
                        Moving now
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Last updated{" "}
                      {formatDistanceToNow(new Date(officer.last_seen_at!), { addSuffix: true })}
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">No location reported yet.</p>
                )}
              </div>

              <div className="text-sm">
                <p className="text-muted-foreground">Assigned polling unit</p>
                <p className="font-medium">
                  {assignedPU?.pu_name ?? officer.assigned_pu_code ?? "Unassigned"}
                </p>
              </div>
            </div>
          </>
        )}
      </SheetContent>

      <EditOfficerDialog
        officer={officer}
        open={editOpen}
        onOpenChange={setEditOpen}
        onUpdated={() => onChanged?.()}
      />

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {officer?.name}?</DialogTitle>
            <DialogDescription>
              This permanently deletes their account and unassigns them from their polling unit. Incidents and
              results they already submitted stay on record. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Removing…" : "Remove agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
