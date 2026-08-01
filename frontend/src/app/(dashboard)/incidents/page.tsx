"use client";

import { useEffect, useMemo, useState } from "react";
import { useIncidentStore } from "@/lib/store/useIncidentStore";
import { useMapStore } from "@/lib/store/useMapStore";
import { useNotificationStore } from "@/lib/store/useNotificationStore";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { distinctLGAs } from "@/lib/pollingUnits/filterOptions";
import { IncidentGroupCard } from "@/components/dashboard/IncidentGroupCard";
import { IncidentGroupSheet } from "@/components/dashboard/IncidentGroupSheet";
import { PUDetailSheet } from "@/components/dashboard/PUDetailSheet";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { getMediaBatch } from "@/lib/api/media";
import { Search, ListFilter } from "lucide-react";
import type { Media, PollingUnit, Severity } from "@/types";

const SEVERITY_OPTIONS: Severity[] = ["low", "medium", "high", "critical"];

export default function IncidentsPage() {
  const incidents = useIncidentStore((s) => s.incidents);
  const pollingUnits = useMapStore((s) => s.pollingUnits);
  const officers = useMapStore((s) => s.officers);
  const [mediaMap, setMediaMap] = useState<Record<string, Media>>({});
  const [selectedPU, setSelectedPU] = useState<PollingUnit | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 200);
  const [severities, setSeverities] = useState<Set<Severity>>(new Set());
  const [lga, setLga] = useState("all");

  useEffect(() => {
    useNotificationStore.getState().markSeen("incidents");
  }, []);

  const lgaOptions = useMemo(() => distinctLGAs(Object.values(pollingUnits)), [pollingUnits]);

  function toggleSeverity(s: Severity, checked: boolean) {
    setSeverities((prev) => {
      const next = new Set(prev);
      if (checked) next.add(s);
      else next.delete(s);
      return next;
    });
  }

  const allMediaIds = useMemo(
    () => Array.from(new Set(incidents.flatMap((i) => i.media_ids ?? []))),
    [incidents],
  );

  useEffect(() => {
    let ignore = false;
    getMediaBatch(allMediaIds).then((media) => {
      if (ignore) return;
      setMediaMap(Object.fromEntries(media.map((m) => [m.id, m])));
    });
    return () => {
      ignore = true;
    };
  }, [allMediaIds]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    return incidents.filter((inc) => {
      const pu = pollingUnits[inc.pu_code];
      if (severities.size > 0 && !severities.has(inc.severity)) return false;
      if (lga !== "all" && pu?.lga !== lga) return false;
      if (!q) return true;
      const officer = officers[inc.officer_id];
      return (
        inc.type.toLowerCase().includes(q) ||
        inc.description.toLowerCase().includes(q) ||
        inc.pu_code.toLowerCase().includes(q) ||
        (pu?.pu_name ?? "").toLowerCase().includes(q) ||
        (pu?.ward ?? "").toLowerCase().includes(q) ||
        (pu?.lga ?? "").toLowerCase().includes(q) ||
        (officer?.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [incidents, severities, lga, debouncedQuery, pollingUnits, officers]);

  // Grouped by polling unit rather than shown flat -- several reports from
  // the same location (a common case, not an edge case) used to bury each
  // other as near-identical repeated cards instead of reading as "this
  // place has 3 incidents, look here first."
  const groups = useMemo(() => {
    const byPU = new Map<string, typeof filtered>();
    for (const inc of filtered) {
      const list = byPU.get(inc.pu_code) ?? [];
      list.push(inc);
      byPU.set(inc.pu_code, list);
    }
    return Array.from(byPU.entries()).sort(
      ([, a], [, b]) => new Date(b[0].created_at).getTime() - new Date(a[0].created_at).getTime(),
    );
  }, [filtered]);

  const openGroupIncidents = openGroup ? (groups.find(([code]) => code === openGroup)?.[1] ?? []) : [];

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Incidents</h1>
        <p className="text-sm text-muted-foreground">
          {incidents.length} reported incidents across {groups.length} location{groups.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search polling unit, ward, LGA, type…"
            className="rounded-xl pl-9"
          />
        </div>

        <Select value={lga} onValueChange={(v) => setLga(v ?? "all")}>
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

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="gap-1.5 rounded-xl" />}>
            <ListFilter className="h-4 w-4" />
            Severity{severities.size > 0 ? ` (${severities.size})` : ""}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {SEVERITY_OPTIONS.map((s) => (
              <DropdownMenuCheckboxItem key={s} checked={severities.has(s)} onCheckedChange={(c) => toggleSeverity(s, c)}>
                {s[0].toUpperCase() + s.slice(1)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {(query || severities.size > 0 || lga !== "all") && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSeverities(new Set());
              setLga("all");
            }}
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="space-y-3">
        {groups.map(([puCode, groupIncidents]) => (
          <IncidentGroupCard
            key={puCode}
            puCode={puCode}
            pu={pollingUnits[puCode]}
            incidents={groupIncidents}
            onClick={() => setOpenGroup(puCode)}
          />
        ))}
        {groups.length === 0 && (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {incidents.length === 0 ? "No incidents reported yet." : "No incidents match your filters."}
          </p>
        )}
      </div>

      <IncidentGroupSheet
        puCode={openGroup}
        pu={openGroup ? pollingUnits[openGroup] : undefined}
        incidents={openGroupIncidents}
        officers={officers}
        mediaMap={mediaMap}
        onOpenChange={(open) => !open && setOpenGroup(null)}
        onViewPU={openGroup && pollingUnits[openGroup] ? () => setSelectedPU(pollingUnits[openGroup]) : undefined}
      />

      <PUDetailSheet pu={selectedPU} onOpenChange={(open) => !open && setSelectedPU(null)} />
    </div>
  );
}
