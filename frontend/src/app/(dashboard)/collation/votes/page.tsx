"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listAllResults } from "@/lib/api/collation";
import { useMapStore } from "@/lib/store/useMapStore";
import { useCollationStore } from "@/lib/store/useCollationStore";
import { PUDetailSheet } from "@/components/dashboard/PUDetailSheet";
import { Input } from "@/components/ui/input";
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
  const [selected, setSelected] = useState<PollingUnit | undefined>();

  useEffect(() => {
    let ignore = false;
    listAllResults().then((rows) => {
      if (!ignore) setResults(rows);
    });
    return () => {
      ignore = true;
    };
  }, [resultsVersion]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = results ?? [];
    if (!q) return rows;
    return rows.filter((r) => {
      const pu = pollingUnitsMap[r.pu_code];
      const officer = officersMap[r.officer_id];
      return (
        (pu?.pu_name ?? r.pu_code).toLowerCase().includes(q) ||
        (pu?.ward ?? "").toLowerCase().includes(q) ||
        (pu?.lga ?? "").toLowerCase().includes(q) ||
        (officer?.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [results, query, pollingUnitsMap, officersMap]);

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

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search polling unit, ward, LGA, reporter…"
          className="rounded-xl pl-9"
        />
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        {filtered.length.toLocaleString()} of {(results ?? []).length.toLocaleString()} shown
      </p>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {results === null ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {results.length === 0 ? "No results have been submitted yet." : "No submissions match your search."}
          </p>
        ) : (
          filtered.map((r) => {
            const pu = pollingUnitsMap[r.pu_code];
            const officer = officersMap[r.officer_id];
            const candidateCount = Object.keys(r.vote_counts ?? {}).length;
            return (
              <div
                key={r.id}
                onClick={() => pu && setSelected(pu)}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-900"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{pu?.pu_name ?? r.pu_code}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {pu?.ward}
                    {pu?.ward && pu?.lga ? ", " : ""}
                    {pu?.lga}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    Reported by{" "}
                    <span className="font-medium text-slate-700 dark:text-slate-300">{officer?.name ?? "Unknown agent"}</span>
                    {" · "}
                    {formatDistanceToNow(new Date(r.submitted_at), { addSuffix: true })}
                    {r.source === "sms" && (
                      <span className="ml-1 inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                        <MessageSquareText className="h-3 w-3" /> SMS
                      </span>
                    )}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums">{(r.vote_counts?.[TRACKED_PARTY] ?? 0).toLocaleString()}</p>
                  <p
                    className={cn(
                      "text-[11px]",
                      r.verified ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                    )}
                  >
                    {candidateCount} candidates{r.verified ? " · verified" : ""}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <PUDetailSheet pu={selected ?? null} onOpenChange={(open) => !open && setSelected(undefined)} />
    </div>
  );
}
