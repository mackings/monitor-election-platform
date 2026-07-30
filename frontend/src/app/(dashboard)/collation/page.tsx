"use client";

import { useEffect, useMemo, useState } from "react";
import { getTally } from "@/lib/api/collation";
import { useMapStore } from "@/lib/store/useMapStore";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LogSmsResultDialog } from "@/components/dashboard/LogSmsResultDialog";
import type { TallyRow } from "@/types";

const LEVELS = [
  { value: "ward", label: "By ward" },
  { value: "lga", label: "By LGA" },
  { value: "state", label: "Statewide" },
  { value: "pu", label: "By polling unit" },
] as const;

export default function CollationPage() {
  const [level, setLevel] = useState<(typeof LEVELS)[number]["value"]>("lga");
  const [rows, setRows] = useState<TallyRow[]>([]);
  const [fetchedLevel, setFetchedLevel] = useState<typeof level | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const loading = fetchedLevel !== level;
  const pollingUnitsMap = useMapStore((s) => s.pollingUnits);

  useEffect(() => {
    let ignore = false;
    getTally(level).then((data) => {
      if (ignore) return;
      setRows(data);
      setFetchedLevel(level);
    });
    return () => {
      ignore = true;
    };
  }, [level, refreshKey]);

  const candidates = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => Object.keys(r.vote_counts ?? {}).forEach((c) => set.add(c)));
    return Array.from(set);
  }, [rows]);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Collation</h1>
          <p className="text-sm text-muted-foreground">
            Running tally from result sheets submitted by field agents.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LogSmsResultDialog onLogged={() => setRefreshKey((k) => k + 1)} />
          <Select value={level} onValueChange={(v) => setLevel(v as typeof level)}>
            <SelectTrigger className="w-44 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEVELS.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="rounded-2xl border-slate-200/70 dark:border-slate-800">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{level === "pu" ? "Polling unit" : level.toUpperCase()}</TableHead>
                {candidates.map((c) => (
                  <TableHead key={c} className="text-right">
                    {c}
                  </TableHead>
                ))}
                <TableHead className="text-right">Accredited voters</TableHead>
                <TableHead className="w-40">Reporting</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="font-medium">
                    {level === "pu" ? (pollingUnitsMap[row.key]?.pu_name ?? row.key) : row.key}
                  </TableCell>
                  {candidates.map((c) => (
                    <TableCell key={c} className="text-right tabular-nums">
                      {row.vote_counts?.[c] ?? 0}
                    </TableCell>
                  ))}
                  <TableCell className="text-right tabular-nums">
                    {row.total_accredited_voters}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={row.total_units ? (row.reporting_units / row.total_units) * 100 : 0}
                        className="h-1.5"
                      />
                      <span className="w-14 shrink-0 text-xs text-muted-foreground">
                        {row.reporting_units}/{row.total_units}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={candidates.length + 3}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No results submitted yet.
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
