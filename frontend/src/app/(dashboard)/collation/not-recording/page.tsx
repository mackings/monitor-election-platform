"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getTally } from "@/lib/api/collation";
import { useMapStore } from "@/lib/store/useMapStore";
import { useCollationStore } from "@/lib/store/useCollationStore";
import { useNotificationStore } from "@/lib/store/useNotificationStore";
import { distinctLGAs, distinctWards } from "@/lib/pollingUnits/filterOptions";
import { PUDetailSheet } from "@/components/dashboard/PUDetailSheet";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ArrowLeft, Search } from "lucide-react";
import type { PollingUnit, TallyRow } from "@/types";

export default function NotRecordingPage() {
  const pollingUnitsMap = useMapStore((s) => s.pollingUnits);
  const officersMap = useMapStore((s) => s.officers);
  const resultsVersion = useCollationStore((s) => s.resultsVersion);
  const [puRows, setPuRows] = useState<TallyRow[] | null>(null);
  const [query, setQuery] = useState("");
  const [lga, setLga] = useState("all");
  const [ward, setWard] = useState("all");
  const [agentId, setAgentId] = useState("all");
  const [selected, setSelected] = useState<PollingUnit | undefined>();

  useEffect(() => {
    useNotificationStore.getState().markSeen("collation");
    useCollationStore.getState().clearNewResults();
  }, []);

  useEffect(() => {
    let ignore = false;
    getTally("pu").then((rows) => {
      if (!ignore) setPuRows(rows);
    });
    return () => {
      ignore = true;
    };
  }, [resultsVersion]);

  const reportingCodes = useMemo(() => new Set((puRows ?? []).map((r) => r.key)), [puRows]);

  const notRecording = useMemo(
    () =>
      Object.values(pollingUnitsMap)
        .filter((pu) => !reportingCodes.has(pu.pu_code))
        .sort((a, b) => a.pu_name.localeCompare(b.pu_name)),
    [pollingUnitsMap, reportingCodes],
  );

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notRecording.filter((pu) => {
      if (lga !== "all" && pu.lga !== lga) return false;
      if (ward !== "all" && pu.ward !== ward) return false;
      if (agentId === "unassigned" && pu.assigned_officer_id) return false;
      if (agentId !== "all" && agentId !== "unassigned" && pu.assigned_officer_id !== agentId) return false;
      if (!q) return true;
      return (
        pu.pu_name.toLowerCase().includes(q) ||
        pu.lga.toLowerCase().includes(q) ||
        pu.ward.toLowerCase().includes(q)
      );
    });
  }, [notRecording, query, lga, ward, agentId]);

  return (
    <div className="flex h-full flex-col space-y-4 p-6">
      <div>
        <Link
          href="/collation"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to collation
        </Link>
        <h1 className="mt-2 font-heading text-2xl font-bold tracking-tight">Polling units not recording votes yet</h1>
        <p className="text-sm text-muted-foreground">Tap a polling unit to assign or manage its agent.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search polling unit, ward, LGA…"
            className="rounded-xl pl-9"
          />
        </div>

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
              {(v: string) =>
                v === "all" ? "All agents" : v === "unassigned" ? "Unassigned" : (agentOptions.find((o) => o.id === v)?.name ?? v)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {agentOptions.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(query || lga !== "all" || ward !== "all" || agentId !== "all") && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
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
      <p className="-mt-2 text-xs text-muted-foreground">
        {filtered.length.toLocaleString()} of {notRecording.length.toLocaleString()} shown
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {puRows === null ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {notRecording.length === 0 ? "Every polling unit has recorded votes." : "No polling units match your filters."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((pu) => {
              const agent = pu.assigned_officer_id ? officersMap[pu.assigned_officer_id] : undefined;
              return (
                <div
                  key={pu.pu_code}
                  onClick={() => setSelected(pu)}
                  className="flex cursor-pointer flex-col gap-2 rounded-xl border border-slate-200/70 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{pu.pu_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {pu.ward}
                      {pu.ward && pu.lga ? ", " : ""}
                      {pu.lga}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "w-fit rounded-full px-2 py-0.5 text-xs font-medium",
                      agent
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
                    )}
                  >
                    {agent ? agent.name : "Unassigned"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <PUDetailSheet pu={selected ?? null} onOpenChange={(open) => !open && setSelected(undefined)} />
    </div>
  );
}
