"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useGeolocation } from "@/lib/hooks/useGeolocation";
import { nearestPollingUnits, nearestLeaders, directionsUrl } from "@/lib/api/rain";
import { formatDistanceKm } from "@/lib/geo/distance";
import { LeaderDetailSheet } from "@/components/field/community/LeaderDetailSheet";
import type { NearestPUResponse, CommunityLeader } from "@/types/rain";
import { toast } from "sonner";
import { MapPin, Users, LocateFixed, Loader2, Navigation, ChevronRight } from "lucide-react";

export default function CommunityPage() {
  const { locate } = useGeolocation();
  const [puResult, setPuResult] = useState<NearestPUResponse | null>(null);
  const [puLoading, setPuLoading] = useState(false);
  const [leaders, setLeaders] = useState<CommunityLeader[] | null>(null);
  const [leadersLoading, setLeadersLoading] = useState(false);
  const [selectedLeader, setSelectedLeader] = useState<CommunityLeader | null>(null);

  async function handleFindPU() {
    setPuLoading(true);
    try {
      const { lat, lng } = await locate({ enableHighAccuracy: false, timeoutMs: 15000 });
      const res = await nearestPollingUnits(lat, lng, 5);
      setPuResult(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't find polling units near you.");
    } finally {
      setPuLoading(false);
    }
  }

  async function handleFindLeaders() {
    setLeadersLoading(true);
    try {
      const { lat, lng } = await locate({ enableHighAccuracy: false, timeoutMs: 15000 });
      const res = await nearestLeaders(lat, lng, 5);
      setLeaders(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't find community leaders near you.");
    } finally {
      setLeadersLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-xl font-bold tracking-tight">Community</h1>
        <p className="text-sm text-muted-foreground">Find nearby polling units and community leaders.</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Find nearest polling unit</h2>
            <p className="text-xs text-muted-foreground">Uses your current location</p>
          </div>
        </div>
        <Button
          onClick={handleFindPU}
          disabled={puLoading}
          className="w-full gap-1.5 bg-indigo-600 text-white hover:bg-indigo-500"
        >
          {puLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
          {puLoading ? "Locating…" : "Find nearest polling units"}
        </Button>

        {puResult && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              Your location&apos;s YardCode:{" "}
              <span className="font-mono font-medium">{puResult.origin.yardcode}</span>
            </p>
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              These are the nearest polling units — not necessarily the one INEC has assigned you.
              Always confirm your assigned unit with INEC.
            </p>
            <div className="space-y-2">
              {puResult.results.map((pu) => (
                <div
                  key={pu.pu_code}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2.5 text-sm dark:border-slate-800"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{pu.pu_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {pu.ward}, {pu.lga} · {formatDistanceKm(pu.distance_km)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1"
                    nativeButton={false}
                    render={<a href={directionsUrl(pu.lat, pu.lng, 21)} target="_blank" rel="noopener noreferrer" />}
                  >
                    <Navigation className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Find community leaders</h2>
            <p className="text-xs text-muted-foreground">People to meet, WhatsApp groups, events</p>
          </div>
        </div>
        <Button
          onClick={handleFindLeaders}
          disabled={leadersLoading}
          className="w-full gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500"
        >
          {leadersLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
          {leadersLoading ? "Locating…" : "Find leaders near me"}
        </Button>

        {leaders && (
          <div className="mt-3 space-y-2">
            {leaders.length === 0 && (
              <p className="text-sm text-muted-foreground">No community leaders found nearby.</p>
            )}
            {leaders.map((leader) => (
              <button
                key={leader.leader_id}
                type="button"
                onClick={() => setSelectedLeader(leader)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 p-2.5 text-left text-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50/50 dark:border-slate-800 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-500/10"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{leader.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{leader.display_title || leader.role}</p>
                </div>
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  {formatDistanceKm(leader.distance_km)}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <LeaderDetailSheet leader={selectedLeader} onOpenChange={(open) => !open && setSelectedLeader(null)} />

      <Link
        href="/field/community/leader"
        className="flex items-center justify-center gap-1 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        Community Leader Login
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
