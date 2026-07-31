"use client";

import { useState } from "react";
import { updateStatus } from "@/lib/api/officers";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { toast } from "sonner";
import type { PUStatus } from "@/types";
import { cn } from "@/lib/utils";
import { Clock, Vote, CheckCircle2, MinusCircle, Loader2, Check } from "lucide-react";

// Plain-language answers to the question "what's happening at your
// polling unit?" -- a short explanation under each label so someone
// unfamiliar with the app's own vocabulary (not just an election-monitoring
// term of art like "no report") can still pick the right one confidently.
const OPTIONS: { value: PUStatus; label: string; hint: string; icon: typeof Clock; tone: string }[] = [
  {
    value: "not_open",
    label: "Voting hasn't started yet",
    hint: "Polls are not open at your unit",
    icon: Clock,
    tone: "text-slate-500",
  },
  {
    value: "voting",
    label: "Voting is happening now",
    hint: "People are casting their votes",
    icon: Vote,
    tone: "text-blue-500",
  },
  {
    value: "completed",
    label: "Voting has finished",
    hint: "Polls are closed at your unit",
    icon: CheckCircle2,
    tone: "text-emerald-500",
  },
  {
    value: "no_report",
    label: "Nothing to update right now",
    hint: "Everything looks normal",
    icon: MinusCircle,
    tone: "text-slate-400",
  },
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
      toast.success("Sent to the dashboard");
    } catch {
      toast.error("Couldn't send. Try again.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="space-y-2">
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
              "flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-all disabled:opacity-60",
              isSelected
                ? "border-indigo-300 bg-indigo-50 shadow-sm dark:border-indigo-500/40 dark:bg-indigo-500/10"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800",
            )}
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800",
              )}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <opt.icon className={cn("h-4 w-4", !isSelected && opt.tone)} />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block text-sm font-semibold",
                  isSelected ? "text-indigo-700 dark:text-indigo-300" : "text-slate-800 dark:text-slate-100",
                )}
              >
                {opt.label}
              </span>
              <span className="block text-xs text-muted-foreground">{opt.hint}</span>
            </span>
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                isSelected ? "border-indigo-600 bg-indigo-600" : "border-slate-300 dark:border-slate-700",
              )}
            >
              {isSelected && <Check className="h-3 w-3 text-white" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
