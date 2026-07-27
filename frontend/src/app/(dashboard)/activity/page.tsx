"use client";

import { useEffect, useMemo, useState } from "react";
import { useMapStore } from "@/lib/store/useMapStore";
import { listActivity, type ActivityRecord } from "@/lib/api/activity";
import { getMediaBatch } from "@/lib/api/media";
import { buildFeedItem } from "@/lib/activity/feedItem";
import { KIND_ICON, KIND_CHIP, KIND_LABEL, type FeedItemKind } from "@/lib/activity/activityIcons";
import { distinctLGAs, distinctWards } from "@/lib/pollingUnits/filterOptions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination } from "@/components/dashboard/Pagination";
import { PUDetailSheet } from "@/components/dashboard/PUDetailSheet";
import { MediaThumb } from "@/components/dashboard/MediaThumb";
import type { Incident, Media, PollingUnit, Result, Severity } from "@/types";
import type { FeedItem } from "@/lib/store/useIncidentStore";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import { Search, X, Loader2, MapPin } from "lucide-react";

const PAGE_SIZE = 30;
const FETCH_LIMIT = 1000;

const SEVERITY_STYLE: Record<Severity, string> = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  critical: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE, MMM d, yyyy");
}

function mediaIdsFor(record: ActivityRecord): string[] {
  if (record.type === "incident.created") return (record.payload as Incident).media_ids ?? [];
  if (record.type === "result.submitted") return (record.payload as Result).media_ids ?? [];
  return [];
}

interface Entry {
  record: ActivityRecord;
  item: FeedItem;
}

