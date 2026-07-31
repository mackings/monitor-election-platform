"use client";

import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { SEQUENTIAL } from "./palette";

export interface ReportingItem {
  key: string;
  label: string;
  reporting: number;
  total: number;
}

/** Sequential (single-hue, magnitude) horizontal bar list -- one bar per
 * child unit (every LGA, every ward, every PU depending on the current
 * drill level), sorted by completion, scrollable rather than truncated so
 * every location is actually reachable, not just the top few. Clicking a
 * bar drills into that unit when a level below the current one exists. */
export function ReportingBarChart({
  items,
  onSelect,
}: {
  items: ReportingItem[];
  onSelect?: (key: string) => void;
}) {
  const { resolvedTheme } = useTheme();
  const mode = resolvedTheme === "dark" ? "dark" : "light";
  const fillColor = SEQUENTIAL.fill[mode];

  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No locations at this level.</p>;
  }

  const sorted = [...items].sort((a, b) => {
    const pctA = a.total > 0 ? a.reporting / a.total : 0;
    const pctB = b.total > 0 ? b.reporting / b.total : 0;
    return pctB - pctA;
  });

  return (
    <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
      {sorted.map((item) => {
        const pct = item.total > 0 ? (item.reporting / item.total) * 100 : 0;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect?.(item.key)}
            disabled={!onSelect}
            title={`${item.label}: ${item.reporting} of ${item.total} reporting (${pct.toFixed(0)}%)`}
            className={cn(
              "block w-full rounded-lg px-1 py-1 text-left transition-colors",
              onSelect && "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900",
            )}
          >
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium text-slate-700 dark:text-slate-200">{item.label}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {item.reporting}/{item.total}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: fillColor, borderRadius: "0 4px 4px 0" }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
