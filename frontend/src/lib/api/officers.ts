import { api } from "./client";
import type { User, PUStatus } from "@/types";

export function listOfficers() {
  return api.get<User[]>("/api/v1/officers");
}

export function assignOfficer(officerId: string, puCode: string) {
  return api.post("/api/v1/officers/assign", { officer_id: officerId, pu_code: puCode });
}

/** Gives an officer access to submit for a PU without making them its
 * primary -- multiple sub-agents can share a PU with the primary and with
 * each other, for cross-checkable independent submissions. */
export function assignSubAgent(officerId: string, puCode: string) {
  return api.post("/api/v1/officers/assign-sub", { officer_id: officerId, pu_code: puCode });
}

export function unassignOfficer(officerId: string) {
  return api.post("/api/v1/officers/unassign", { officer_id: officerId });
}

export interface UpdateOfficerInput {
  name?: string;
  phone?: string;
  email?: string;
}

export function updateOfficer(officerId: string, patch: UpdateOfficerInput) {
  return api.patch<{ status: string }>(`/api/v1/officers/${officerId}`, patch);
}

/** Removes the officer's account entirely -- clears their assigned PU's
 * back-reference server-side first, so no polling unit is left pointing
 * at an account that no longer exists. Incidents/results they already
 * submitted keep their officer_id as historical record. */
export function deleteOfficer(officerId: string) {
  return api.delete<{ status: string }>(`/api/v1/officers/${officerId}`);
}

export function checkIn(lat: number, lng: number) {
  return api.post("/api/v1/officer/checkin", { lat, lng });
}

export function checkOut() {
  return api.post("/api/v1/officer/checkout");
}

export function updateOfficerLocation(lat: number, lng: number) {
  return api.post("/api/v1/officer/location", { lat, lng });
}

export function updateStatus(puCode: string, status: PUStatus, note?: string) {
  return api.post("/api/v1/officer/status", { pu_code: puCode, status, note });
}

export function triggerDistress(puCode: string, lat: number, lng: number) {
  return api.post("/api/v1/officer/distress", { pu_code: puCode, lat, lng });
}
