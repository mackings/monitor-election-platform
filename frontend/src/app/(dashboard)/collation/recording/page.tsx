"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getTally } from "@/lib/api/collation";
import { useMapStore } from "@/lib/store/useMapStore";
import { useCollationStore } from "@/lib/store/useCollationStore";
import { PUVotesList, type PUVoteItem } from "@/components/dashboard/charts/PUVotesList";
import { PUDetailSheet } from "@/components/dashboard/PUDetailSheet";
import { ArrowLeft } from "lucide-react";
import type { PollingUnit, TallyRow } from "@/types";

const TRACKED_PARTY = "APM";

export default function RecordingPage() {
  const pollingUnitsMap = useMapStore((s) => s.pollingUnits);
  const resultsVersion = useCollationStore((s) => s.resultsVersion);
  const [puRows, setPuRows] = useState<TallyRow[] | null>(null);
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

  const recording: PUVoteItem[] = useMemo(
    () =>
      (puRows ?? [])
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
    [puRows, pollingUnitsMap],
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
          Polling units recording {TRACKED_PARTY} votes
        </h1>
        <p className="text-sm text-muted-foreground">Tap a polling unit for its full result breakdown.</p>
      </div>

      <div className="min-h-0 flex-1">
        {puRows === null ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : (
          <PUVotesList
            items={recording}
            emptyLabel="No polling units have recorded votes yet."
            maxHeightClass="h-[calc(100vh-14rem)]"
            onSelect={(code) => setSelected(pollingUnitsMap[code])}
          />
        )}
      </div>

      <PUDetailSheet pu={selected ?? null} onOpenChange={(open) => !open && setSelected(undefined)} />
    </div>
  );
}
