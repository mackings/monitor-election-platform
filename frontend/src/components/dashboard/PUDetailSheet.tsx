"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listActivity, type ActivityRecord } from "@/lib/api/activity";
import { getMediaBatch } from "@/lib/api/media";
import { assignOfficer, assignSubAgent, unassignOfficer } from "@/lib/api/officers";
import { listResultsByPU } from "@/lib/api/collation";
import { buildFeedItem } from "@/lib/activity/feedItem";
import { KIND_ICON, KIND_CHIP } from "@/lib/activity/activityIcons";
import { useMapStore } from "@/lib/store/useMapStore";
import { PU_STATUS_COLOR, PU_STATUS_LABEL } from "@/components/map/statusColors";
import { MediaThumb } from "@/components/dashboard/MediaThumb";
import type { Incident, Media, PollingUnit, Result } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Phone, Loader2, UserPlus, UserMinus, MessageSquareText, ClipboardList } from "lucide-react";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

interface PUDetailSheetProps {
  pu: PollingUnit | null;
  onOpenChange: (open: boolean) => void;
}

interface LoadedData {
  puCode: string;
  records: ActivityRecord[];
  mediaMap: Record<string, Media>;
  results: Result[];
}

export function PUDetailSheet({ pu, onOpenChange }: PUDetailSheetProps) {
  const officersMap = useMapStore((s) => s.officers);
  const pollingUnitsMap = useMapStore((s) => s.pollingUnits);
  const assignOfficerToPU = useMapStore((s) => s.assignOfficerToPU);
  const setOfficerAssignedPU = useMapStore((s) => s.setOfficerAssignedPU);
  const [data, setData] = useState<LoadedData | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignKey, setAssignKey] = useState(0);
  const [subAgentAssigning, setSubAgentAssigning] = useState(false);
  const [subAgentSelectKey, setSubAgentSelectKey] = useState(0);

  // The `pu` prop is a snapshot the parent captured at click time — re-look
  // it up from the store by code so status/assignment changes (from a
  // reassignment we just made, or a live WS update) show up immediately
  // instead of only after the sheet is reopened.
  const activePU = pu ? (pollingUnitsMap[pu.pu_code] ?? pu) : null;
  const assignedOfficer = activePU?.assigned_officer_id ? officersMap[activePU.assigned_officer_id] : undefined;

  const officersList = useMemo(
    () => Object.values(officersMap).sort((a, b) => a.name.localeCompare(b.name)),
    [officersMap],
  );

  // A sub-agent is just any other officer whose assigned_pu_code matches
  // this PU -- there's no separate list stored anywhere, it's derived.
  const subAgents = useMemo(
    () =>
      activePU
        ? officersList.filter((o) => o.assigned_pu_code === activePU.pu_code && o.id !== assignedOfficer?.id)
        : [],
    [officersList, activePU, assignedOfficer],
  );

  // data lags one PU behind while a fetch is in flight — rather than
  // clearing state synchronously at the top of the effect (which the
  // set-state-in-effect lint rule flags, and which caused visible
  // reset-then-repopulate flicker anyway), just treat stale data as
  // "loading" until the fetch for the current PU resolves.
  const stale = data?.puCode !== pu?.pu_code;
  const loading = !!pu && stale;
  const records = stale ? [] : (data?.records ?? []);
  const mediaMap = stale ? {} : (data?.mediaMap ?? {});
  const results = stale ? [] : (data?.results ?? []);

  async function handleAssign(officerId: string) {
    if (!activePU) return;
    setAssigning(true);
    try {
      await assignOfficer(officerId, activePU.pu_code);
      assignOfficerToPU(officerId, activePU.pu_code);
      toast.success(`${officersMap[officerId]?.name ?? "Agent"} assigned to this polling unit.`);
    } catch {
      toast.error("Couldn't assign agent. Try again.");
    } finally {
      setAssigning(false);
      setAssignKey((k) => k + 1);
    }
  }

  async function handleAssignSubAgent(officerId: string) {
    if (!activePU) return;
    setSubAgentAssigning(true);
    try {
      await assignSubAgent(officerId, activePU.pu_code);
      setOfficerAssignedPU(officerId, activePU.pu_code);
      toast.success(`${officersMap[officerId]?.name ?? "Agent"} added as a sub-agent.`);
    } catch {
      toast.error("Couldn't add sub-agent. Try again.");
    } finally {
      setSubAgentAssigning(false);
      setSubAgentSelectKey((k) => k + 1);
    }
  }

  async function handleRemoveSubAgent(officerId: string) {
    try {
      await unassignOfficer(officerId);
      setOfficerAssignedPU(officerId, "");
      toast.success(`${officersMap[officerId]?.name ?? "Agent"} removed as sub-agent.`);
    } catch {
      toast.error("Couldn't remove sub-agent. Try again.");
    }
  }

  useEffect(() => {
    if (!pu) return;
    let ignore = false;

    Promise.all([listActivity({ pu_code: pu.pu_code, limit: 100 }), listResultsByPU(pu.pu_code)]).then(
      async ([recs, results]) => {
        if (ignore) return;

        const mediaIds = new Set<string>();
        for (const r of recs) {
          if (r.type === "incident.created") {
            ((r.payload as Incident).media_ids ?? []).forEach((id) => mediaIds.add(id));
          } else if (r.type === "result.submitted") {
            ((r.payload as Result).media_ids ?? []).forEach((id) => mediaIds.add(id));
          }
        }
        const media = mediaIds.size > 0 ? await getMediaBatch(Array.from(mediaIds)) : [];
        if (ignore) return;
        setData({
          puCode: pu.pu_code,
          records: recs,
          mediaMap: Object.fromEntries(media.map((m) => [m.id, m])),
          results,
        });
      },
    );

    return () => {
      ignore = true;
    };
  }, [pu]);

  return (
    <Sheet open={!!pu} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden sm:max-w-lg">
        {pu && activePU && (
          <>
            <SheetHeader className="border-b border-slate-200 dark:border-slate-800">
              <SheetTitle className="flex items-center justify-between gap-2 pr-8">
                <span className="truncate">{activePU.pu_name}</span>
                <Badge
                  variant="secondary"
                  className="shrink-0"
                  style={{
                    backgroundColor: `${PU_STATUS_COLOR[activePU.current_status]}20`,
                    color: PU_STATUS_COLOR[activePU.current_status],
                  }}
                >
                  {PU_STATUS_LABEL[activePU.current_status]}
                </Badge>
              </SheetTitle>
              <SheetDescription>
                {activePU.ward}, {activePU.lga} · {activePU.pu_code}
              </SheetDescription>
            </SheetHeader>

            <div className="border-b border-slate-200 p-4 dark:border-slate-800">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Assigned agent</p>
              {assignedOfficer ? (
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-slate-100 font-semibold dark:bg-slate-800">
                      {initials(assignedOfficer.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{assignedOfficer.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {assignedOfficer.phone} · {assignedOfficer.status}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="gap-1.5 bg-indigo-600 text-white hover:bg-indigo-500"
                    nativeButton={false}
                    render={<a href={`tel:${assignedOfficer.phone}`} />}
                  >
                    <Phone className="h-3.5 w-3.5" />
                    Call
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No agent assigned to this polling unit.</p>
              )}

              <Select
                key={assignKey}
                onValueChange={(v) => v && handleAssign(v as string)}
                disabled={assigning || officersList.length === 0}
              >
                <SelectTrigger className="mt-3 w-full">
                  {assigning ? (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Assigning…
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                      <SelectValue
                        placeholder={
                          officersList.length === 0
                            ? "No field agents yet"
                            : assignedOfficer
                              ? "Reassign to a different agent"
                              : "Assign an agent"
                        }
                      />
                    </span>
                  )}
                </SelectTrigger>
                <SelectContent>
                  {officersList.map((o) => {
                    const elsewhere =
                      o.assigned_pu_code && o.assigned_pu_code !== activePU.pu_code
                        ? pollingUnitsMap[o.assigned_pu_code]?.pu_name ?? o.assigned_pu_code
                        : null;
                    return (
                      <SelectItem key={o.id} value={o.id} disabled={o.id === assignedOfficer?.id}>
                        {o.name}
                        {elsewhere ? ` (currently at ${elsewhere})` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="border-b border-slate-200 p-4 dark:border-slate-800">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Sub-agents ({subAgents.length})
              </p>
              {subAgents.length > 0 && (
                <div className="mb-2 space-y-2">
                  {subAgents.map((agent) => (
                    <div key={agent.id} className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-slate-100 text-xs font-semibold dark:bg-slate-800">
                          {initials(agent.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{agent.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {agent.phone} · {agent.status}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        nativeButton={false}
                        render={<a href={`tel:${agent.phone}`} />}
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-muted-foreground"
                        onClick={() => handleRemoveSubAgent(agent.id)}
                        title="Remove as sub-agent"
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Select
                key={subAgentSelectKey}
                onValueChange={(v) => v && handleAssignSubAgent(v as string)}
                disabled={subAgentAssigning || officersList.length === 0}
              >
                <SelectTrigger className="w-full">
                  {subAgentAssigning ? (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Adding…
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                      <SelectValue placeholder="Add a sub-agent" />
                    </span>
                  )}
                </SelectTrigger>
                <SelectContent>
                  {officersList
                    .filter((o) => o.id !== assignedOfficer?.id)
                    .map((o) => (
                      <SelectItem key={o.id} value={o.id} disabled={subAgents.some((a) => a.id === o.id)}>
                        {o.name}
                        {subAgents.some((a) => a.id === o.id) ? " (already a sub-agent here)" : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {results.length > 0 && (
              <div className="border-b border-slate-200 p-4 dark:border-slate-800">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <ClipboardList className="h-3.5 w-3.5" />
                  Result submissions ({results.length})
                </p>
                <div className="space-y-2">
                  {results.map((res) => {
                    const submitter = officersMap[res.officer_id];
                    const totalVotes = Object.values(res.vote_counts).reduce((a, b) => a + b, 0);
                    return (
                      <div key={res.id} className="rounded-lg border border-slate-200 p-2.5 text-sm dark:border-slate-800">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate font-medium">{submitter?.name ?? "Unknown agent"}</p>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {res.source === "sms" && (
                              <span
                                className="flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                                title="Logged from an SMS/phone report"
                              >
                                <MessageSquareText className="h-2.5 w-2.5" />
                                SMS
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(res.submitted_at), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {totalVotes} votes across {Object.keys(res.vote_counts).length} candidates ·{" "}
                          {res.total_accredited_voters} accredited
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-hidden p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Activity at this polling unit
              </p>
              <ScrollArea className="h-full pr-2">
                {loading && (
                  <div className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                )}
                {!loading && records.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No activity recorded here yet.
                  </p>
                )}
                <div className="space-y-3 pb-4">
                  {records.map((record) => {
                    const item = buildFeedItem(record.type, record.payload, record.id, record.created_at, {
                      puName: () => pu.pu_name,
                      officerName: (id) => officersMap[id]?.name ?? id,
                    });
                    if (!item) return null;
                    const Icon = KIND_ICON[item.kind];
                    const mediaIds =
                      record.type === "incident.created"
                        ? (record.payload as Incident).media_ids ?? []
                        : record.type === "result.submitted"
                          ? (record.payload as Result).media_ids ?? []
                          : [];
                    const attached = mediaIds.map((id) => mediaMap[id]).filter((m): m is Media => !!m);

                    return (
                      <div key={item.id} className="flex gap-3 text-sm">
                        <span
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${KIND_CHIP[item.kind]}`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{item.label}</p>
                          {item.detail && (
                            <p className="text-xs text-muted-foreground">{item.detail}</p>
                          )}
                          <p className="text-[11px] text-muted-foreground">
                            {formatDistanceToNow(new Date(item.at), { addSuffix: true })}
                          </p>
                          {attached.length > 0 && (
                            <div className="mt-2 flex gap-2 overflow-x-auto">
                              {attached.map((m) => (
                                <MediaThumb key={m.id} media={m} />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
