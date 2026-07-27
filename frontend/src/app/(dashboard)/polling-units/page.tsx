"use client";

import { useMemo, useState } from "react";
import { useMapStore } from "@/lib/store/useMapStore";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useGeolocation } from "@/lib/hooks/useGeolocation";
import { distinctLGAs, distinctWards } from "@/lib/pollingUnits/filterOptions";
import { haversineKm } from "@/lib/geo/distance";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination } from "@/components/dashboard/Pagination";
import { PUDetailSheet } from "@/components/dashboard/PUDetailSheet";
import { PU_STATUS_COLOR, PU_STATUS_LABEL } from "@/components/map/statusColors";
import { Search, X, LocateFixed, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { PollingUnit, PUStatus } from "@/types";

const PAGE_SIZE = 50;

function matchesQuery(pu: PollingUnit, query: string): boolean {
  return (
    pu.pu_name.toLowerCase().includes(query) ||
    pu.ward.toLowerCase().includes(query) ||
    pu.lga.toLowerCase().includes(query) ||
    pu.pu_code.toLowerCase().includes(query) ||
    (pu.yardcode ?? "").toLowerCase().includes(query)
  );
}

export default function PollingUnitsPage() {
  const pollingUnitsMap = useMapStore((s) => s.pollingUnits);
  const officersMap = useMapStore((s) => s.officers);
  const pollingUnits = useMemo(() => Object.values(pollingUnitsMap), [pollingUnitsMap]);

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 200);
  const [lga, setLga] = useState("all");
  const [ward, setWard] = useState("all");
  const [status, setStatus] = useState<PUStatus | "all">("all");
  const [assignment, setAssignment] = useState<"all" | "assigned" | "unassigned">("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<PollingUnit | undefined>();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const { locate, loading: locating } = useGeolocation();

  const lgaOptions = useMemo(() => distinctLGAs(pollingUnits), [pollingUnits]);
  const wardOptions = useMemo(
    () => distinctWards(pollingUnits, lga === "all" ? undefined : lga),
    [pollingUnits, lga],
  );

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    return pollingUnits.filter((pu) => {
      if (lga !== "all" && pu.lga !== lga) return false;
      if (ward !== "all" && pu.ward !== ward) return false;
      if (status !== "all" && pu.current_status !== status) return false;
      if (assignment === "assigned" && !pu.assigned_officer_id) return false;
      if (assignment === "unassigned" && pu.assigned_officer_id) return false;
      if (q && !matchesQuery(pu, q)) return false;
      return true;
    });
  }, [pollingUnits, lga, ward, status, assignment, debouncedQuery]);

  // Sorted by proximity (nearest first) instead of the default order once
  // the admin has located themselves — other filters (LGA/ward/status/
  // search) still apply on top, this only changes the ordering.
  const sorted = useMemo(() => {
    if (!userLocation) return filtered;
    return [...filtered].sort(
      (a, b) =>
        haversineKm(userLocation.lat, userLocation.lng, a.lat, a.lng) -
        haversineKm(userLocation.lat, userLocation.lng, b.lat, b.lng),
    );
  }, [filtered, userLocation]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const filtersActive =
    lga !== "all" || ward !== "all" || status !== "all" || assignment !== "all" || debouncedQuery.trim() !== "";

  function clearFilters() {
    setLga("all");
    setWard("all");
    setStatus("all");
    setAssignment("all");
    setQuery("");
    setPage(1);
  }

  function updateAndResetPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  async function handleLocateMe() {
    try {
      const { lat, lng } = await locate({ enableHighAccuracy: false, timeoutMs: 15000 });
      setUserLocation({ lat, lng });
      setPage(1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't get your location.");
    }
  }

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Polling Units</h1>
        <p className="text-sm text-muted-foreground">
          {filtersActive ? `${filtered.length} of ${pollingUnits.length} polling units` : `${pollingUnits.length} polling units`}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => updateAndResetPage(setQuery)(e.target.value)}
            placeholder="Search name, ward, LGA, code, yardcode…"
            className="rounded-xl pl-9 pr-9"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => updateAndResetPage(setQuery)("")}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-xl"
          onClick={handleLocateMe}
          disabled={locating}
          title="Find polling units near my current location"
        >
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
          {locating ? "Locating…" : "Near me"}
        </Button>

        {userLocation && (
          <div className="flex items-center gap-1.5 rounded-full bg-indigo-50 py-1 pr-2 pl-3 text-xs font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
            Sorted by distance from your location
            <button
              type="button"
              aria-label="Clear location"
              onClick={() => setUserLocation(null)}
              className="rounded-full p-0.5 hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        <Select
          value={lga}
          onValueChange={(v) => {
            updateAndResetPage(setLga)(v ?? "all");
            setWard("all");
          }}
        >
          <SelectTrigger className="w-44 rounded-xl">
            <SelectValue placeholder="All LGAs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All LGAs</SelectItem>
            {lgaOptions.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={ward} onValueChange={(v) => updateAndResetPage(setWard)(v ?? "all")}>
          <SelectTrigger className="w-44 rounded-xl">
            <SelectValue placeholder="All wards" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All wards</SelectItem>
            {wardOptions.map((w) => (
              <SelectItem key={w} value={w}>
                {w}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={(v) => updateAndResetPage(setStatus)((v as PUStatus | "all") ?? "all")}>
          <SelectTrigger className="w-44 rounded-xl">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="not_open">Not yet open</SelectItem>
            <SelectItem value="voting">Voting in progress</SelectItem>
            <SelectItem value="incident">Incident reported</SelectItem>
            <SelectItem value="distress">Agent in distress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="no_report">No report</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={assignment}
          onValueChange={(v) => updateAndResetPage(setAssignment)((v as typeof assignment) ?? "all")}
        >
          <SelectTrigger className="w-36 rounded-xl">
            <SelectValue placeholder="Assignment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any agent</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
          </SelectContent>
        </Select>

        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      <Card className="rounded-2xl border-slate-200/70 dark:border-slate-800">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Polling unit</TableHead>
                <TableHead>Ward</TableHead>
                <TableHead>LGA</TableHead>
                <TableHead>Yardcode</TableHead>
                <TableHead>Assigned agent</TableHead>
                <TableHead>Status</TableHead>
                {userLocation && <TableHead>Distance</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((pu) => {
                const officer = pu.assigned_officer_id ? officersMap[pu.assigned_officer_id] : undefined;
                const distanceKm = userLocation
                  ? haversineKm(userLocation.lat, userLocation.lng, pu.lat, pu.lng)
                  : null;
                return (
                  <TableRow
                    key={pu.pu_code}
                    className="cursor-pointer"
                    onClick={() => setSelected(pu)}
                  >
                    <TableCell>
                      <p className="font-medium">{pu.pu_name}</p>
                      <p className="text-xs text-muted-foreground">{pu.pu_code}</p>
                    </TableCell>
                    <TableCell>{pu.ward}</TableCell>
                    <TableCell>{pu.lga}</TableCell>
                    <TableCell className="font-mono text-xs">{pu.yardcode ?? "—"}</TableCell>
                    <TableCell>{officer?.name ?? "Unassigned"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        style={{
                          backgroundColor: `${PU_STATUS_COLOR[pu.current_status]}20`,
                          color: PU_STATUS_COLOR[pu.current_status],
                        }}
                      >
                        {PU_STATUS_LABEL[pu.current_status]}
                      </Badge>
                    </TableCell>
                    {userLocation && distanceKm !== null && (
                      <TableCell className="text-xs text-muted-foreground">
                        {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {pageItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={userLocation ? 7 : 6} className="py-10 text-center text-sm text-muted-foreground">
                    No polling units match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} />
        </CardContent>
      </Card>

      <PUDetailSheet pu={selected ?? null} onOpenChange={(open) => !open && setSelected(undefined)} />
    </div>
  );
}
