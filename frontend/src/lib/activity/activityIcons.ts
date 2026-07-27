import { AlertTriangle, Radio, MapPin, FileText, CheckCircle2 } from "lucide-react";
import type { FeedItem } from "@/lib/store/useIncidentStore";

export type FeedItemKind = FeedItem["kind"];

export const KIND_ICON: Record<FeedItemKind, typeof AlertTriangle> = {
  incident: AlertTriangle,
  distress: Radio,
  status: MapPin,
  result: FileText,
  officer: CheckCircle2,
};

export const KIND_CHIP: Record<FeedItemKind, string> = {
  incident: "bg-red-50 text-red-500 dark:bg-red-500/10",
  distress: "bg-orange-50 text-orange-500 dark:bg-orange-500/10",
  status: "bg-blue-50 text-blue-500 dark:bg-blue-500/10",
  result: "bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10",
  officer: "bg-slate-100 text-slate-500 dark:bg-slate-800",
};

export const KIND_LABEL: Record<FeedItemKind, string> = {
  incident: "Incident",
  distress: "Distress",
  status: "Status change",
  result: "Result submitted",
  officer: "Officer check-in/out",
};
