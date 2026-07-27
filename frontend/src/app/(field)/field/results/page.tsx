"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MediaUploader } from "@/components/field/MediaUploader";
import { submitResult } from "@/lib/api/collation";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { toast } from "sonner";
import { FileText, Plus, Trash2 } from "lucide-react";

interface Row {
  id: string;
  candidate: string;
  votes: string;
}

export default function ResultEntryPage() {
  const puCode = useAuthStore((s) => s.user?.assigned_pu_code ?? "");
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
    if (mediaIds.length === 0) {
      toast.error("Attach a photo of the result sheet before submitting.");
      return;
    }
    const voteCounts: Record<string, number> = {};
    for (const row of rows) {
      if (!row.candidate.trim()) continue;
      voteCounts[row.candidate.trim()] = Number(row.votes) || 0;
    }
    setSubmitting(true);
    try {
      await submitResult({
        pu_code: puCode,
        vote_counts: voteCounts,
        total_accredited_voters: Number(accredited) || 0,
        media_ids: mediaIds,
      });
      toast.success("Result sheet submitted for collation");
      setRows([{ id: crypto.randomUUID(), candidate: "", votes: "" }]);
      setAccredited("");
      setMediaIds([]);
    } catch {
      toast.error("Couldn't submit results. Try again.");
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
          <MediaUploader relatedType="result" onChange={setMediaIds} onUploadingChange={setUploading} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="accredited">Total accredited voters</Label>
          <Input
            id="accredited"
            type="number"
            inputMode="numeric"
            value={accredited}
            onChange={(e) => setAccredited(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Votes per candidate/party</Label>
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.id} className="flex gap-2">
                <Input
                  placeholder="Party / candidate"
                  value={row.candidate}
                  onChange={(e) => updateRow(row.id, { candidate: e.target.value })}
                />
                <Input
                  placeholder="Votes"
                  type="number"
                  inputMode="numeric"
                  className="w-24"
                  value={row.votes}
                  onChange={(e) => updateRow(row.id, { votes: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
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
            Add candidate
          </Button>
        </div>

        <Button
          type="submit"
          className="h-12 w-full rounded-xl bg-indigo-600 text-base font-semibold text-white hover:bg-indigo-500"
          disabled={submitting || uploading}
        >
          {uploading ? "Uploading evidence…" : submitting ? "Submitting…" : "Submit result"}
        </Button>
      </form>
    </div>
  );
}
