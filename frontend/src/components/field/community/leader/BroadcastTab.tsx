"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sendBroadcast } from "@/lib/api/rain";
import type { BroadcastChannel, BroadcastDryRunResult, BroadcastScope, BroadcastSendResult } from "@/types/rain";
import { toast } from "sonner";
import { Loader2, Radio } from "lucide-react";

export function BroadcastTab() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState<BroadcastChannel>("both");
  const [scope, setScope] = useState<BroadcastScope>("ward");
  const [targetState, setTargetState] = useState("");
  const [targetLga, setTargetLga] = useState("");
  const [targetWard, setTargetWard] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState<BroadcastDryRunResult | null>(null);
  const [result, setResult] = useState<BroadcastSendResult | null>(null);

  function buildInput(dryRun: boolean) {
    return {
      subject,
      body,
      channel,
      target_scope: scope,
      target_state: scope !== "national" ? targetState || null : null,
      target_lga: scope === "lga" || scope === "ward" ? targetLga || null : null,
      target_ward: scope === "ward" ? targetWard || null : null,
      template_name: null,
      dry_run: dryRun,
    };
  }

  async function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    setPreviewing(true);
    setResult(null);
    try {
      const res = await sendBroadcast(buildInput(true));
      setPreview(res as BroadcastDryRunResult);
    } catch {
      toast.error("Couldn't preview recipients. Try again.");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSend() {
    setSending(true);
    try {
      const res = await sendBroadcast(buildInput(false));
      setResult(res as BroadcastSendResult);
      setPreview(null);
      toast.success("Broadcast sent");
    } catch {
      toast.error("Couldn't send the broadcast. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handlePreview} className="space-y-4">
      <h2 className="text-sm font-semibold">Send a broadcast</h2>
      <div className="space-y-2">
        <Label htmlFor="bc-subject">Subject</Label>
        <Input id="bc-subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="bc-body">Message</Label>
        <Textarea id="bc-body" value={body} onChange={(e) => setBody(e.target.value)} rows={4} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Channel</Label>
          <Select value={channel} onValueChange={(v) => v && setChannel(v as BroadcastChannel)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="both">WhatsApp + SMS</SelectItem>
              <SelectItem value="whatsapp">WhatsApp only</SelectItem>
              <SelectItem value="sms">SMS only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Scope</Label>
          <Select value={scope} onValueChange={(v) => v && setScope(v as BroadcastScope)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="national">National</SelectItem>
              <SelectItem value="state">State</SelectItem>
              <SelectItem value="lga">LGA</SelectItem>
              <SelectItem value="ward">Ward</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {scope !== "national" && (
        <div className="space-y-2">
          <Label htmlFor="bc-state">State</Label>
          <Input id="bc-state" value={targetState} onChange={(e) => setTargetState(e.target.value)} required />
        </div>
      )}
      {(scope === "lga" || scope === "ward") && (
        <div className="space-y-2">
          <Label htmlFor="bc-lga">LGA</Label>
          <Input id="bc-lga" value={targetLga} onChange={(e) => setTargetLga(e.target.value)} required />
        </div>
      )}
      {scope === "ward" && (
        <div className="space-y-2">
          <Label htmlFor="bc-ward">Ward</Label>
          <Input id="bc-ward" value={targetWard} onChange={(e) => setTargetWard(e.target.value)} required />
        </div>
      )}

      {!result && (
        <Button type="submit" disabled={previewing} variant="outline" className="w-full gap-1.5">
          {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
          {previewing ? "Checking recipients…" : "Preview recipients"}
        </Button>
      )}

      {preview && !result && (
        <div className="space-y-2 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
          <p>
            This will reach <span className="font-semibold">{preview.recipient_count}</span> recipients.
          </p>
          <Button
            type="button"
            onClick={handleSend}
            disabled={sending}
            className="w-full bg-indigo-600 text-white hover:bg-indigo-500"
          >
            {sending ? "Sending…" : "Send now"}
          </Button>
        </div>
      )}

      {result && (
        <div className="space-y-1 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <p className="font-medium text-emerald-700 dark:text-emerald-300">Broadcast sent</p>
          <p className="text-muted-foreground">
            {result.sent} sent · {result.failed} failed · {result.recipient_count} recipients
          </p>
        </div>
      )}
    </form>
  );
}
