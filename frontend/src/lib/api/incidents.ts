import { api } from "./client";
import type { Incident, Severity } from "@/types";

export interface CreateIncidentInput {
  pu_code: string;
  type: string;
  description: string;
  media_ids?: string[];
  lat: number;
  lng: number;
  severity?: Severity;
}

export function createIncident(input: CreateIncidentInput) {
  return api.post<Incident>("/api/v1/incidents", input);
}

export function listIncidents(params?: { pu_code?: string; limit?: number }) {
  const q = new URLSearchParams(params as Record<string, string>).toString();
  return api.get<Incident[]>(`/api/v1/incidents${q ? `?${q}` : ""}`);
}
