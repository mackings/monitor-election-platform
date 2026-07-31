"use client";

import { useEffect } from "react";
import { liveSocket } from "./socket";
import { useMapStore } from "@/lib/store/useMapStore";
import { useIncidentStore } from "@/lib/store/useIncidentStore";
import { useCollationStore } from "@/lib/store/useCollationStore";
import { buildFeedItem } from "@/lib/activity/feedItem";
import type {
  DistressPayload,
  Incident,
  OfficerLocationPayload,
  OfficerStatusPayload,
  StatusEvent,
  WSEvent,
} from "@/types";

/** Mount once near the root of an authenticated layout. Opens a single WS
 * connection and fans out incoming events into the Zustand stores that the
 * map, roster, and live feed all read from. */
export function useLiveEvents() {
  const updatePUStatus = useMapStore((s) => s.updatePUStatus);
  const updateOfficerStatus = useMapStore((s) => s.updateOfficerStatus);
  const updateOfficerLocation = useMapStore((s) => s.updateOfficerLocation);
  const addIncident = useIncidentStore((s) => s.addIncident);
  const pushFeedItem = useIncidentStore((s) => s.pushFeedItem);
  const bumpResultsVersion = useCollationStore((s) => s.bumpResultsVersion);

  useEffect(() => {
    liveSocket.connect();
    const unsubscribe = liveSocket.subscribe((evt: WSEvent) => {
      switch (evt.type) {
        case "pu.status_changed": {
          const p = evt.payload as StatusEvent;
          updatePUStatus(p.pu_code, p.status);
          break;
        }
        case "officer.checked_in":
        case "officer.checked_out":
        case "officer.status_changed": {
          const p = evt.payload as OfficerStatusPayload;
          updateOfficerStatus(p.officer_id, p.status, p.location);
          break;
        }
        case "officer.location_updated": {
          const p = evt.payload as OfficerLocationPayload;
          updateOfficerLocation(p.officer_id, p.location, p.at);
          break;
        }
        case "incident.created": {
          addIncident(evt.payload as Incident);
          break;
        }
        case "distress.triggered": {
          const p = evt.payload as DistressPayload;
          updateOfficerStatus(p.officer_id, "distress", p.location);
          if (p.pu_code) updatePUStatus(p.pu_code, "distress");
          break;
        }
        case "result.submitted": {
          // No store field to patch here (the collation view aggregates
          // server-side) -- just tells the Collation page a new
          // submission exists somewhere so it refetches its current view.
          bumpResultsVersion();
          break;
        }
      }
      // Read the latest snapshot directly rather than subscribing to it —
      // this handler just needs a point-in-time lookup, and subscribing
      // would re-run this whole effect (and reconnect the socket) every
      // time PU/officer data changes.
      const { pollingUnits, officers } = useMapStore.getState();
      const item = buildFeedItem(evt.type, evt.payload, undefined, undefined, {
        puName: (code) => pollingUnits[code]?.pu_name ?? code,
        officerName: (id) => officers[id]?.name ?? id,
      });
      if (item) pushFeedItem(item);
    });

    return () => {
      unsubscribe();
      liveSocket.disconnect();
    };
  }, [updatePUStatus, updateOfficerStatus, updateOfficerLocation, addIncident, pushFeedItem, bumpResultsVersion]);
}
