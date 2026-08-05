"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MediaUploader } from "@/components/field/MediaUploader";
import { VoiceRecorder } from "@/components/field/VoiceRecorder";
import { PendingSubmissionsList } from "@/components/field/PendingSubmissionsList";
import { useResolvedLocation } from "@/lib/hooks/useResolvedLocation";
import { createIncident } from "@/lib/api/incidents";
import { queueIncident, PENDING_MEDIA_PREFIX } from "@/lib/offline/queue";
import { saveDraft, loadDraft, clearDraft } from "@/lib/offline/draft";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { useAssignedPU } from "@/components/field/AssignedPUContext";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import type { Severity } from "@/types";

const INCIDENT_TYPES = [
  "Vote buying",
  "Violence / fight",
  "Ballot box snatching",
  "Voting not started",
  "Equipment failure",
  "Other",
];

const DRAFT_KEY = "field:draft:incident-report";

interface ReportDraft {
  type: string;
  description: string;
  severity: Severity;
  mediaIds: string[];
  voiceMediaIds: string[];
}

export default function IncidentReportPage() {
  const puCode = useAuthStore((s) => s.user?.assigned_pu_code ?? "");
  const assignedPU = useAssignedPU();
  const { resolve } = useResolvedLocation();
  // Read fresh on every mount (not hoisted to a module-level constant,
  // which would only ever reflect whatever was in storage the first time
  // this module was evaluated) -- each useState only calls its
  // initializer once, on that mount, so the very first render already
  // has the right values and the child uploaders' own mount-time restore
  // (see MediaUploader's initialMediaIds) sees the real list immediately
  // instead of an empty array followed by a late update.
  const draft = loadDraft<ReportDraft>(DRAFT_KEY);
  const [type, setType] = useState(() => draft?.type ?? "");
  const [description, setDescription] = useState(() => draft?.description ?? "");
  const [severity, setSeverity] = useState<Severity>(() => draft?.severity ?? "medium");
  const [mediaIds, setMediaIds] = useState<string[]>(() => draft?.mediaIds ?? []);
  const [voiceMediaIds, setVoiceMediaIds] = useState<string[]>(() => draft?.voiceMediaIds ?? []);
  const [uploading, setUploading] = useState(false);
  const [voiceUploading, setVoiceUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Persists the in-progress draft on every change -- this is what makes
  // "picked a photo, left the page, came back" not lose the attachment:
  // the page's own fields (and the media/voice id lists the uploaders
  // report back via onChange) survive a remount, not just an
  // already-submitted queued item.
  useEffect(() => {
    saveDraft<ReportDraft>(DRAFT_KEY, { type, description, severity, mediaIds, voiceMediaIds });
  }, [type, description, severity, mediaIds, voiceMediaIds]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!puCode) {
      toast.error("You have no assigned polling unit yet.");
      return;
    }
    if (uploading || voiceUploading) {
      toast.error("Still uploading evidence — wait for it to finish before submitting.");
      return;
    }
    setSubmitting(true);
    let lat: number, lng: number, approximate: boolean;
    try {
      ({ lat, lng, approximate } = await resolve(assignedPU));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't get your location.");
      setSubmitting(false);
      return;
    }
    if (approximate) {
      toast.info("Couldn't get your device's GPS — using your assigned polling unit's location instead.");
    }
    const input = {
      pu_code: puCode,
      type,
      description,
      severity,
      media_ids: [...mediaIds, ...voiceMediaIds],
      lat,
      lng,
    };
    function resetForm() {
      setType("");
      setDescription("");
      setSeverity("medium");
      setMediaIds([]);
      setVoiceMediaIds([]);
      // The draft's job ends here -- either it went out live or it's now
      // durably tracked in the offline queue (PendingSubmissionsList),
      // so there's nothing left for the draft copy to preserve.
      clearDraft(DRAFT_KEY);
    }
    try {
      if (input.media_ids.some((id) => id.startsWith(PENDING_MEDIA_PREFIX))) {
        // At least one attachment was captured with no connection and
        // hasn't uploaded yet -- the server has never heard of that id,
        // so sending this live now would fail. Queue the whole report;
        // flushQueue uploads the attachment and submits together once
        // you're back online, in one step.
        await queueIncident(input);
        toast.info("No connection — report saved on this device and will send automatically once you're back online.");
        resetForm();
        return;
      }
      await createIncident(input);
      toast.success("Incident reported to the dashboard");
      resetForm();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error("Couldn't submit the report — the server rejected it. Check the form and try again.");
      } else {
        await queueIncident(input);
        toast.info("No connection — report saved on this device and will send automatically once you're back online.");
        resetForm();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-heading text-lg font-bold tracking-tight">Report an incident</h1>
          <p className="text-xs text-muted-foreground">Flag anything unusual at your polling unit</p>
        </div>
      </div>

      <PendingSubmissionsList kind="incident" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => setType(v ?? "")} required>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select incident type" />
            </SelectTrigger>
            <SelectContent>
              {INCIDENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Severity</Label>
          <Select value={severity} onValueChange={(v) => setSeverity(v as Severity)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">What happened?</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Evidence</Label>
          <MediaUploader
            relatedType="incident"
            initialMediaIds={mediaIds}
            onChange={setMediaIds}
            onUploadingChange={setUploading}
          />
          <VoiceRecorder
            relatedType="incident"
            initialMediaIds={voiceMediaIds}
            onChange={setVoiceMediaIds}
            onUploadingChange={setVoiceUploading}
          />
        </div>

        <Input value={puCode} readOnly className="hidden" />

        <Button
          type="submit"
          className="h-12 w-full rounded-xl bg-indigo-600 text-base font-semibold text-white hover:bg-indigo-500"
          disabled={submitting || uploading || voiceUploading}
        >
          {uploading || voiceUploading ? "Uploading evidence…" : submitting ? "Submitting…" : "Submit report"}
        </Button>
      </form>
    </div>
  );
}
