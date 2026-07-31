"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IncidentCard } from "@/components/dashboard/IncidentCard";
import type { Incident, Media, PollingUnit, User } from "@/types";

export function IncidentGroupSheet({
  puCode,
  pu,
  incidents,
  officers,
  mediaMap,
  onOpenChange,
  onViewPU,
}: {
  puCode: string | null;
  pu?: PollingUnit;
  incidents: Incident[];
  officers: Record<string, User>;
  mediaMap: Record<string, Media>;
  onOpenChange: (open: boolean) => void;
  onViewPU?: () => void;
}) {
  return (
    <Sheet open={!!puCode} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden sm:max-w-lg">
        <SheetHeader className="border-b border-slate-200 dark:border-slate-800">
          <SheetTitle className="truncate">{pu?.pu_name ?? puCode}</SheetTitle>
          <SheetDescription>
            {pu ? `${pu.ward}, ${pu.lga} · ${pu.pu_code}` : puCode} — {incidents.length} incident
            {incidents.length === 1 ? "" : "s"}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-hidden p-4">
          <ScrollArea className="h-full pr-2">
            <div className="space-y-3">
              {incidents.map((incident) => (
                <IncidentCard
                  key={incident.id}
                  incident={incident}
                  pu={pu}
                  officer={officers[incident.officer_id]}
                  media={(incident.media_ids ?? []).map((id) => mediaMap[id]).filter((m): m is Media => !!m)}
                  onViewPU={onViewPU}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
