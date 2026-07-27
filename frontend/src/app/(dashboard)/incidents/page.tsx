"use client";

import { useEffect, useMemo, useState } from "react";
import { useIncidentStore } from "@/lib/store/useIncidentStore";
import { useMapStore } from "@/lib/store/useMapStore";
import { IncidentCard } from "@/components/dashboard/IncidentCard";
import { PUDetailSheet } from "@/components/dashboard/PUDetailSheet";
import { getMediaBatch } from "@/lib/api/media";
import type { Media, PollingUnit } from "@/types";

export default function IncidentsPage() {
  const incidents = useIncidentStore((s) => s.incidents);
  const pollingUnits = useMapStore((s) => s.pollingUnits);
  const officers = useMapStore((s) => s.officers);
  const [mediaMap, setMediaMap] = useState<Record<string, Media>>({});
  const [selectedPU, setSelectedPU] = useState<PollingUnit | null>(null);

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

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Incidents</h1>
        <p className="text-sm text-muted-foreground">{incidents.length} reported incidents</p>
      </div>

      <div className="space-y-3">
        {incidents.map((incident) => {
          const pu = pollingUnits[incident.pu_code];
          const officer = officers[incident.officer_id];
          const media = (incident.media_ids ?? []).map((id) => mediaMap[id]).filter((m): m is Media => !!m);
          return (
            <IncidentCard
              key={incident.id}
              incident={incident}
              pu={pu}
              officer={officer}
              media={media}
              onViewPU={pu ? () => setSelectedPU(pu) : undefined}
            />
          );
        })}
        {incidents.length === 0 && (
          <p className="py-16 text-center text-sm text-muted-foreground">
            No incidents reported yet.
          </p>
        )}
      </div>

      <PUDetailSheet pu={selectedPU} onOpenChange={(open) => !open && setSelectedPU(null)} />
    </div>
  );
}
