import type {
  DistressPayload,
  Incident,
  OfficerStatusPayload,
  Result,
  StatusEvent,
  WSEventType,
} from "@/types";
import type { FeedItem } from "@/lib/store/useIncidentStore";

export interface FeedItemResolvers {
  /** pu_code -> human-readable PU name. Falls back to the code itself. */
  puName?: (code: string) => string;
  /** officer_id -> human-readable officer name. Falls back to the id. */
  officerName?: (id: string) => string;
}

/** Turns a (type, payload) pair — whether it just arrived live over WS or
 * came back from GET /activity as history — into the same FeedItem shape,
 * so the live feed and a PU's persisted timeline render identically.
 * Resolvers let the caller show actual PU/officer names instead of raw
 * codes/ids when that lookup data is available. */
export function buildFeedItem(
  type: WSEventType,
  payload: unknown,
  overrideId?: string,
  overrideAt?: string,
  resolvers?: FeedItemResolvers,
): FeedItem | null {
  const puName = (code: string) => resolvers?.puName?.(code) ?? code;
  const officerName = (id: string) => resolvers?.officerName?.(id) ?? id;

  switch (type) {
    case "pu.status_changed": {
      const p = payload as StatusEvent;
      return {
        id: overrideId ?? `${p.pu_code}-${p.created_at}`,
        kind: "status",
        label: `${puName(p.pu_code)} status: ${p.status.replace("_", " ")}`,
        detail: p.note ?? "",
        at: overrideAt ?? p.created_at,
      };
    }
    case "officer.checked_in":
    case "officer.checked_out":
    case "officer.status_changed": {
      const p = payload as OfficerStatusPayload;
      return {
        id: overrideId ?? `${p.officer_id}-${p.at}`,
        kind: "officer",
        label: `${officerName(p.officer_id)} ${p.status === "offline" ? "checked out" : "checked in"}`,
        detail: "",
        at: overrideAt ?? p.at,
      };
    }
    case "incident.created": {
      const incident = payload as Incident;
      return {
        id: overrideId ?? incident.id,
        kind: "incident",
        label: `Incident: ${incident.type} at ${puName(incident.pu_code)}`,
        detail: incident.description,
        at: overrideAt ?? incident.created_at,
      };
    }
    case "distress.triggered": {
      const p = payload as DistressPayload;
      return {
        id: overrideId ?? `${p.officer_id}-${p.at}`,
        kind: "distress",
        label: `Distress alert at ${p.pu_code ? puName(p.pu_code) : "unknown PU"}`,
        detail: officerName(p.officer_id),
        at: overrideAt ?? p.at,
      };
    }
    case "result.submitted": {
      const result = payload as Result;
      return {
        id: overrideId ?? `${result.pu_code}-${result.submitted_at}`,
        kind: "result",
        label: `Result sheet received: ${puName(result.pu_code)}`,
        detail: "",
        at: overrideAt ?? result.submitted_at,
      };
    }
    default:
      return null;
  }
}
