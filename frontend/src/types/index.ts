export type Role = "admin" | "supervisor" | "field_officer";

export type OfficerStatus = "offline" | "active" | "distress";

export type PUStatus =
  | "not_open"
  | "accrediting"
  | "voting"
  | "incident"
  | "distress"
  | "completed"
  | "counting"
  | "no_report";

export type Severity = "low" | "medium" | "high" | "critical";

export interface Location {
  lat: number;
  lng: number;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  username: string;
  role: Role;
  assigned_pu_code?: string;
  status: OfficerStatus;
  last_location?: Location;
  last_seen_at?: string;
  disabled?: boolean;
  created_at: string;
}

export interface PollingUnit {
  id: string;
  pu_code: string;
  pu_name: string;
  ward: string;
  lga: string;
  state: string;
  lat: number;
  lng: number;
  yardcode?: string;
  assigned_officer_id?: string;
  current_status: PUStatus;
  updated_at: string;
}

export interface StatusEvent {
  id: string;
  pu_code: string;
  officer_id: string;
  status: PUStatus;
  note?: string;
  created_at: string;
}

export interface Incident {
  id: string;
  pu_code: string;
  officer_id: string;
  type: string;
  description: string;
  media_ids?: string[];
  lat: number;
  lng: number;
  severity: Severity;
  created_at: string;
}

export type ResultSource = "app" | "sms";

export interface Result {
  id: string;
  pu_code: string;
  officer_id: string;
  vote_counts: Record<string, number>;
  total_accredited_voters: number;
  media_ids?: string[];
  verified: boolean;
  source?: ResultSource;
  logged_by_id?: string;
  submitted_at: string;
}

export interface TallyRow {
  key: string;
  vote_counts: Record<string, number>;
  total_accredited_voters: number;
  reporting_units: number;
  total_units: number;
}

export interface PUOverview {
  total_pus: number;
  unassigned: number;
  status_counts: Partial<Record<PUStatus, number>>;
}

export interface PresignedUpload {
  upload_url: string;
  object_key: string;
  public_url: string;
  expires_in_seconds: number;
}

export interface Media {
  id: string;
  object_key: string;
  url: string;
  content_type: string;
  uploaded_by: string;
  related_type?: "incident" | "result";
  related_id?: string;
  sha256?: string;
  captured_at?: string;
  captured_lat?: number;
  captured_lng?: number;
  created_at: string;
}

export type WSEventType =
  | "officer.status_changed"
  | "officer.checked_in"
  | "officer.checked_out"
  | "officer.location_updated"
  | "officer.created"
  | "officer.pu_changed"
  | "pu.status_changed"
  | "incident.created"
  | "distress.triggered"
  | "result.submitted";

export interface WSEvent<T = unknown> {
  type: WSEventType;
  payload: T;
}

export interface OfficerStatusPayload {
  officer_id: string;
  status: OfficerStatus;
  location?: Location;
  at: string;
}

export interface DistressPayload {
  officer_id: string;
  pu_code: string;
  location: Location;
  at: string;
}

export interface OfficerLocationPayload {
  officer_id: string;
  pu_code?: string;
  status: OfficerStatus;
  location: Location;
  distance_km?: number;
  at: string;
}

export interface OfficerPUChangedPayload {
  officer_id: string;
  pu_code: string;
}
