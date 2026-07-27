import type { PUStatus } from "@/types";

export const PU_STATUS_COLOR: Record<PUStatus, string> = {
  not_open: "#94a3b8",
  voting: "#3b82f6",
  incident: "#ef4444",
  distress: "#f97316",
  completed: "#22c55e",
  no_report: "#475569",
};

export const PU_STATUS_LABEL: Record<PUStatus, string> = {
  not_open: "Not yet open",
  voting: "Voting in progress",
  incident: "Incident reported",
  distress: "Agent in distress",
  completed: "Completed",
  no_report: "No report",
};
