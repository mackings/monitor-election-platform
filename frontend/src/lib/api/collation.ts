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

export function getTally(level: "pu" | "ward" | "lga" | "state" = "lga") {
  return api.get<TallyRow[]>(`/api/v1/results/tally?level=${level}`);
}
