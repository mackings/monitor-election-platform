import { api } from "./client";
import type { User, PUStatus } from "@/types";

export function listOfficers() {
  return api.get<User[]>("/api/v1/officers");
}

export function assignOfficer(officerId: string, puCode: string) {
  return api.post("/api/v1/officers/assign", { officer_id: officerId, pu_code: puCode });
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
