"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Pagination } from "@/components/dashboard/Pagination";
import { PUDetailSheet } from "@/components/dashboard/PUDetailSheet";
import { PU_STATUS_COLOR, PU_STATUS_LABEL } from "@/components/map/statusColors";
import { Search, X, LocateFixed, Loader2, ListFilter, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import type { PollingUnit, PUStatus } from "@/types";

const PAGE_SIZE = 50;

const STATUS_OPTIONS: PUStatus[] = ["not_open", "voting", "incident", "distress", "completed", "no_report"];

// Distress/incident first regardless of alphabetical order -- these are
// what an admin sorting "by priority" actually wants surfaced.
const STATUS_PRIORITY: Record<PUStatus, number> = {
  distress: 0,
  incident: 1,
  voting: 2,
  not_open: 3,
  no_report: 4,
  completed: 5,
};

const SORT_OPTIONS = [
  { value: "name", label: "Name (A–Z)" },
  { value: "priority", label: "Status priority" },
] as const;
type SortOption = (typeof SORT_OPTIONS)[number]["value"];

function matchesQuery(pu: PollingUnit, query: string): boolean {
  return (
    pu.pu_name.toLowerCase().includes(query) ||
    pu.ward.toLowerCase().includes(query) ||
    pu.lga.toLowerCase().includes(query) ||
    pu.pu_code.toLowerCase().includes(query) ||
    (pu.yardcode ?? "").toLowerCase().includes(query)
  );
}

/** Reads/writes filter state to the URL query string (via the raw History
 * API, not Next's router -- this is purely for shareable/bookmarkable
 * filtered views, not real navigation, so it shouldn't trigger Next's
 * data-fetching/rerender machinery or need a Suspense boundary). */
function readParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(key);
}

export default function PollingUnitsPage() {
  const pollingUnitsMap = useMapStore((s) => s.pollingUnits);
  const officersMap = useMapStore((s) => s.officers);
  const pollingUnits = useMemo(() => Object.values(pollingUnitsMap), [pollingUnitsMap]);

  const [query, setQuery] = useState(() => readParam("q") ?? "");
  const debouncedQuery = useDebouncedValue(query, 200);
  const [lga, setLga] = useState(() => readParam("lga") ?? "all");
  const [ward, setWard] = useState(() => readParam("ward") ?? "all");
  const [statuses, setStatuses] = useState<Set<PUStatus>>(() => {
    const raw = readParam("status");
    return raw ? new Set(raw.split(",") as PUStatus[]) : new Set();
  });
  const [assignment, setAssignment] = useState<"all" | "assigned" | "unassigned">(
    () => (readParam("assignment") as "assigned" | "unassigned" | null) ?? "all",
  );
  const [sort, setSort] = useState<SortOption>(() => (readParam("sort") as SortOption | null) ?? "name");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<PollingUnit | undefined>();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const { locate, loading: locating } = useGeolocation();

  // Keeps the URL in sync so the current filter set can be copied/
  // bookmarked/shared with another admin and reopened exactly as left.
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
    if (lga !== "all") params.set("lga", lga);
    if (ward !== "all") params.set("ward", ward);
    if (statuses.size > 0) params.set("status", Array.from(statuses).join(","));
    if (assignment !== "all") params.set("assignment", assignment);
    if (sort !== "name") params.set("sort", sort);
    const qs = params.toString();
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [debouncedQuery, lga, ward, statuses, assignment, sort]);

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
      if (statuses.size > 0 && !statuses.has(pu.current_status)) return false;
      if (assignment === "assigned" && !pu.assigned_officer_id) return false;
      if (assignment === "unassigned" && pu.assigned_officer_id) return false;
      if (q && !matchesQuery(pu, q)) return false;
      return true;
    });
  }, [pollingUnits, lga, ward, statuses, assignment, debouncedQuery]);

  // Sorted by proximity (nearest first) once the admin has located
  // themselves -- that takes priority over the Name/Status sort picker,
  // matching the existing "near me" behavior. Otherwise sorts by the
  // selected sort option.
  const sorted = useMemo(() => {
    if (userLocation) {
      return [...filtered].sort(
        (a, b) =>
          haversineKm(userLocation.lat, userLocation.lng, a.lat, a.lng) -
          haversineKm(userLocation.lat, userLocation.lng, b.lat, b.lng),
      );
    }
    if (sort === "priority") {
      return [...filtered].sort((a, b) => STATUS_PRIORITY[a.current_status] - STATUS_PRIORITY[b.current_status]);
    }
    return [...filtered].sort((a, b) => a.pu_name.localeCompare(b.pu_name));
  }, [filtered, userLocation, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const filtersActive =
    lga !== "all" || ward !== "all" || statuses.size > 0 || assignment !== "all" || debouncedQuery.trim() !== "";

  function clearFilters() {
    setLga("all");
    setWard("all");
    setStatuses(new Set());
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

  function toggleStatus(status: PUStatus, checked: boolean) {
    setStatuses((prev) => {
      const next = new Set(prev);
      if (checked) next.add(status);
      else next.delete(status);
      return next;
    });
    setPage(1);
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

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" />
            }
          >
            <ListFilter className="h-4 w-4" />
            Status{statuses.size > 0 ? ` (${statuses.size})` : ""}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {STATUS_OPTIONS.map((s) => (
              <DropdownMenuCheckboxItem
                key={s}
                checked={statuses.has(s)}
                onCheckedChange={(checked) => toggleStatus(s, checked)}
              >
                {PU_STATUS_LABEL[s]}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

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

        {!userLocation && (
          <Select value={sort} onValueChange={(v) => setSort((v as SortOption) ?? "name")}>
            <SelectTrigger className="w-44 rounded-xl">
              <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

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
