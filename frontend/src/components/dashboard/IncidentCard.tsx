import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MediaThumb } from "@/components/dashboard/MediaThumb";
import type { Incident, Media, PollingUnit, Severity, User } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, MapPin } from "lucide-react";

const SEVERITY_STYLE: Record<Severity, string> = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  critical: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

interface IncidentCardProps {
  incident: Incident;
  pu?: PollingUnit;
  officer?: User;
  media: Media[];
  onViewPU?: () => void;
}

export function IncidentCard({ incident, pu, officer, media, onViewPU }: IncidentCardProps) {
  return (
    <Card className="rounded-2xl border-slate-200/70 dark:border-slate-800">
      <CardContent className="space-y-3 py-1">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl bg-red-50 p-2 text-red-600 dark:bg-red-500/10 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <p className="font-medium">{incident.type}</p>
              <p className="text-sm text-muted-foreground">{incident.description}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {formatDistanceToNow(new Date(incident.created_at), { addSuffix: true })} ·{" "}
                {incident.lat.toFixed(5)}, {incident.lng.toFixed(5)}
              </p>
            </div>
          </div>
          <Badge variant="secondary" className={`shrink-0 ${SEVERITY_STYLE[incident.severity]}`}>
            {incident.severity}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-2 text-xs dark:border-slate-900">
          <button
            type="button"
            onClick={onViewPU}
            disabled={!pu || !onViewPU}
            className="flex items-center gap-1.5 text-left hover:underline disabled:hover:no-underline"
          >
            <MapPin className="h-3.5 w-3.5 text-slate-400" />
            <span>
              {pu ? (
                <>
                  <span className="font-medium">{pu.pu_name}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {pu.ward}, {pu.lga} · {pu.pu_code}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">{incident.pu_code}</span>
              )}
            </span>
          </button>

          <div className="flex items-center gap-1.5">
            <Avatar className="h-4 w-4">
              <AvatarFallback className="bg-slate-100 text-[9px] dark:bg-slate-800">
                {officer ? initials(officer.name) : "?"}
              </AvatarFallback>
            </Avatar>
            <span className="text-muted-foreground">
              Reported by <span className="font-medium text-foreground">{officer?.name ?? "Unknown officer"}</span>
              {officer?.phone ? ` · ${officer.phone}` : ""}
            </span>
          </div>
        </div>

        {media.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {media.map((m) => (
              <MediaThumb key={m.id} media={m} size="sm" />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
