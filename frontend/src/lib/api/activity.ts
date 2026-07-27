import { api } from "./client";
import type { WSEventType } from "@/types";

export interface ActivityRecord {
  id: string;
  type: WSEventType;
  pu_code?: string;
  officer_id?: string;
  payload: unknown;
  created_at: string;
}

export function listActivity(params?: { pu_code?: string; limit?: number }) {
  const q = new URLSearchParams(
    Object.entries(params ?? {}).reduce<Record<string, string>>((acc, [k, v]) => {
      if (v !== undefined) acc[k] = String(v);
      return acc;
    }, {}),
  ).toString();
  return api.get<ActivityRecord[]>(`/api/v1/activity${q ? `?${q}` : ""}`);
}
