"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EditOfficerDialog } from "@/components/dashboard/EditOfficerDialog";
import { deleteOfficer, setOfficerDisabled, unassignOfficer } from "@/lib/api/officers";
import type { PollingUnit, User } from "@/types";
import { Phone, Pencil, Trash2, UserMinus, Ban, UserCheck } from "lucide-react";
import { toast } from "sonner";

const AgentLiveMap = dynamic(() => import("./AgentLiveMap").then((m) => m.AgentLiveMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-56 w-full items-center justify-center rounded-lg bg-slate-50 text-sm text-muted-foreground dark:bg-slate-900">
      Loading map…
    </div>
  ),
});

const STATUS_VARIANT: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  offline: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  distress: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

interface AgentDetailSheetProps {
  officer: User | null;
  assignedPU?: PollingUnit;
  onOpenChange: (open: boolean) => void;
  /** Refetches the officer list -- called after a successful edit or
   * delete, matching the same pattern CreateOfficerDialog's onCreated
   * already uses rather than this component owning any store mutation
   * logic itself. */
  onChanged?: () => void;
}

export function AgentDetailSheet({ officer, assignedPU, onOpenChange, onChanged }: AgentDetailSheetProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmDeactivateOpen, setConfirmDeactivateOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [unassigning, setUnassigning] = useState(false);
  const [togglingDisabled, setTogglingDisabled] = useState(false);

  async function handleDelete() {
    if (!officer) return;
    setDeleting(true);
    try {
      await deleteOfficer(officer.id);
      toast.success("Agent removed");
      setConfirmDeleteOpen(false);
      onChanged?.();
      onOpenChange(false);
    } catch {
      toast.error("Couldn't remove this agent. Try again.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleUnassign() {
    if (!officer) return;
    setUnassigning(true);
    try {
      await unassignOfficer(officer.id);
      toast.success(`${officer.name} unassigned from their polling unit.`);
      onChanged?.();
    } catch {
      toast.error("Couldn't unassign this agent. Try again.");
    } finally {
      setUnassigning(false);
    }
  }

  async function handleToggleDisabled() {
    if (!officer) return;
    const nextDisabled = !officer.disabled;
    setTogglingDisabled(true);
    try {
      await setOfficerDisabled(officer.id, nextDisabled);
      toast.success(nextDisabled ? `${officer.name} deactivated — they can no longer log in.` : `${officer.name} reactivated.`);
      setConfirmDeactivateOpen(false);
      onChanged?.();
    } catch {
      toast.error("Couldn't update this agent. Try again.");
    } finally {
      setTogglingDisabled(false);
    }
  }

  return (
    <Sheet open={!!officer} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        {officer && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3 pr-8">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="bg-slate-100 font-semibold dark:bg-slate-800">
                    {initials(officer.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="truncate">{officer.name}</SheetTitle>
                  <SheetDescription className="truncate">{officer.username}</SheetDescription>
                  {officer.disabled && (
                    <Badge
                      variant="secondary"
                      className="mt-1 bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    >
                      Deactivated
                    </Badge>
                  )}
                </div>
                <Badge variant="secondary" className={`shrink-0 ${STATUS_VARIANT[officer.status]}`}>
                  {officer.status}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  aria-label="Edit agent"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                  aria-label="Remove agent"
                  onClick={() => setConfirmDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </SheetHeader>

            <div className="space-y-4 p-4">
              <Button
                className="w-full gap-2 bg-indigo-600 text-white hover:bg-indigo-500"
                nativeButton={false}
                render={<a href={`tel:${officer.phone}`} />}
              >
                <Phone className="h-4 w-4" />
                Call {officer.phone}
              </Button>

              <AgentLiveMap officer={officer} assignedPU={assignedPU} />

              <div className="text-sm">
                <p className="text-muted-foreground">Assigned polling unit</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">
                    {assignedPU?.pu_name ?? officer.assigned_pu_code ?? "Unassigned"}
                  </p>
                  {officer.assigned_pu_code && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 gap-1.5 text-muted-foreground"
                      onClick={handleUnassign}
                      disabled={unassigning}
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                      {unassigning ? "Unassigning…" : "Unassign"}
                    </Button>
                  )}
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => (officer.disabled ? handleToggleDisabled() : setConfirmDeactivateOpen(true))}
                disabled={togglingDisabled}
              >
                {officer.disabled ? <UserCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                {togglingDisabled ? "Updating…" : officer.disabled ? "Reactivate agent" : "Deactivate agent"}
              </Button>
            </div>
          </>
        )}
      </SheetContent>

      <EditOfficerDialog
        officer={officer}
        open={editOpen}
        onOpenChange={setEditOpen}
        onUpdated={() => onChanged?.()}
      />

      <Dialog open={confirmDeactivateOpen} onOpenChange={setConfirmDeactivateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate {officer?.name}?</DialogTitle>
            <DialogDescription>
              They won&apos;t be able to log in until you reactivate them. Their account, history, and polling unit
              assignment are all kept as-is — this doesn&apos;t delete anything.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeactivateOpen(false)} disabled={togglingDisabled}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleToggleDisabled} disabled={togglingDisabled}>
              {togglingDisabled ? "Deactivating…" : "Deactivate agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {officer?.name}?</DialogTitle>
            <DialogDescription>
              This permanently deletes their account and unassigns them from their polling unit. Incidents and
              results they already submitted stay on record. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Removing…" : "Remove agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
