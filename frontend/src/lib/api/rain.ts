import { useRainAuthStore } from "@/lib/store/useRainAuthStore";
import type {
  BroadcastDryRunResult,
  BroadcastInput,
  BroadcastSendResult,
  CommunityLeader,
  CreateEventInput,
  EventRsvpRecord,
  LeaderEvent,
  LeaderProfile,
  LeaderProfileInput,
  NearestPUResponse,
  OwnLeaderEvent,
  RainLeaderUser,
  RainMe,
  RsvpResponseValue,
  WhatsappInterestRecord,
} from "@/types/rain";

// A separate third-party service (RAIN, election.yardcode.ng) -- not the
// Monitor backend, no auth needed for any of these (all public endpoints).
const RAIN_BASE = "https://election.yardcode.ng";

export class RainApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${RAIN_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers as Record<string, string>) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // FastAPI-style error body: { "detail": "..." }
    throw new RainApiError(res.status, body?.detail ?? res.statusText);
  }
  return body as T;
}

export function nearestPollingUnits(lat: number, lng: number, top = 5) {
  return request<NearestPUResponse>(`/api/public/nearest-pu?lat=${lat}&lng=${lng}&top=${top}`);
}

export function nearestLeaders(lat: number, lng: number, top = 5) {
  return request<CommunityLeader[]>(`/api/public/nearest-leaders?lat=${lat}&lng=${lng}&top=${top}`);
}

export function leaderEvents(leaderId: string) {
  return request<LeaderEvent[]>(`/api/public/leader-events?leader_id=${leaderId}`);
}

export function rsvpToEvent(input: {
  event_id: string;
  full_name: string;
  phone: string;
  response: RsvpResponseValue;
}) {
  return request<{ ok: boolean }>("/api/public/rsvp", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function joinWhatsappInterest(input: { leader_id: string; full_name: string; phone: string }) {
  return request<{ ok: boolean; whatsapp_group_link: string | null }>("/api/public/whatsapp-interest", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Builds a Google Maps deep link from raw coordinates -- per the API's
 * own guidance, always constructed client-side rather than routed
 * through any other server. */
export function directionsUrl(lat: number, lng: number, zoom = 18): string {
  return `https://www.google.com/maps?q=${lat},${lng}&ll=${lat},${lng}&z=${zoom}&t=k`;
}

/** RAIN sometimes serializes timestamps as "YYYY-MM-DD HH:MM:SS+00"
 * (a space instead of "T", and a timezone offset with no colon) rather
 * than strict ISO 8601 -- V8 parses that loosely, but WebKit (Safari/
 * iOS, which a lot of field agents use) returns Invalid Date for it.
 * Normalize before parsing so a date-formatting call doesn't silently
 * crash on iOS while working fine in every other browser. */
export function parseApiDate(input: string): Date {
  let normalized = input.trim().replace(" ", "T");
  if (/[+-]\d{2}$/.test(normalized)) {
    normalized += ":00";
  }
  return new Date(normalized);
}

// -- Community-leader self-service (separate RAIN login) --

function authHeaders(): Record<string, string> {
  const token = useRainAuthStore.getState().token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function login(phone: string, password: string) {
  return request<{ access_token: string; token_type: string; user: RainLeaderUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ phone, password }),
  });
}

export function getMe() {
  return request<RainMe>("/api/me", { headers: authHeaders() });
}

/** Returns null if the leader hasn't set up a profile yet (404). */
export async function getLeaderProfile(): Promise<LeaderProfile | null> {
  try {
    return await request<LeaderProfile>("/api/leader/profile", { headers: authHeaders() });
  } catch (err) {
    if (err instanceof RainApiError && err.status === 404) return null;
    throw err;
  }
}

export function upsertLeaderProfile(input: LeaderProfileInput) {
  return request<{ ok: boolean }>("/api/leader/profile", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
}

export function createLeaderEvent(input: CreateEventInput) {
  return request<{ ok: boolean; id: string }>("/api/leader/events", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
}

export function listLeaderEvents() {
  return request<OwnLeaderEvent[]>("/api/leader/events", { headers: authHeaders() });
}

export function getEventRsvps(eventId: string) {
  return request<EventRsvpRecord[]>(`/api/leader/events/${eventId}/rsvps`, { headers: authHeaders() });
}

export function getWhatsappInterests() {
  return request<WhatsappInterestRecord[]>("/api/leader/whatsapp-interests", { headers: authHeaders() });
}

export function sendBroadcast(input: BroadcastInput) {
  return request<BroadcastDryRunResult | BroadcastSendResult>("/api/broadcast", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
}
