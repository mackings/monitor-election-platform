import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "default" | "warning" | "danger" | "success";
}

const TONE_STYLES: Record<NonNullable<StatTileProps["tone"]>, string> = {
  default: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  danger: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

export function StatTile({ label, value, icon: Icon, tone = "default" }: StatTileProps) {
  return (
    <Card className="rounded-2xl border-slate-200/70 shadow-sm dark:border-slate-800">
      <CardContent className="flex items-center gap-3.5 py-2">
        <div className={cn("rounded-xl p-2.5", TONE_STYLES[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="font-heading text-2xl font-semibold tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
