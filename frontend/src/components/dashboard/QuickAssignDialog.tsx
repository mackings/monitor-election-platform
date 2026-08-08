"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { quickAssignOfficers, type QuickAssignResult } from "@/lib/api/auth";
import { Zap, Download, Copy, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

function downloadCsv(results: QuickAssignResult[]) {
  const lines = ["username,password", ...results.map((r) => `${r.username},${r.password}`)];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "quick-assign-agents.csv";
  a.click();
  URL.revokeObjectURL(url);
}

async function copyAll(results: QuickAssignResult[]) {
  const text = results.map((r) => `${r.username}\t${r.password}`).join("\n");
  await navigator.clipboard.writeText(text);
  toast.success("Copied to clipboard.");
}

type Step = "form" | "results";

/** Bulk-generates N field officer accounts with no polling unit assigned
 * on purpose -- the whole point is agents pick their own PU the first
 * time they open the field app (the "pick a polling unit" sheet), rather
 * than an admin assigning each one before they even exist. All accounts
 * in a batch share the one password typed here; only the generated
 * username tells them apart on the exported sheet. */
export function QuickAssignDialog({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [count, setCount] = useState("50");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<QuickAssignResult[]>([]);

  function reset() {
    setStep("form");
    setCount("50");
    setPassword("");
    setResults([]);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  const countNum = Number(count);
  const validCount = Number.isInteger(countNum) && countNum >= 1 && countNum <= 200;
  const validPassword = password.length >= 8;

  async function handleGenerate() {
    if (!validCount || !validPassword) return;
    setSubmitting(true);
    try {
      const { results } = await quickAssignOfficers(countNum, password);
      setResults(results);
      setStep("results");
      onCreated?.();
    } catch {
      toast.error("Couldn't generate agents. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" variant="outline" className="gap-2 rounded-xl" />}>
        <Zap className="h-4 w-4" />
        Quick assign
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {step === "form" && (
          <>
            <DialogHeader>
              <DialogTitle>Quick assign agents</DialogTitle>
              <DialogDescription>
                Generates a batch of field agent accounts with no polling unit assigned yet — each agent picks their
                own PU the first time they log in. Every account in this batch shares the password below; only the
                username tells them apart.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="quick-assign-count">How many agents?</Label>
                <Input
                  id="quick-assign-count"
                  type="number"
                  min={1}
                  max={200}
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  aria-invalid={count !== "" && !validCount}
                />
                {count !== "" && !validCount && (
                  <p className="text-xs text-destructive">Enter a number between 1 and 200.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quick-assign-password">Password for this batch</Label>
                <div className="relative">
                  <Input
                    id="quick-assign-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={password !== "" && !validPassword}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {password !== "" && !validPassword && (
                  <p className="text-xs text-destructive">At least 8 characters.</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                className="bg-indigo-600 text-white hover:bg-indigo-500"
                onClick={handleGenerate}
                disabled={submitting || !validCount || !validPassword}
              >
                {submitting ? "Generating…" : `Generate ${validCount ? countNum : ""} agent${countNum === 1 ? "" : "s"}`}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "results" && (
          <>
            <DialogHeader>
              <DialogTitle>{results.length} agents created</DialogTitle>
              <DialogDescription>
                Download or copy these credentials now — the password won&apos;t be shown again. Each agent will be
                asked to pick their polling unit the first time they log in.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-80 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <th className="px-3 py-2 font-medium">Username</th>
                    <th className="px-3 py-2 font-medium">Password</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.username} className="border-t border-slate-100 font-mono dark:border-slate-800">
                      <td className="px-3 py-1.5">{r.username}</td>
                      <td className="px-3 py-1.5">{r.password}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DialogFooter className="sm:justify-between">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => downloadCsv(results)}>
                  <Download className="h-3.5 w-3.5" />
                  Download CSV
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => copyAll(results)}>
                  <Copy className="h-3.5 w-3.5" />
                  Copy all
                </Button>
              </div>
              <Button className="bg-indigo-600 text-white hover:bg-indigo-500" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
