"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listAllResults } from "@/lib/api/collation";
import { useMapStore } from "@/lib/store/useMapStore";
import { useCollationStore } from "@/lib/store/useCollationStore";
import { useNotificationStore } from "@/lib/store/useNotificationStore";
import { distinctLGAs, distinctWards } from "@/lib/pollingUnits/filterOptions";
import { PUDetailSheet } from "@/components/dashboard/PUDetailSheet";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ArrowLeft, Search, MessageSquareText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { PollingUnit, Result } from "@/types";

const TRACKED_PARTY = "APM";

export default function VotesPage() {
  const pollingUnitsMap = useMapStore((s) => s.pollingUnits);
  const officersMap = useMapStore((s) => s.officers);
  const resultsVersion = useCollationStore((s) => s.resultsVersion);
  const [results, setResults] = useState<Result[] | null>(null);
  const [query, setQuery] = useState("");
  const [lga, setLga] = useState("all");
  const [ward, setWard] = useState("all");
  const [selected, setSelected] = useState<PollingUnit | undefined>();

  useEffect(() => {
    useNotificationStore.getState().markSeen("collation");
    useCollationStore.getState().clearNewResults();
  }, []);

  useEffect(() => {
    let ignore = false;
    listAllResults().then((rows) => {
      if (!ignore) setResults(rows);
    });
    return () => {
      ignore = true;
    };
  }, [resultsVersion]);

  const allPUs = useMemo(() => Object.values(pollingUnitsMap), [pollingUnitsMap]);
  const lgaOptions = useMemo(() => distinctLGAs(allPUs), [allPUs]);
  const wardOptions = useMemo(() => distinctWards(allPUs, lga === "all" ? undefined : lga), [allPUs, lga]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = results ?? [];
    return rows.filter((r) => {
      const pu = pollingUnitsMap[r.pu_code];
      if (lga !== "all" && pu?.lga !== lga) return false;
      if (ward !== "all" && pu?.ward !== ward) return false;
      if (!q) return true;
      const officer = officersMap[r.officer_id];
      return (
        (pu?.pu_name ?? r.pu_code).toLowerCase().includes(q) ||
        (pu?.ward ?? "").toLowerCase().includes(q) ||
        (pu?.lga ?? "").toLowerCase().includes(q) ||
        (officer?.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [results, query, lga, ward, pollingUnitsMap, officersMap]);

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
        <h1 className="mt-2 font-heading text-2xl font-bold tracking-tight">Where {TRACKED_PARTY} votes came from</h1>
        <p className="text-sm text-muted-foreground">Every submission, newest first — the place it came from and who reported it.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search polling unit, ward, LGA, reporter…"
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

        {(query || lga !== "all" || ward !== "all") && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setLga("all");
              setWard("all");
            }}
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        {filtered.length.toLocaleString()} of {(results ?? []).length.toLocaleString()} shown
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {results === null ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {results.length === 0 ? "No results have been submitted yet." : "No submissions match your filters."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((r) => {
              const pu = pollingUnitsMap[r.pu_code];
              const officer = officersMap[r.officer_id];
              const candidateCount = Object.keys(r.vote_counts ?? {}).length;
              return (
                <div
                  key={r.id}
                  onClick={() => pu && setSelected(pu)}
                  className="flex cursor-pointer flex-col gap-2 rounded-xl border border-slate-200/70 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{pu?.pu_name ?? r.pu_code}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {pu?.ward}
                        {pu?.ward && pu?.lga ? ", " : ""}
                        {pu?.lga}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">
                      {(r.vote_counts?.[TRACKED_PARTY] ?? 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs dark:border-slate-800">
                    <p className="truncate text-muted-foreground">
                      Reported by{" "}
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {officer?.name ?? "Unknown agent"}
                      </span>
                      {" · "}
                      {formatDistanceToNow(new Date(r.submitted_at), { addSuffix: true })}
                    </p>
                    <p
                      className={cn(
                        "shrink-0",
                        r.verified ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                      )}
                    >
                      {r.source === "sms" && (
                        <span className="mr-1 inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                          <MessageSquareText className="h-3 w-3" /> SMS
                        </span>
                      )}
                      {candidateCount} candidates{r.verified ? " · verified" : ""}
                    </p>
                  </div>
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
