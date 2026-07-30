"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MediaUploader } from "@/components/field/MediaUploader";
import { VoiceRecorder } from "@/components/field/VoiceRecorder";
import { useResolvedLocation } from "@/lib/hooks/useResolvedLocation";
import { createIncident } from "@/lib/api/incidents";
import { queueIncident } from "@/lib/offline/queue";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/useAuthStore";
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

export default function IncidentReportPage() {
  const puCode = useAuthStore((s) => s.user?.assigned_pu_code ?? "");
  const { resolve } = useResolvedLocation();
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [voiceMediaIds, setVoiceMediaIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [voiceUploading, setVoiceUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      ({ lat, lng, approximate } = await resolve(puCode));
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
    try {
      await createIncident(input);
      toast.success("Incident reported to the dashboard");
      setType("");
      setDescription("");
      setSeverity("medium");
      setMediaIds([]);
      setVoiceMediaIds([]);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error("Couldn't submit the report — the server rejected it. Check the form and try again.");
      } else {
        await queueIncident(input);
        toast.info("No connection — report saved on this device and will send automatically once you're back online.");
        setType("");
        setDescription("");
        setSeverity("medium");
        setMediaIds([]);
        setVoiceMediaIds([]);
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
          <MediaUploader relatedType="incident" onChange={setMediaIds} onUploadingChange={setUploading} />
          <VoiceRecorder relatedType="incident" onChange={setVoiceMediaIds} onUploadingChange={setVoiceUploading} />
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
