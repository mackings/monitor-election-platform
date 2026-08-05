"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getTally } from "@/lib/api/collation";
import { useMapStore } from "@/lib/store/useMapStore";
import { useCollationStore } from "@/lib/store/useCollationStore";
import { useNotificationStore } from "@/lib/store/useNotificationStore";
import { distinctLGAs, distinctWards } from "@/lib/pollingUnits/filterOptions";
import { PUVotesList, type PUVoteItem } from "@/components/dashboard/charts/PUVotesList";
import { PUDetailSheet } from "@/components/dashboard/PUDetailSheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { partyTotals, projectedVotes } from "@/lib/pollingUnits/partyTotals";
import { ArrowLeft } from "lucide-react";
import type { PollingUnit, TallyRow } from "@/types";

export default function RecordingPage() {
  const pollingUnitsMap = useMapStore((s) => s.pollingUnits);
  const officersMap = useMapStore((s) => s.officers);
  const resultsVersion = useCollationStore((s) => s.resultsVersion);
  const [puRows, setPuRows] = useState<TallyRow[] | null>(null);
  const [lga, setLga] = useState("all");
  const [ward, setWard] = useState("all");
  const [agentId, setAgentId] = useState("all");
  const [party, setParty] = useState("all");
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

  const parties = useMemo(() => {
    const combined: Record<string, number> = {};
    for (const row of puRows ?? []) {
      for (const [p, v] of Object.entries(row.vote_counts ?? {})) combined[p] = (combined[p] ?? 0) + v;
    }
    return partyTotals(combined);
  }, [puRows]);

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
      (puRows ?? [])
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
            votes: projectedVotes(r.vote_counts, party),
          };
        })
        .filter((p) => p.votes > 0)
        .sort((a, b) => b.votes - a.votes),
    [puRows, pollingUnitsMap, lga, ward, agentId, party],
  );

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
        <h1 className="mt-2 font-heading text-2xl font-bold tracking-tight">
          Polling units recording {party === "all" ? "" : `${party} `}votes
        </h1>
        <p className="text-sm text-muted-foreground">Tap a polling unit for its full result breakdown.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
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

        <Select value={party} onValueChange={(v) => setParty(v ?? "all")}>
          <SelectTrigger className="w-40 rounded-xl">
            <SelectValue placeholder="All parties">{(v: string) => (v === "all" ? "All parties" : v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All parties</SelectItem>
            {parties.map((p) => (
              <SelectItem key={p.party} value={p.party}>
                {p.party}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(lga !== "all" || ward !== "all" || agentId !== "all" || party !== "all") && (
          <button
            type="button"
            onClick={() => {
              setLga("all");
              setWard("all");
              setAgentId("all");
              setParty("all");
            }}
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1">
        {puRows === null ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : (
          <PUVotesList
            items={recording}
            emptyLabel="No polling units have recorded votes yet."
            maxHeightClass="h-[calc(100vh-17rem)]"
            onSelect={(code) => setSelected(pollingUnitsMap[code])}
          />
        )}
      </div>

      <PUDetailSheet pu={selected ?? null} onOpenChange={(open) => !open && setSelected(undefined)} />
    </div>
  );
}
