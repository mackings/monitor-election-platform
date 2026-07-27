"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useMapStore } from "@/lib/store/useMapStore";
import type { OfficerStatus } from "@/types";

const STATUS_VARIANT: Record<OfficerStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  offline: { label: "Offline", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  distress: { label: "Distress", className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
};

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AgentStatusPanel() {
  const officersMap = useMapStore((s) => s.officers);
  const pollingUnitsMap = useMapStore((s) => s.pollingUnits);
  const officers = useMemo(() => Object.values(officersMap), [officersMap]);

  const sorted = useMemo(
    () =>
      [...officers].sort((a, b) => {
        const rank = { distress: 0, active: 1, offline: 2 };
        return rank[a.status] - rank[b.status];
      }),
    [officers],
  );

  return (
    <Card className="flex h-full flex-col rounded-2xl border-slate-200/70 dark:border-slate-800">
      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-base">Agents ({officers.length})</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full pr-2">
          {sorted.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No agents registered yet.
            </p>
          )}
          <div className="space-y-1">
            {sorted.map((officer) => {
              const assignedPU = officer.assigned_pu_code
                ? pollingUnitsMap[officer.assigned_pu_code]
                : undefined;
              return (
                <div
                  key={officer.id}
                  className="flex items-center gap-3 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-slate-100 text-xs font-semibold dark:bg-slate-800">
                      {initials(officer.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{officer.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {assignedPU?.pu_name ?? officer.assigned_pu_code ?? "Unassigned"}
                    </p>
                  </div>
                  <Badge className={STATUS_VARIANT[officer.status].className} variant="secondary">
                    {STATUS_VARIANT[officer.status].label}
                  </Badge>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
