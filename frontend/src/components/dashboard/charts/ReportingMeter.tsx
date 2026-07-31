"use client";

import { useTheme } from "next-themes";
import { SEQUENTIAL, CHART_INK } from "./palette";

/** Headline meter: statewide reporting completion, same-ramp track (a
 * lighter step of the fill's own hue would be ideal; a neutral gridline
 * gray reads just as clearly here and matches every other progress
 * indicator already in this dashboard). */
export function ReportingMeter({ reporting, total }: { reporting: number; total: number }) {
  const { resolvedTheme } = useTheme();
  const mode = resolvedTheme === "dark" ? "dark" : "light";
  const pct = total > 0 ? (reporting / total) * 100 : 0;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="font-heading text-2xl font-semibold tracking-tight">
          {reporting.toLocaleString()}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">of {total.toLocaleString()} PUs reporting</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: CHART_INK.gridline[mode] }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: SEQUENTIAL.fill[mode] }}
        />
      </div>
      <p className="mt-1 text-right text-xs tabular-nums text-muted-foreground">{pct.toFixed(1)}%</p>
    </div>
  );
}
