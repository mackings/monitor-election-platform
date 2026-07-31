"use client";

import { CheckInButton } from "@/components/field/CheckInButton";
import { StatusSelector } from "@/components/field/StatusSelector";
import { DistressButton } from "@/components/field/DistressButton";
import { CopyableField } from "@/components/field/CopyableField";
import { InstallAppBanner } from "@/components/field/InstallAppBanner";
import { useAssignedPU } from "@/components/field/AssignedPUContext";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  offline: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  distress: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};

export default function FieldHomePage() {
  const user = useAuthStore((s) => s.user);
  const pu = useAssignedPU();
  const status = user?.status ?? "offline";

  return (
    <div className="space-y-5">
      <InstallAppBanner />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-100 to-slate-50 p-3.5 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">My polling unit</p>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize",
              STATUS_STYLE[status],
            )}
          >
            {status}
          </span>
        </div>
        <p className="mt-1 font-heading text-lg font-bold tracking-tight text-slate-900 dark:text-white">
          {pu?.pu_name ?? user?.assigned_pu_code ?? "Not assigned yet"}
        </p>

        {pu && (
          <div className="mt-2 space-y-1.5">
            {pu.yardcode && <CopyableField label="YardCode" value={pu.yardcode} />}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {pu.lga} · {pu.ward}
            </p>
          </div>
        )}

        <div className="mt-2.5">
          <CheckInButton />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
          What&apos;s happening at your polling unit?
        </h2>
        <StatusSelector />
      </div>

      <DistressButton />
    </div>
  );
}