export default function ActivityPage() {
  const pollingUnitsMap = useMapStore((s) => s.pollingUnits);
  const officersMap = useMapStore((s) => s.officers);

  const [records, setRecords] = useState<ActivityRecord[]>([]);
  const [mediaMap, setMediaMap] = useState<Record<string, Media>>({});
  const [loading, setLoading] = useState(true); // starts true: initial fetch below runs once on mount
  const [selectedPU, setSelectedPU] = useState<PollingUnit | null>(null);

  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<FeedItemKind | "all">("all");
  const [lga, setLga] = useState("all");
  const [ward, setWard] = useState("all");
  const [officerId, setOfficerId] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let ignore = false;
    listActivity({ limit: FETCH_LIMIT }).then(async (recs) => {
      if (ignore) return;
      setRecords(recs);

      const mediaIds = new Set<string>();
      for (const r of recs) mediaIdsFor(r).forEach((id) => mediaIds.add(id));
      const media = mediaIds.size > 0 ? await getMediaBatch(Array.from(mediaIds)) : [];
      if (ignore) return;
      setMediaMap(Object.fromEntries(media.map((m) => [m.id, m])));
      setLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, []);

  const pollingUnits = useMemo(() => Object.values(pollingUnitsMap), [pollingUnitsMap]);
  const officersList = useMemo(
    () => Object.values(officersMap).sort((a, b) => a.name.localeCompare(b.name)),
    [officersMap],
  );
  const lgaOptions = useMemo(() => distinctLGAs(pollingUnits), [pollingUnits]);
  const wardOptions = useMemo(
    () => distinctWards(pollingUnits, lga === "all" ? undefined : lga),
    [pollingUnits, lga],
  );

  const entries = useMemo<Entry[]>(() => {
    return records
      .map((record) => {
        const item = buildFeedItem(record.type, record.payload, record.id, record.created_at, {
          puName: (code) => pollingUnitsMap[code]?.pu_name ?? code,
          officerName: (id) => officersMap[id]?.name ?? id,
        });
        return item ? { record, item } : null;
      })
      .filter((e): e is Entry => e !== null);
  }, [records, pollingUnitsMap, officersMap]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter(({ record, item }) => {
      if (kind !== "all" && item.kind !== kind) return false;
      const pu = record.pu_code ? pollingUnitsMap[record.pu_code] : undefined;
      if (lga !== "all" && pu?.lga !== lga) return false;
      if (ward !== "all" && pu?.ward !== ward) return false;
      if (officerId !== "all" && record.officer_id !== officerId) return false;
      if (q) {
        const officer = record.officer_id ? officersMap[record.officer_id] : undefined;
        const haystack = `${item.label} ${item.detail} ${pu?.pu_name ?? ""} ${pu?.pu_code ?? ""} ${officer?.name ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [entries, kind, lga, ward, officerId, query, pollingUnitsMap, officersMap]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const filtersActive =
    kind !== "all" || lga !== "all" || ward !== "all" || officerId !== "all" || query.trim() !== "";

  function clearFilters() {
    setKind("all");
    setLga("all");
    setWard("all");
    setOfficerId("all");
    setQuery("");
    setPage(1);
  }

  function updateAndResetPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  let lastDay = "";

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Live Activity</h1>
        <p className="text-sm text-muted-foreground">
          {filtersActive ? `${filtered.length} of ${entries.length} events` : `${entries.length} events recorded`}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => updateAndResetPage(setQuery)(e.target.value)}
            placeholder="Search activity, PU, agent…"
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

        <Select value={kind} onValueChange={(v) => updateAndResetPage(setKind)((v as FeedItemKind | "all") ?? "all")}>
          <SelectTrigger className="w-44 rounded-xl">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="incident">{KIND_LABEL.incident}</SelectItem>
            <SelectItem value="distress">{KIND_LABEL.distress}</SelectItem>
            <SelectItem value="status">{KIND_LABEL.status}</SelectItem>
            <SelectItem value="result">{KIND_LABEL.result}</SelectItem>
            <SelectItem value="officer">{KIND_LABEL.officer}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={lga}
          onValueChange={(v) => {
            updateAndResetPage(setLga)(v ?? "all");
            setWard("all");
          }}
        >
          <SelectTrigger className="w-40 rounded-xl">
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
          <SelectTrigger className="w-40 rounded-xl">
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

        <Select value={officerId} onValueChange={(v) => updateAndResetPage(setOfficerId)(v ?? "all")}>
          <SelectTrigger className="w-44 rounded-xl">
            <SelectValue placeholder="All agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            {officersList.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
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
          <div className="px-4 sm:px-6">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading activity…
              </div>
            )}
            {!loading && pageItems.length === 0 && (
              <p className="py-16 text-center text-sm text-muted-foreground">
                {filtersActive ? "No activity matches these filters." : "No activity recorded yet."}
              </p>
            )}
            {!loading &&
              pageItems.map(({ record, item }) => {
                const day = dayLabel(item.at);
                const showDayHeader = day !== lastDay;
                lastDay = day;
                const pu = record.pu_code ? pollingUnitsMap[record.pu_code] : undefined;
                const officer = record.officer_id ? officersMap[record.officer_id] : undefined;
                const Icon = KIND_ICON[item.kind];
                const incident = record.type === "incident.created" ? (record.payload as Incident) : null;
                const attached = mediaIdsFor(record)
                  .map((id) => mediaMap[id])
                  .filter((m): m is Media => !!m);
                const showOfficerLine =
                  officer && (item.kind === "status" || item.kind === "result" || item.kind === "incident");

                return (
                  <div key={item.id}>
                    {showDayHeader && (
                      <div className="sticky top-0 z-10 -mx-4 bg-white/95 px-4 py-2 text-xs font-semibold text-muted-foreground backdrop-blur first:pt-4 sm:-mx-6 sm:px-6 dark:bg-slate-950/95">
                        {day}
                      </div>
                    )}
                    <div className="flex gap-3 border-b border-slate-100 py-3 text-sm last:border-b-0 dark:border-slate-900">
                      <span
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${KIND_CHIP[item.kind]}`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium">{item.label}</p>
                          {incident && (
                            <Badge variant="secondary" className={`shrink-0 ${SEVERITY_STYLE[incident.severity]}`}>
                              {incident.severity}
                            </Badge>
                          )}
                        </div>
                        {item.detail && <p className="text-xs text-muted-foreground">{item.detail}</p>}
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span>
                            {format(new Date(item.at), "p")} ·{" "}
                            {formatDistanceToNow(new Date(item.at), { addSuffix: true })}
                          </span>
                          {pu && (
                            <button
                              type="button"
                              onClick={() => setSelectedPU(pu)}
                              className="flex items-center gap-1 hover:text-foreground hover:underline"
                            >
                              <MapPin className="h-3 w-3" />
                              {pu.pu_name} · {pu.ward}, {pu.lga}
                            </button>
                          )}
                          {showOfficerLine && <span>Agent: {officer!.name}</span>}
                        </div>
                        {attached.length > 0 && (
                          <div className="mt-2 flex gap-2 overflow-x-auto">
                            {attached.map((m) => (
                              <MediaThumb key={m.id} media={m} size="sm" />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
          <Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} />
        </CardContent>
      </Card>

      <PUDetailSheet pu={selectedPU} onOpenChange={(open) => !open && setSelectedPU(null)} />
    </div>
  );
}
