"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useMapStore } from "@/lib/store/useMapStore";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useGeolocation } from "@/lib/hooks/useGeolocation";
import { haversineKm } from "@/lib/geo/distance";
import { StatTile } from "@/components/dashboard/StatTile";
import { LiveActivityFeed } from "@/components/dashboard/LiveActivityFeed";
import { AgentStatusPanel } from "@/components/dashboard/AgentStatusPanel";
import { PUSearchBar } from "@/components/dashboard/PUSearchBar";
import { PUDetailSheet } from "@/components/dashboard/PUDetailSheet";
import { Button } from "@/components/ui/button";
import { MapPin, Users, Vote, AlertTriangle, Radio, LocateFixed, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import type { PollingUnit } from "@/types";
import type { FocusTarget } from "@/components/map/OyoMap";

const MAX_SEARCH_RESULTS = 8;
const NEAR_ME_COUNT = 20;

function matchesQuery(pu: PollingUnit, query: string): boolean {
  return (
    pu.pu_name.toLowerCase().includes(query) ||
    pu.ward.toLowerCase().includes(query) ||
    pu.lga.toLowerCase().includes(query) ||
    pu.pu_code.toLowerCase().includes(query) ||
    (pu.yardcode ?? "").toLowerCase().includes(query)
  );
}

const OyoMap = dynamic(() => import("@/components/map/OyoMap").then((m) => m.OyoMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});

export default function DashboardOverviewPage() {
  const pollingUnitsMap = useMapStore((s) => s.pollingUnits);
  const officersMap = useMapStore((s) => s.officers);
  const pollingUnits = useMemo(() => Object.values(pollingUnitsMap), [pollingUnitsMap]);
  const officers = useMemo(() => Object.values(officersMap), [officersMap]);
  const [selected, setSelected] = useState<PollingUnit | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const [userLocation, setUserLocation] = useState<FocusTarget | null>(null);
  const { locate, loading: locating } = useGeolocation();

  // Debounced so the expensive filter (scanning ~3,400+ records) and the
  // map re-styling it triggers only run once typing pauses, not on every
  // keystroke — that per-keystroke cost was what made the input feel like
  // it was freezing.
  const debouncedQuery = useDebouncedValue(searchQuery, 200);

  const searchMatches = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return [];
    return pollingUnits.filter((pu) => matchesQuery(pu, q));
  }, [pollingUnits, debouncedQuery]);

  const isSearching = debouncedQuery.trim().length > 0;

  const nearMeMatches = useMemo(() => {
    if (!userLocation || isSearching) return [];
    return [...pollingUnits]
      .sort(
        (a, b) =>
          haversineKm(userLocation.lat, userLocation.lng, a.lat, a.lng) -
          haversineKm(userLocation.lat, userLocation.lng, b.lat, b.lng),
      )
      .slice(0, NEAR_ME_COUNT);
  }, [pollingUnits, userLocation, isSearching]);

  const nearMeActive = nearMeMatches.length > 0;

  const highlightCodes = useMemo(() => {
    if (isSearching) return new Set(searchMatches.map((pu) => pu.pu_code));
    if (nearMeActive) return new Set(nearMeMatches.map((pu) => pu.pu_code));
    return null;
  }, [isSearching, searchMatches, nearMeActive, nearMeMatches]);

  function handleSearchSelect(pu: PollingUnit) {
    setSelected(pu);
    setFocusTarget({ lat: pu.lat, lng: pu.lng });
  }

  async function handleLocateMe() {
    try {
      const { lat, lng } = await locate({ enableHighAccuracy: false, timeoutMs: 15000 });
      setUserLocation({ lat, lng });
      setFocusTarget({ lat, lng });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't get your location.");
    }
  }

  const stats = useMemo(() => {
    const votingInProgress = pollingUnits.filter((pu) => pu.current_status === "voting").length;
    const incidents = pollingUnits.filter((pu) => pu.current_status === "incident").length;
    const distress = pollingUnits.filter((pu) => pu.current_status === "distress").length;
    const activeAgents = officers.filter((o) => o.status === "active").length;
    return { votingInProgress, incidents, distress, activeAgents };
  }, [pollingUnits, officers]);

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Oyo State — Election Day Monitor</h1>
          <p className="text-sm text-muted-foreground">
            Real-time overview of polling unit activity and agent status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PUSearchBar
            query={searchQuery}
            onQueryChange={setSearchQuery}
            results={searchMatches.slice(0, MAX_SEARCH_RESULTS)}
            totalMatches={searchMatches.length}
            onSelect={handleSearchSelect}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 rounded-xl"
            onClick={handleLocateMe}
            disabled={locating}
            title="Find polling units near my current location"
          >
            {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
            {locating ? "Locating…" : "Near me"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="Polling units" value={pollingUnits.length} icon={MapPin} />
        <StatTile label="Agents deployed" value={officers.length} icon={Users} />
        <StatTile label="Active agents" value={stats.activeAgents} icon={Users} tone="success" />
        <StatTile label="Voting in progress" value={stats.votingInProgress} icon={Vote} />
        <StatTile
          label="Incidents / distress"
          value={stats.incidents + stats.distress}
          icon={stats.distress > 0 ? Radio : AlertTriangle}
          tone={stats.distress > 0 ? "danger" : stats.incidents > 0 ? "warning" : "default"}
        />
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[1fr_320px]">
        <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          {isSearching && (
            <div className="absolute top-3 left-1/2 z-[1000] -translate-x-1/2 rounded-full bg-slate-900/90 px-3 py-1 text-xs font-medium text-white shadow dark:bg-slate-100/90 dark:text-slate-900">
              Showing {searchMatches.length} match{searchMatches.length === 1 ? "" : "es"} for &quot;{searchQuery}&quot;
            </div>
          )}
          {!isSearching && nearMeActive && (
            <div className="absolute top-3 left-1/2 z-[1000] flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900/90 px-3 py-1 text-xs font-medium text-white shadow dark:bg-slate-100/90 dark:text-slate-900">
              Showing {nearMeMatches.length} polling units near your location
              <button
                type="button"
                aria-label="Clear location"
                onClick={() => setUserLocation(null)}
                className="rounded-full p-0.5 hover:bg-white/20 dark:hover:bg-slate-900/10"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <OyoMap
            pollingUnits={pollingUnits}
            highlightCodes={highlightCodes}
            onSelect={setSelected}
            selectedCode={selected?.pu_code}
            focusTarget={focusTarget}
          />
        </div>
        <div className="grid grid-rows-2 gap-4 overflow-hidden">
          <LiveActivityFeed />
          <AgentStatusPanel />
        </div>
      </div>

      <PUDetailSheet pu={selected ?? null} onOpenChange={(open) => !open && setSelected(undefined)} />
    </div>
  );
}
