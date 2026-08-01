"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getTally } from "@/lib/api/collation";
import { useMapStore } from "@/lib/store/useMapStore";
import { useCollationStore } from "@/lib/store/useCollationStore";
import { useNotificationStore } from "@/lib/store/useNotificationStore";
import { distinctLGAs, distinctWards } from "@/lib/pollingUnits/filterOptions";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/dashboard/StatTile";
import { LogSmsResultDialog } from "@/components/dashboard/LogSmsResultDialog";
import { PUVotesList, type PUVoteItem } from "@/components/dashboard/charts/PUVotesList";
import { PUDetailSheet } from "@/components/dashboard/PUDetailSheet";
import { Radio, Vote, CheckCircle2, Clock, ChevronRight } from "lucide-react";
import type { PollingUnit, TallyRow } from "@/types";

// This dashboard tracks one party at a glance, per how it's actually
// used -- everyone reading it wants APM's numbers, not a general-purpose
// multi-party comparison.
const TRACKED_PARTY = "APM";

interface TallyData {
  version: number;
  stateRow: TallyRow | null;
  puRows: TallyRow[];
}

export default function CollationPage() {
  const pollingUnitsMap = useMapStore((s) => s.pollingUnits);
  const officersMap = useMapStore((s) => s.officers);
  const resultsVersion = useCollationStore((s) => s.resultsVersion);

  // Keyed by version rather than reset synchronously in the effect body --
  // stale data is treated as "still loading" until the fetch resolves.
  const [data, setData] = useState<TallyData | null>(null);
  const [selected, setSelected] = useState<PollingUnit | undefined>();
  const [lga, setLga] = useState("all");
  const [ward, setWard] = useState("all");
  const [agentId, setAgentId] = useState("all");

  useEffect(() => {
    useNotificationStore.getState().markSeen("collation");
    useCollationStore.getState().clearNewResults();
  }, []);

  useEffect(() => {
    let ignore = false;
    Promise.all([getTally("state"), getTally("pu")]).then(([stateRows, puRows]) => {
      if (ignore) return;
      setData({ version: resultsVersion, stateRow: stateRows[0] ?? null, puRows });
    });
    return () => {
      ignore = true;
    };
  }, [resultsVersion]);

  const stale = data?.version !== resultsVersion;
  const stateRow = stale ? null : data?.stateRow ?? null;
  const puRows = useMemo(() => (stale ? [] : (data?.puRows ?? [])), [stale, data]);

  const totalVotes = stateRow?.vote_counts?.[TRACKED_PARTY] ?? 0;
  const reportingCodes = useMemo(() => new Set(puRows.map((r) => r.key)), [puRows]);

  const allPUs = useMemo(() => Object.values(pollingUnitsMap), [pollingUnitsMap]);
  const lgaOptions = useMemo(() => distinctLGAs(allPUs), [allPUs]);
  const wardOptions = useMemo(() => distinctWards(allPUs, lga === "all" ? undefined : lga), [allPUs, lga]);
  const agentOptions = useMemo(
    () =>
      Object.values(officersMap)
        .filter((o) => o.assigned_pu_code)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [officersMap],
  );

  const recording: PUVoteItem[] = useMemo(
    () =>
      puRows
        .filter((r) => {
          const pu = pollingUnitsMap[r.key];
          if (lga !== "all" && pu?.lga !== lga) return false;
          if (ward !== "all" && pu?.ward !== ward) return false;
          if (agentId !== "all" && pu?.assigned_officer_id !== agentId) return false;
          return true;
        })
        .map((r) => {
          const pu = pollingUnitsMap[r.key];
          return {
            code: r.key,
            name: pu?.pu_name ?? r.key,
            lga: pu?.lga ?? "",
            ward: pu?.ward ?? "",
            votes: r.vote_counts?.[TRACKED_PARTY] ?? 0,
          };
        })
        .filter((p) => p.votes > 0)
        .sort((a, b) => b.votes - a.votes),
    [puRows, pollingUnitsMap, lga, ward, agentId],
  );

  const notRecordingCount = useMemo(
    () => Object.values(pollingUnitsMap).filter((pu) => !reportingCodes.has(pu.pu_code)).length,
    [pollingUnitsMap, reportingCodes],
  );

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight">Collation</h1>
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
              {TRACKED_PARTY}
            </span>
            <span
              className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
              title="Updates automatically as new results come in"
            >
              <Radio className="h-3 w-3 animate-pulse" />
              Live
            </span>
          </div>
          <p className="text-sm text-muted-foreground">Every polling unit, at a glance.</p>
        </div>
        <LogSmsResultDialog onLogged={() => useCollationStore.getState().bumpResultsVersion()} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatTile
          label={`Total ${TRACKED_PARTY} votes`}
          value={totalVotes.toLocaleString()}
          icon={Vote}
          href="/collation/votes"
        />
        <StatTile
          label="Recording votes"
          value={recording.length.toLocaleString()}
          icon={CheckCircle2}
          tone="success"
          href="/collation/votes"
        />
        <StatTile
          label="Not recording yet"
          value={notRecordingCount.toLocaleString()}
          icon={Clock}
          tone="warning"
          href="/collation/not-recording"
        />
      </div>

      <Card className="rounded-2xl border-slate-200/70 dark:border-slate-800">
        <CardContent className="py-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Polling units recording {TRACKED_PARTY} votes</p>
            <Link
              href="/collation/recording"
              className="flex shrink-0 items-center text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              View all
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Select
              value={lga}
              onValueChange={(v) => {
                setLga(v ?? "all");
                setWard("all");
              }}
            >
              <SelectTrigger className="w-44 rounded-xl">
                <SelectValue placeholder="All LGAs">{(v: string) => (v === "all" ? "All LGAs" : v)}</SelectValue>
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

            <Select value={ward} onValueChange={(v) => setWard(v ?? "all")}>
              <SelectTrigger className="w-44 rounded-xl">
                <SelectValue placeholder="All wards">{(v: string) => (v === "all" ? "All wards" : v)}</SelectValue>
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

            <Select value={agentId} onValueChange={(v) => setAgentId(v ?? "all")}>
              <SelectTrigger className="w-44 rounded-xl">
                <SelectValue placeholder="All agents">
                  {(v: string) => (v === "all" ? "All agents" : (agentOptions.find((o) => o.id === v)?.name ?? v))}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All agents</SelectItem>
                {agentOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(lga !== "all" || ward !== "all" || agentId !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setLga("all");
                  setWard("all");
                  setAgentId("all");
                }}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>

          <PUVotesList
            items={recording}
            emptyLabel="No polling units have recorded votes yet."
            maxHeightClass="h-[calc(100vh-20rem)]"
            onSelect={(code) => setSelected(pollingUnitsMap[code])}
          />
        </CardContent>
      </Card>

      <PUDetailSheet pu={selected ?? null} onOpenChange={(open) => !open && setSelected(undefined)} />
    </div>
  );
}
