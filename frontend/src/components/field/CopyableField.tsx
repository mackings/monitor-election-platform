"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

export function CopyableField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — your browser blocked clipboard access.");
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white/60 px-2.5 py-1.5 text-left transition-colors hover:border-indigo-200 hover:bg-indigo-50/50 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-500/10"
    >
      <span className="min-w-0">
        <span className="block text-[10px] font-medium tracking-wide text-slate-400 uppercase dark:text-slate-500">
          {label}
        </span>
        <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
          {value}
        </span>
      </span>
      {copied ? (
        <Check className="h-4 w-4 shrink-0 text-emerald-500" />
      ) : (
        <Copy className="h-4 w-4 shrink-0 text-slate-400" />
      )}
    </button>
  );
}
