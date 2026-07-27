"use client";

import { useState } from "react";
import { updateStatus } from "@/lib/api/officers";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { toast } from "sonner";
import type { PUStatus } from "@/types";
import { cn } from "@/lib/utils";
import { Clock, Vote, CheckCircle2, MinusCircle, Loader2 } from "lucide-react";

const OPTIONS: { value: PUStatus; label: string; icon: typeof Clock; tone: string }[] = [
  { value: "not_open", label: "Not yet open", icon: Clock, tone: "text-slate-500" },
  { value: "voting", label: "Voting in progress", icon: Vote, tone: "text-blue-500" },
  { value: "completed", label: "Voting completed", icon: CheckCircle2, tone: "text-emerald-500" },
  { value: "no_report", label: "No activity to report", icon: MinusCircle, tone: "text-slate-400" },
];

export function StatusSelector() {
  const puCode = useAuthStore((s) => s.user?.assigned_pu_code);
  const [current, setCurrent] = useState<PUStatus | null>(null);
  const [submitting, setSubmitting] = useState<PUStatus | null>(null);

  async function handleSelect(status: PUStatus) {
    if (!puCode) {
      toast.error("You have no assigned polling unit yet.");
      return;
    }
    setSubmitting(status);
    try {
      await updateStatus(puCode, status);
      setCurrent(status);
      toast.success("Status sent to the dashboard");
    } catch {
      toast.error("Couldn't update status. Try again.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {OPTIONS.map((opt) => {
        const isSelected = current === opt.value;
        const isSubmitting = submitting === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={submitting !== null}
            onClick={() => handleSelect(opt.value)}
            className={cn(
              "flex flex-col items-start gap-2 rounded-xl border p-3 text-left text-sm font-medium transition-all disabled:opacity-60",
              isSelected
                ? "border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
            )}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
            ) : (
              <opt.icon className={cn("h-4 w-4", isSelected ? "text-indigo-600 dark:text-indigo-400" : opt.tone)} />
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
