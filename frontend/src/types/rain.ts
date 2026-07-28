// Types for the RAIN public API (election.yardcode.ng) -- a separate
// third-party service, not the Monitor backend. Only the public,
// no-login endpoints are used here (nearest PU/leader finder, RSVP,
// WhatsApp interest) -- community-leader self-service login is a
// different persona and deliberately out of scope for the agent app.

export interface RainPUResult {
  pu_code: string;
  pu_name: string;
  ward: string;
  lga: string;
  state: string;
  lat: number;
  lng: number;
  distance_km: number;
  yardcode?: string;
}

export interface NearestPUResponse {
  origin: { lat: number; lng: number; yardcode: string };
  results: RainPUResult[];
}

export interface CommunityLeader {
  leader_id: string;
  name: string;
  role: string;
  display_title?: string | null;
  bio?: string | null;
  address?: string | null;
  lat: number;
  lng: number;
  whatsapp_group_link?: string | null;
  public_phone?: string | null;
  distance_km: number;
}

export type LeaderEventType = "townhall" | "campaign" | "door_to_door" | "community" | "other";

export interface LeaderEvent {
  id: string;
  title: string;
  event_type: LeaderEventType;
  description?: string | null;
  venue?: string | null;
  lat: number;
  lng: number;
  starts_at: string;
  ends_at?: string | null;
}

export type RsvpResponseValue = "going" | "interested" | "not_going";

// -- Community-leader self-service (separate RAIN login, not the agent's
// Monitor session) --

export interface RainLeaderUser {
  id: string;
  first_name: string;
  last_name: string;
}

export interface RainScope {
  scope_level: string;
  zone_id: string | null;
  state_id: number | null;
  lga_id: number | null;
  ward_id: number | null;
  polling_unit_id: number | null;
}

export interface RainMe {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  is_national: boolean;
  scopes: RainScope[];
  permissions: string[];
}

export interface LeaderProfile {
  user_id: string;
  display_title?: string | null;
  bio?: string | null;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  whatsapp_group_link?: string | null;
  public_phone?: string | null;
  is_public: boolean;
}

export interface LeaderProfileInput {
  display_title?: string;
  bio?: string;
  lat?: number;
  lng?: number;
  address?: string;
  whatsapp_group_link?: string;
  public_phone?: string;
  is_public: boolean;
}

export interface CreateEventInput {
  title: string;
  event_type: LeaderEventType;
  description?: string;
  venue?: string;
  lat: number;
  lng: number;
  starts_at: string;
  ends_at?: string | null;
  is_published: boolean;
}

export interface OwnLeaderEvent {
  id: string;
  title: string;
  event_type: LeaderEventType;
  venue?: string | null;
  starts_at: string;
  is_published: boolean;
  going_count: number;
}

export interface EventRsvpRecord {
  full_name: string;
  phone: string;
  response: RsvpResponseValue;
  note?: string | null;
  created_at: string;
}

export interface WhatsappInterestRecord {
  full_name: string;
  phone: string;
  created_at: string;
}

export type BroadcastChannel = "whatsapp" | "sms" | "both";
export type BroadcastScope = "state" | "lga" | "ward" | "national";

export interface BroadcastInput {
  subject: string;
  body: string;
  channel: BroadcastChannel;
  target_scope: BroadcastScope;
  target_state?: string | null;
  target_lga?: string | null;
  target_ward?: string | null;
  template_name?: string | null;
  dry_run: boolean;
}

export interface BroadcastDryRunResult {
  dry_run: true;
  recipient_count: number;
}

export interface BroadcastSendResult {
  ok: true;
  broadcast_id: string;
  recipient_count: number;
  sent: number;
  failed: number;
  whatsapp_configured: boolean;
  sms_configured: boolean;
}
