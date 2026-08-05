"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { bulkCreateOfficers, type BulkOfficerRowResult } from "@/lib/api/auth";
import { parseOfficerCsv, type OfficerCsvRow } from "@/lib/csv";
import { UploadCloud, FileSpreadsheet, CheckCircle2, XCircle, Download } from "lucide-react";
import { toast } from "sonner";

const CSV_TEMPLATE = "name,phone,email,assigned_pu_code\nJane Doe,08012345678,jane@example.com,30-01-01-001\n";

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "agent-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

type Step = "upload" | "preview" | "results";

export function BulkImportOfficersDialog({ onImported }: { onImported?: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<OfficerCsvRow[]>([]);
  const [results, setResults] = useState<BulkOfficerRowResult[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("upload");
    setFileName("");
    setRows([]);
    setResults([]);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    const parsed = parseOfficerCsv(text);
    if (parsed.error) {
      toast.error(parsed.error);
      return;
    }
    setRows(parsed.rows);
    setStep("preview");
  }

  async function handleImport() {
    setSubmitting(true);
    try {
      const { results } = await bulkCreateOfficers(
        rows.map((r) => ({
          name: r.name,
          phone: r.phone,
          email: r.email || undefined,
          assigned_pu_code: r.assigned_pu_code || undefined,
        })),
      );
      setResults(results);
      setStep("results");
      onImported?.();
    } catch {
      toast.error("Couldn't import agents. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.length - successCount;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" variant="outline" className="gap-2 rounded-xl" />}>
        <UploadCloud className="h-4 w-4" />
        Bulk import
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {step === "upload" && (
          <>
            <DialogHeader>
              <DialogTitle>Bulk import agents</DialogTitle>
              <DialogDescription>
                Upload a CSV with columns <code className="font-mono">name, phone, email, assigned_pu_code</code> —
                one row per agent. Export from Excel or Google Sheets as CSV first.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 py-8 text-sm font-medium text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10"
              >
                <FileSpreadsheet className="h-6 w-6" />
                {fileName || "Choose a CSV file"}
              </button>
              <button
                type="button"
                onClick={downloadTemplate}
                className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                <Download className="h-3.5 w-3.5" />
                Download a template CSV
              </button>
            </div>
          </>
        )}

        {step === "preview" && (
          <>
            <DialogHeader>
              <DialogTitle>Review before importing</DialogTitle>
              <DialogDescription>
                {rows.length} agent{rows.length === 1 ? "" : "s"} found in {fileName}. Each row generates its own
                login credentials, same as adding one agent at a time.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-72 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Phone</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">PU code</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-1.5">{r.name || <span className="text-red-500">missing</span>}</td>
                      <td className="px-3 py-1.5">{r.phone || "—"}</td>
                      <td className="px-3 py-1.5">{r.email || "—"}</td>
                      <td className="px-3 py-1.5 font-mono">{r.assigned_pu_code || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("upload")} disabled={submitting}>
                Back
              </Button>
              <Button
                className="bg-indigo-600 text-white hover:bg-indigo-500"
                onClick={handleImport}
                disabled={submitting}
              >
                {submitting ? "Importing…" : `Import ${rows.length} agent${rows.length === 1 ? "" : "s"}`}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "results" && (
          <>
            <DialogHeader>
              <DialogTitle>Import complete</DialogTitle>
              <DialogDescription>
                {successCount} agent{successCount === 1 ? "" : "s"} created
                {failCount > 0 ? `, ${failCount} failed — fix and re-upload just those rows.` : "."} Share each
                agent&apos;s credentials with them now — passwords won&apos;t be shown again.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-80 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.row} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-1.5 align-top">{r.name || `Row ${r.row}`}</td>
                      <td className="px-3 py-1.5">
                        {r.success ? (
                          <div className="flex items-start gap-1.5 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <div className="font-mono">
                              <div>{r.username}</div>
                              <div>{r.password}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-1.5 text-red-600 dark:text-red-400">
                            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span>{r.error}</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DialogFooter>
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
