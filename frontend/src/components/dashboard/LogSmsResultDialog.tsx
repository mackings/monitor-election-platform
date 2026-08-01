"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThousandsInput } from "@/components/shared/ThousandsInput";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMapStore } from "@/lib/store/useMapStore";
import { submitManualResult } from "@/lib/api/collation";
import { toast } from "sonner";
import { MessageSquareText, Plus, Trash2 } from "lucide-react";

interface Row {
  id: string;
  candidate: string;
  votes: string;
}

/** For an agent who had no data connection and phoned/texted their result
 * sheet figures in instead of submitting through the app -- an admin logs
 * it here on their behalf, tagged as an SMS-sourced submission (see
 * ResultSource) rather than pretending it came through the app. */
export function LogSmsResultDialog({ onLogged }: { onLogged?: () => void }) {
  const officersMap = useMapStore((s) => s.officers);
  const pollingUnitsMap = useMapStore((s) => s.pollingUnits);
  const officersList = Object.values(officersMap)
    .filter((o) => o.assigned_pu_code)
    .sort((a, b) => a.name.localeCompare(b.name));

  const [open, setOpen] = useState(false);
  const [officerId, setOfficerId] = useState("");
  const [rows, setRows] = useState<Row[]>([{ id: crypto.randomUUID(), candidate: "", votes: "" }]);
  const [accredited, setAccredited] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setOfficerId("");
    setRows([{ id: crypto.randomUUID(), candidate: "", votes: "" }]);
    setAccredited("");
  }

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
    const officer = officersMap[officerId];
    if (!officer?.assigned_pu_code) {
      toast.error("Pick an agent with an assigned polling unit.");
      return;
    }
    const voteCounts: Record<string, number> = {};
    for (const row of rows) {
      if (!row.candidate.trim()) continue;
      voteCounts[row.candidate.trim()] = Number(row.votes) || 0;
    }
    setSubmitting(true);
    try {
      await submitManualResult({
        pu_code: officer.assigned_pu_code,
        officer_id: officerId,
        vote_counts: voteCounts,
        total_accredited_voters: Number(accredited) || 0,
      });
      toast.success("SMS result logged");
      reset();
      setOpen(false);
      onLogged?.();
    } catch {
      toast.error("Couldn't log this result. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" className="gap-1.5 rounded-xl" />}>
        <MessageSquareText className="h-4 w-4" />
        Log SMS result
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Log a result received by SMS</DialogTitle>
            <DialogDescription>
              For when an agent had no data connection and phoned/texted their result sheet figures in
              instead.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Agent</Label>
              <Select value={officerId} onValueChange={(v) => setOfficerId(v ?? "")} required>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select the agent who reported this">
                    {(value: string) => {
                      const o = officersMap[value];
                      if (!o) return null;
                      return `${o.name} — ${pollingUnitsMap[o.assigned_pu_code!]?.pu_name ?? o.assigned_pu_code}`;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {officersList.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name} — {pollingUnitsMap[o.assigned_pu_code!]?.pu_name ?? o.assigned_pu_code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sms-accredited">Total accredited voters</Label>
              <ThousandsInput
                id="sms-accredited"
                className="h-10 text-base font-semibold tabular-nums"
                placeholder="e.g. 1,000"
                value={accredited}
                onChange={setAccredited}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Votes per candidate/party</Label>
              <div className="space-y-2">
                {rows.map((row) => (
                  <div key={row.id} className="flex gap-2">
                    <Input
                      placeholder="e.g. APM"
                      value={row.candidate}
                      onChange={(e) => updateRow(row.id, { candidate: e.target.value })}
                    />
                    <ThousandsInput
                      placeholder="e.g. 1,200"
                      className="h-10 w-28 text-base font-semibold tabular-nums"
                      value={row.votes}
                      onChange={(votes) => updateRow(row.id, { votes })}
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
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={submitting || !officerId}
              className="w-full bg-indigo-600 text-white hover:bg-indigo-500"
            >
              {submitting ? "Logging…" : "Log result"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
