"use client";

import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { listPollingUnits } from "@/lib/api/pollingUnits";
import { selfAssignPU } from "@/lib/api/officers";
import { ApiError } from "@/lib/api/client";
import { useGeolocation } from "@/lib/hooks/useGeolocation";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { haversineKm, formatDistanceKm } from "@/lib/geo/distance";
import { normalizeSearch } from "@/lib/search/normalizeSearch";
import type { PollingUnit } from "@/types";
import { Search, Loader2, LocateFixed } from "lucide-react";
import { toast } from "sonner";

const NEARBY_LIMIT = 20;
const SEARCH_LIMIT = 50;

interface Row {
  pu: PollingUnit;
  km?: number;
}

/** Forces a field officer who has no polling unit yet to pick one before
 * they can use the rest of the app -- the counterpart to Quick Assign,
 * which deliberately creates accounts with no PU so admins don't have to
 * hand-assign each one. Mounted once in FieldShell so it's guaranteed to
 * be present (and correctly gated on the real, hydrated user) on every
 * field route. */
export function PickPollingUnitSheet() {
  const user = useAuthStore((s) => s.user);
  const updateAssignedPU = useAuthStore((s) => s.updateAssignedPU);
  const { locate } = useGeolocation();

  const open = user?.role === "field_officer" && !user.assigned_pu_code;

  const [pus, setPUs] = useState<PollingUnit[] | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  // "pending" until the one geolocation attempt this sheet makes settles
  // (success or failure) -- `locating` below is derived from this rather
  // than a separate flag flipped synchronously inside the effect.
  const [locateState, setLocateState] = useState<"pending" | "done">("pending");
  const [query, setQuery] = useState("");
  const [assigningCode, setAssigningCode] = useState<string | null>(null);

  useEffect(() => {
    if (!open || pus !== null) return;
    listPollingUnits()
      .then(setPUs)
      .catch(() => setPUs([]));
  }, [open, pus]);

  useEffect(() => {
    if (!open || locateState !== "pending") return;
    let cancelled = false;
    locate({ enableHighAccuracy: true, timeoutMs: 15000 })
      .then((c) => {
        if (!cancelled) setCoords(c);
      })
      .catch(() => {
        // Best-effort -- search-by-name/code/ward/LGA still works without it.
      })
      .finally(() => {
        if (!cancelled) setLocateState("done");
      });
    return () => {
      cancelled = true;
    };
    // Only re-run on open/locateState, not on every `locate` identity
    // change (a fresh function reference from useGeolocation on every
    // render, per that hook's own useCallback deps).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, locateState]);

  const locating = open && locateState === "pending";

  const unassigned = useMemo(() => (pus ?? []).filter((pu) => !pu.assigned_officer_id), [pus]);

  const nearby = useMemo((): Row[] => {
    if (!coords) return [];
    return unassigned
      .map((pu) => ({ pu, km: haversineKm(coords.lat, coords.lng, pu.lat, pu.lng) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, NEARBY_LIMIT);
  }, [unassigned, coords]);

  const searchResults = useMemo((): Row[] => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    // Name/ward/LGA are hyphenated inconsistently in the source data
    // ("OKE-ADO" vs "Oke Ado") -- matched on a hyphen-insensitive
    // normalized query so it doesn't matter which way someone types it.
    const nq = normalizeSearch(query);
    return unassigned
      .filter(
        (pu) =>
          normalizeSearch(pu.pu_name).includes(nq) ||
          pu.pu_code.toLowerCase().includes(q) ||
          normalizeSearch(pu.ward).includes(nq) ||
          normalizeSearch(pu.lga).includes(nq),
      )
      .slice(0, SEARCH_LIMIT)
      .map((pu) => ({ pu }));
  }, [unassigned, query]);

  const showing = query.trim() ? searchResults : nearby;

  async function handlePick(pu: PollingUnit) {
    setAssigningCode(pu.pu_code);
    try {
      await selfAssignPU(pu.pu_code);
      updateAssignedPU(pu.pu_code);
      toast.success(`You're now assigned to ${pu.pu_name}.`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error("Someone else just picked that polling unit — choose another.");
        // Drop it from the local list rather than a full refetch -- the
        // conflict itself already tells us everything we need to know.
        setPUs((prev) => (prev ? prev.filter((p) => p.pu_code !== pu.pu_code) : prev));
      } else {
        toast.error("Couldn't assign you to this polling unit. Try again.");
      }
    } finally {
      setAssigningCode(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={() => {}} disablePointerDismissal>
      <SheetContent side="bottom" showCloseButton={false} className="flex max-h-[85vh] flex-col">
        <SheetHeader>
          <SheetTitle>Pick your polling unit</SheetTitle>
          <SheetDescription>
            You&apos;re not assigned to a polling unit yet. Choose the one you&apos;re reporting from to continue —
            once picked, it&apos;s yours unless your admin reassigns it.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 pb-4">
          <div className="relative shrink-0">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, code, ward or LGA…"
              className="pl-8"
            />
          </div>

          {!query.trim() && (
            <p className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
              {locating ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Finding polling units near you…
                </>
              ) : coords ? (
                <>
                  <LocateFixed className="h-3 w-3" />
                  Nearest unassigned polling units
                </>
              ) : (
                "Couldn't get your location — search by name, code, ward or LGA instead."
              )}
            </p>
          )}

          <div className="flex-1 space-y-1.5 overflow-y-auto">
            {pus === null && (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading polling units…
              </div>
            )}
            {pus !== null && showing.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {query.trim()
                  ? "No matching unassigned polling units."
                  : "No nearby unassigned polling units found."}
              </p>
            )}
            {showing.map(({ pu, km }) => (
              <button
                key={pu.pu_code}
                type="button"
                onClick={() => handlePick(pu)}
                disabled={assigningCode !== null}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-left text-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 disabled:opacity-60 dark:border-slate-800 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{pu.pu_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {pu.ward}, {pu.lga}
                    {km == null ? ` · ${pu.pu_code}` : ""}
                  </p>
                </div>
                {assigningCode === pu.pu_code ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-500" />
                ) : km != null ? (
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDistanceKm(km)}</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
