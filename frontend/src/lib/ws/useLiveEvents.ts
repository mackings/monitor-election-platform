"use client";

import { useEffect } from "react";
import { liveSocket } from "./socket";
import { useMapStore } from "@/lib/store/useMapStore";
import { useIncidentStore } from "@/lib/store/useIncidentStore";
import { buildFeedItem } from "@/lib/activity/feedItem";
import type { DistressPayload, Incident, OfficerStatusPayload, StatusEvent, WSEvent } from "@/types";

/** Mount once near the root of an authenticated layout. Opens a single WS
 * connection and fans out incoming events into the Zustand stores that the
 * map, roster, and live feed all read from. */
export function useLiveEvents() {
  const updatePUStatus = useMapStore((s) => s.updatePUStatus);
  const updateOfficerStatus = useMapStore((s) => s.updateOfficerStatus);
  const addIncident = useIncidentStore((s) => s.addIncident);
  const pushFeedItem = useIncidentStore((s) => s.pushFeedItem);

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
  }, [updatePUStatus, updateOfficerStatus, addIncident, pushFeedItem]);
}
