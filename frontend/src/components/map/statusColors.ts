import type { PUStatus } from "@/types";

export const PU_STATUS_COLOR: Record<PUStatus, string> = {
  not_open: "#94a3b8",
  accrediting: "#8b5cf6",
  voting: "#3b82f6",
  incident: "#ef4444",
  distress: "#f97316",
  completed: "#22c55e",
  counting: "#0891b2",
  no_report: "#475569",
};

export const PU_STATUS_LABEL: Record<PUStatus, string> = {
  not_open: "Not yet open",
  accrediting: "Accreditation in progress",
  voting: "Voting in progress",
  incident: "Incident reported",
  distress: "Agent in distress",
  completed: "Voting completed",
  counting: "Counting in progress",
  no_report: "No report",
};
