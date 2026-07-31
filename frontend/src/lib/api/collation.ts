import { api } from "./client";
import type { Result, TallyRow } from "@/types";

export interface SubmitResultInput {
  pu_code: string;
  vote_counts: Record<string, number>;
  total_accredited_voters: number;
  media_ids?: string[];
}

export function submitResult(input: SubmitResultInput) {
  return api.post<Result>("/api/v1/results", input);
}

/** filter scopes the aggregation for drill-down (e.g. level=ward with
 * lga=X for just that LGA's wards); omitted, it aggregates statewide. */
export function getTally(
  level: "pu" | "ward" | "lga" | "state" = "lga",
  filter?: { lga?: string; ward?: string },
) {
  const params = new URLSearchParams({ level });
  if (filter?.lga) params.set("lga", filter.lga);
  if (filter?.ward) params.set("ward", filter.ward);
  return api.get<TallyRow[]>(`/api/v1/results/tally?${params.toString()}`);
}

/** Every submission for a PU (newest first) -- a primary agent and any
 * sub-agents may each have submitted independently. */
export function listResultsByPU(puCode: string) {
  return api.get<Result[]>(`/api/v1/results?pu_code=${encodeURIComponent(puCode)}`);
}

/** Every submission statewide, newest first -- the audit view of where
 * votes came from and who reported them. */
export function listAllResults() {
  return api.get<Result[]>("/api/v1/results");
}

export interface SubmitManualResultInput {
  pu_code: string;
  officer_id: string;
  vote_counts: Record<string, number>;
  total_accredited_voters: number;
}

/** Admin logging a result an officer relayed by SMS/phone -- no media,
 * since there's no photo to attach when it's typed in secondhand. */
export function submitManualResult(input: SubmitManualResultInput) {
  return api.post<Result>("/api/v1/results/manual", input);
}
