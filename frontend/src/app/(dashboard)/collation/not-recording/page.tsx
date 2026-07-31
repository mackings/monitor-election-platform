"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getTally } from "@/lib/api/collation";
import { useMapStore } from "@/lib/store/useMapStore";
import { useCollationStore } from "@/lib/store/useCollationStore";
import { PUDetailSheet } from "@/components/dashboard/PUDetailSheet";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ArrowLeft, Search } from "lucide-react";
import type { PollingUnit, TallyRow } from "@/types";

export default function NotRecordingPage() {
  const pollingUnitsMap = useMapStore((s) => s.pollingUnits);
  const officersMap = useMapStore((s) => s.officers);
  const resultsVersion = useCollationStore((s) => s.resultsVersion);
  const [puRows, setPuRows] = useState<TallyRow[] | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PollingUnit | undefined>();

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notRecording;
    return notRecording.filter(
      (pu) =>
        pu.pu_name.toLowerCase().includes(q) ||
        pu.lga.toLowerCase().includes(q) ||
        pu.ward.toLowerCase().includes(q),
    );
  }, [notRecording, query]);

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

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search polling unit, ward, LGA…"
          className="rounded-xl pl-9"
        />
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        {filtered.length.toLocaleString()} of {notRecording.length.toLocaleString()} shown
      </p>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {puRows === null ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {notRecording.length === 0 ? "Every polling unit has recorded votes." : "No polling units match your search."}
          </p>
        ) : (
          filtered.map((pu) => {
            const agent = pu.assigned_officer_id ? officersMap[pu.assigned_officer_id] : undefined;
            return (
              <div
                key={pu.pu_code}
                onClick={() => setSelected(pu)}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-900"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{pu.pu_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {pu.ward}
                    {pu.ward && pu.lga ? ", " : ""}
                    {pu.lga}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                    agent
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
                  )}
                >
                  {agent ? agent.name : "Unassigned"}
                </span>
              </div>
            );
          })
        )}
      </div>

      <PUDetailSheet pu={selected ?? null} onOpenChange={(open) => !open && setSelected(undefined)} />
    </div>
  );
}
