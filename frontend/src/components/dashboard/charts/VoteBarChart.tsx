"use client";

import { useTheme } from "next-themes";
import { assignCandidateColors } from "./palette";

interface VoteBarChartProps {
  voteCounts: Record<string, number>;
}

/** Categorical horizontal bar chart -- candidate identity is the point, so
 * color is assigned by name (alphabetical, stable) not by current vote
 * rank, and every bar is direct-labeled since parties on a PU/ward view
 * are typically few enough for that to stay legible. */
export function VoteBarChart({ voteCounts }: VoteBarChartProps) {
  const { resolvedTheme } = useTheme();
  const mode = resolvedTheme === "dark" ? "dark" : "light";

  const entries = Object.entries(voteCounts).filter(([, v]) => v > 0);
  if (entries.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No votes recorded yet.</p>;
  }

  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  const colorMap = assignCandidateColors(entries.map(([name]) => name));
  const sortedByVotes = [...entries].sort((a, b) => b[1] - a[1]);
  const max = sortedByVotes[0]?.[1] ?? 0;

  return (
    <div className="space-y-3">
      {sortedByVotes.map(([name, votes]) => {
        const color = colorMap.get(name)![mode];
        const pct = total > 0 ? (votes / total) * 100 : 0;
        const widthPct = max > 0 ? (votes / max) * 100 : 0;
        return (
          <div key={name}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-1.5 font-medium">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
                <span className="truncate">{name}</span>
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {votes.toLocaleString()} <span className="text-xs">({pct.toFixed(1)}%)</span>
              </span>
            </div>
            <div
              className="h-4 w-full overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800"
              title={`${name}: ${votes.toLocaleString()} votes (${pct.toFixed(1)}%)`}
            >
              <div
                className="h-full transition-all duration-500"
                style={{ width: `${widthPct}%`, backgroundColor: color, borderRadius: "0 4px 4px 0" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
