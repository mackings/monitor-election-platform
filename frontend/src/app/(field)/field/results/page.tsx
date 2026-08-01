"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThousandsInput } from "@/components/shared/ThousandsInput";
import { VoteSheetUploader } from "@/components/field/VoteSheetUploader";
import { submitResult } from "@/lib/api/collation";
import { queueResult, PENDING_MEDIA_PREFIX } from "@/lib/offline/queue";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { useAssignedPU } from "@/components/field/AssignedPUContext";
import { buildResultSmsBody, buildResultSmsLink, hasSmsCollationNumber } from "@/lib/sms/composeSmsResult";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { FileText, Plus, Trash2, MessageSquareText } from "lucide-react";

interface Row {
  id: string;
  candidate: string;
  votes: string;
}

export default function ResultEntryPage() {
  const puCode = useAuthStore((s) => s.user?.assigned_pu_code ?? "");
  const assignedPU = useAssignedPU();
  const [rows, setRows] = useState<Row[]>([{ id: crypto.randomUUID(), candidate: "", votes: "" }]);
  const [accredited, setAccredited] = useState("");
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((r) => [...r, { id: crypto.randomUUID(), candidate: "", votes: "" }]);
  }

  function removeRow(id: string) {
    setRows((r) => r.filter((row) => row.id !== id));
  }

  const totalVotesEntered = useMemo(() => rows.reduce((sum, r) => sum + (Number(r.votes) || 0), 0), [rows]);
  const accreditedNum = Number(accredited) || 0;
  const votesExceedAccredited = accreditedNum > 0 && totalVotesEntered > accreditedNum;

  function handleSubmitViaSms() {
    if (!puCode) {
      toast.error("You have no assigned polling unit yet.");
      return;
    }
    if (!assignedPU) {
      // Rather than silently fall back to the bare pu_code -- an admin
      // reading the text can't act on a code the way they can a name --
      // just ask for a moment; AssignedPUContext is still resolving it.
      toast.error("Still loading your polling unit info — try again in a moment.");
      return;
    }
    if (!hasSmsCollationNumber()) {
      toast.error("SMS submission isn't set up for this deployment yet.");
      return;
    }
    const body = buildResultSmsBody({ puName: assignedPU.pu_name, accreditedVoters: accredited, voteCounts: rows });
    window.location.href = buildResultSmsLink(body);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!puCode) {
      toast.error("You have no assigned polling unit yet.");
      return;
    }
    if (uploading) {
      toast.error("Still uploading the result sheet photo — wait for it to finish before submitting.");
      return;
    }
    const offline = typeof navigator !== "undefined" && !navigator.onLine;
    if (mediaIds.length === 0 && !offline) {
      toast.error("Attach a photo of the result sheet before submitting.");
      return;
    }
    const voteCounts: Record<string, number> = {};
    for (const row of rows) {
      if (!row.candidate.trim()) continue;
      voteCounts[row.candidate.trim()] = Number(row.votes) || 0;
    }
    const input = {
      pu_code: puCode,
      vote_counts: voteCounts,
      total_accredited_voters: Number(accredited) || 0,
      media_ids: mediaIds,
    };
    function resetForm() {
      setRows([{ id: crypto.randomUUID(), candidate: "", votes: "" }]);
      setAccredited("");
      setMediaIds([]);
    }
    setSubmitting(true);
    try {
      if (mediaIds.some((id) => id.startsWith(PENDING_MEDIA_PREFIX))) {
        // The result-sheet photo was captured with no connection and
        // hasn't uploaded yet -- queue the whole submission; flushQueue
        // uploads the photo and submits together once you're back online.
        await queueResult(input);
        toast.info("No connection — result saved on this device and will send automatically once you're back online.");
        resetForm();
        return;
      }
      await submitResult(input);
      toast.success("Result sheet submitted for collation");
      resetForm();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error("Couldn't submit results — the server rejected it. Check the form and try again.");
      } else {
        await queueResult(input);
        toast.info(
          mediaIds.length === 0
            ? "No connection — figures saved on this device without a photo. They'll send automatically once you're back online; attach the photo in a follow-up report if needed."
            : "No connection — result saved on this device and will send automatically once you're back online.",
        );
        resetForm();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-heading text-lg font-bold tracking-tight">Submit result sheet</h1>
          <p className="text-xs text-muted-foreground">Enter the collated figures from your PU</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>Result sheet photo</Label>
          <VoteSheetUploader puCode={puCode} puName={assignedPU?.pu_name} onChange={setMediaIds} onUploadingChange={setUploading} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="accredited">How many voters were accredited?</Label>
          <ThousandsInput
            id="accredited"
            className="h-11 text-base font-semibold tabular-nums"
            placeholder="e.g. 1,000"
            value={accredited}
            onChange={setAccredited}
            required
          />
        </div>

        <div className="space-y-2">
          <Label>How many votes did each party get?</Label>
          <p className="text-xs text-muted-foreground">
            One row per party — the party&apos;s short name (e.g. APM) and how many votes they got.
          </p>
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.id} className="flex gap-2">
                <Input
                  placeholder="e.g. APM"
                  className="h-11 text-base"
                  value={row.candidate}
                  onChange={(e) => updateRow(row.id, { candidate: e.target.value })}
                />
                <ThousandsInput
                  placeholder="e.g. 1,200"
                  className="h-11 w-28 text-base font-semibold tabular-nums"
                  value={row.votes}
                  onChange={(votes) => updateRow(row.id, { votes })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length === 1}
                >
                  <Trash2 className="h-4 w-4 text-slate-400" />
                </Button>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" className="mt-2 gap-1 rounded-lg" onClick={addRow}>
            <Plus className="h-4 w-4" />
            Add another party
          </Button>

          {totalVotesEntered > 0 && (
            <p
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium",
                votesExceedAccredited
                  ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                  : "bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300",
              )}
            >
              Total votes entered: {totalVotesEntered.toLocaleString()}
              {votesExceedAccredited && " — this is more than the accredited voters above. Double-check the figures."}
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="h-12 w-full rounded-xl bg-indigo-600 text-base font-semibold text-white hover:bg-indigo-500"
          disabled={submitting || uploading}
        >
          {uploading ? "Uploading evidence…" : submitting ? "Submitting…" : "Submit result"}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="w-full gap-1.5"
          onClick={handleSubmitViaSms}
        >
          <MessageSquareText className="h-4 w-4" />
          No connection? Submit via SMS instead
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">
          Opens your phone&apos;s messaging app with the figures filled in — review and send it yourself.
        </p>
      </form>
    </div>
  );
}
