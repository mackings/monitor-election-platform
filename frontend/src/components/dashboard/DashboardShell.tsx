"use client";

import { useEffect } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Sidebar } from "./Sidebar";
import { useLiveEvents } from "@/lib/ws/useLiveEvents";
import { useMapStore } from "@/lib/store/useMapStore";
import { useIncidentStore } from "@/lib/store/useIncidentStore";
import { listPollingUnits } from "@/lib/api/pollingUnits";
import { listOfficers } from "@/lib/api/officers";
import { listIncidents } from "@/lib/api/incidents";
import { listActivity } from "@/lib/api/activity";
import { buildFeedItem } from "@/lib/activity/feedItem";

function DashboardData({ children }: { children: React.ReactNode }) {
  useLiveEvents();
  const setPollingUnits = useMapStore((s) => s.setPollingUnits);
  const setOfficers = useMapStore((s) => s.setOfficers);
  const setIncidents = useIncidentStore((s) => s.setIncidents);
  const hydrateFeed = useIncidentStore((s) => s.hydrateFeed);

  useEffect(() => {
    listIncidents({ limit: 50 }).then(setIncidents).catch(() => {});

    // Fetched together (rather than reading the map/officer stores, which
    // this same effect is also populating) so building feed labels can
    // use these results directly instead of racing store state that
    // might still be empty at this point.
    Promise.all([listPollingUnits(), listOfficers(), listActivity({ limit: 100 })])
      .then(([pollingUnits, officers, records]) => {
        setPollingUnits(pollingUnits);
        setOfficers(officers);
        const puNameByCode = new Map(pollingUnits.map((pu) => [pu.pu_code, pu.pu_name]));
        const officerNameById = new Map(officers.map((o) => [o.id, o.name]));
        const items = records
          .map((r) =>
            buildFeedItem(r.type, r.payload, r.id, r.created_at, {
              puName: (code) => puNameByCode.get(code) ?? code,
              officerName: (id) => officerNameById.get(id) ?? id,
            }),
          )
          .filter((item) => item !== null);
        hydrateFeed(items);
      })
      .catch(() => {});
  }, [setPollingUnits, setOfficers, setIncidents, hydrateFeed]);

  return <>{children}</>;
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allow={["admin", "supervisor"]}>
      <DashboardData>
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </DashboardData>
    </AuthGuard>
  );
}
