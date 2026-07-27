import { api } from "./client";
import type { PollingUnit, PUOverview } from "@/types";

export function listPollingUnits(params?: { lga?: string; ward?: string }) {
  const q = new URLSearchParams(params as Record<string, string>).toString();
  return api.get<PollingUnit[]>(`/api/v1/polling-units${q ? `?${q}` : ""}`);
}

export function getPollingUnit(code: string) {
  return api.get<PollingUnit>(`/api/v1/polling-units/${code}`);
}

export function getOverview() {
  return api.get<PUOverview>("/api/v1/polling-units/overview");
}
