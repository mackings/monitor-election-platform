"use client";

import { useMemo, useState } from "react";
import { useMapStore } from "@/lib/store/useMapStore";
import { listOfficers } from "@/lib/api/officers";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreateOfficerDialog } from "@/components/dashboard/CreateOfficerDialog";
import { distinctLGAs, distinctWards } from "@/lib/pollingUnits/filterOptions";
import type { OfficerStatus } from "@/types";

const STATUS_VARIANT: Record<OfficerStatus, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  offline: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  distress: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default function AgentsPage() {
  const officersMap = useMapStore((s) => s.officers);
  const officers = useMemo(() => Object.values(officersMap), [officersMap]);
  const setOfficers = useMapStore((s) => s.setOfficers);
  const pollingUnitsMap = useMapStore((s) => s.pollingUnits);
  const pollingUnits = useMemo(() => Object.values(pollingUnitsMap), [pollingUnitsMap]);

  const [lga, setLga] = useState("all");
  const [ward, setWard] = useState("all");
  const [status, setStatus] = useState<OfficerStatus | "all">("all");

  const lgaOptions = useMemo(() => distinctLGAs(pollingUnits), [pollingUnits]);
  const wardOptions = useMemo(
    () => distinctWards(pollingUnits, lga === "all" ? undefined : lga),
    [pollingUnits, lga],
  );

  const filteredOfficers = useMemo(() => {
    return officers.filter((officer) => {
      const pu = officer.assigned_pu_code ? pollingUnitsMap[officer.assigned_pu_code] : undefined;
      if (lga !== "all" && pu?.lga !== lga) return false;
      if (ward !== "all" && pu?.ward !== ward) return false;
      if (status !== "all" && officer.status !== status) return false;
      return true;
    });
  }, [officers, pollingUnitsMap, lga, ward, status]);

  const filtersActive = lga !== "all" || ward !== "all" || status !== "all";

  function clearFilters() {
    setLga("all");
    setWard("all");
    setStatus("all");
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground">
            {filtersActive
              ? `${filteredOfficers.length} of ${officers.length} agents`
              : `${officers.length} registered field agents`}
          </p>
        </div>
        <CreateOfficerDialog onCreated={() => listOfficers().then(setOfficers)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={lga}
          onValueChange={(v) => {
            setLga(v ?? "all");
            setWard("all");
          }}
        >
          <SelectTrigger className="w-44 rounded-xl">
            <SelectValue placeholder="All LGAs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All LGAs</SelectItem>
            {lgaOptions.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={ward} onValueChange={(v) => setWard(v ?? "all")}>
          <SelectTrigger className="w-44 rounded-xl">
            <SelectValue placeholder="All wards" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All wards</SelectItem>
            {wardOptions.map((w) => (
              <SelectItem key={w} value={w}>
                {w}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={(v) => setStatus((v as OfficerStatus | "all") ?? "all")}>
          <SelectTrigger className="w-40 rounded-xl">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
            <SelectItem value="distress">Distress</SelectItem>
          </SelectContent>
        </Select>

        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      <Card className="rounded-2xl border-slate-200/70 dark:border-slate-800">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Assigned PU</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOfficers.map((officer) => {
                const assignedPU = officer.assigned_pu_code
                  ? pollingUnitsMap[officer.assigned_pu_code]
                  : undefined;
                return (
                  <TableRow key={officer.id}>
                    <TableCell className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="bg-slate-100 text-xs font-semibold dark:bg-slate-800">
                          {initials(officer.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{officer.name}</p>
                        <p className="text-xs text-muted-foreground">{officer.phone}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{officer.username}</TableCell>
                    <TableCell>{assignedPU?.pu_name ?? officer.assigned_pu_code ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={STATUS_VARIANT[officer.status]}>
                        {officer.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {officer.last_seen_at ? new Date(officer.last_seen_at).toLocaleString() : "Never"}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredOfficers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    {filtersActive
                      ? "No agents match these filters."
                      : "No agents yet — add one to get started."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
