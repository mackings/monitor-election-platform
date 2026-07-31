import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SEVERITY_STYLE } from "@/components/dashboard/IncidentCard";
import type { Incident, PollingUnit, Severity } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, ChevronRight } from "lucide-react";

/** One card per polling unit rather than one per incident -- a PU with
 * several reports (a real, common case: multiple agents/observers flagging
 * the same trouble spot) used to render as several near-identical cards in
 * a row, burying how concentrated the trouble actually was. Clicking opens
 * every incident at that PU in one clean list (IncidentGroupSheet). */
export function IncidentGroupCard({
  puCode,
  pu,
  incidents,
  onClick,
}: {
  puCode: string;
  pu?: PollingUnit;
  incidents: Incident[];
  onClick: () => void;
}) {
  const latest = incidents[0];
  const worst = incidents.reduce<Severity>(
    (acc, i) => (SEVERITY_RANK[i.severity] > SEVERITY_RANK[acc] ? i.severity : acc),
    incidents[0].severity,
  );

  return (
    <Card
      onClick={onClick}
      className="cursor-pointer rounded-2xl border-slate-200/70 transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-slate-800 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10"
    >
      <CardContent className="flex items-center gap-4 py-1">
        <div className="shrink-0 rounded-xl bg-red-50 p-2.5 text-red-600 dark:bg-red-500/10 dark:text-red-400">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{pu?.pu_name ?? puCode}</p>
            {incidents.length > 1 && (
              <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300">
                {incidents.length} incidents
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {pu ? `${pu.ward}, ${pu.lga} · ${pu.pu_code}` : puCode}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            Latest: {latest.type} · {formatDistanceToNow(new Date(latest.created_at), { addSuffix: true })}
          </p>
        </div>
        <Badge variant="secondary" className={`shrink-0 ${SEVERITY_STYLE[worst]}`}>
          {worst}
        </Badge>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
      </CardContent>
    </Card>
  );
}

const SEVERITY_RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2, critical: 3 };
