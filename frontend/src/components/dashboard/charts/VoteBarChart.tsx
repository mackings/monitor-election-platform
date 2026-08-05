"use client";

import { useTheme } from "next-themes";
import { assignCandidateColors } from "./palette";

interface VoteBarChartProps {
  voteCounts: Record<string, number>;
}

// Fixed pixel height for the bar area -- column heights are computed as a
// fraction of this, which needs a concrete value (percentage heights on a
// flex child don't resolve against an auto-height parent).
const BAR_AREA_HEIGHT = 180;

/** Categorical vertical (column) bar chart -- candidate identity is the
 * point, so color is assigned by name (alphabetical, stable) not by
 * current vote rank. Each column is direct-labeled with its raw count
 * above the bar; parties on a PU/ward view are typically few enough for
 * that to stay legible without also needing a share-of-total percentage. */
export function VoteBarChart({ voteCounts }: VoteBarChartProps) {
  const { resolvedTheme } = useTheme();
  const mode = resolvedTheme === "dark" ? "dark" : "light";

  const entries = Object.entries(voteCounts).filter(([, v]) => v > 0);
  if (entries.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No votes recorded yet.</p>;
  }

  const colorMap = assignCandidateColors(entries.map(([name]) => name));
  const sortedByVotes = [...entries].sort((a, b) => b[1] - a[1]);
  const max = sortedByVotes[0]?.[1] ?? 0;

  return (
    <div className="flex items-end justify-around gap-3" style={{ height: BAR_AREA_HEIGHT }}>
      {sortedByVotes.map(([name, votes]) => {
        const color = colorMap.get(name)![mode];
        const barHeight = max > 0 ? Math.max(4, (votes / max) * (BAR_AREA_HEIGHT - 28)) : 4;
        return (
          <div
            key={name}
            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
            title={`${name}: ${votes.toLocaleString()} votes`}
          >
            <span className="text-sm font-semibold tabular-nums">{votes.toLocaleString()}</span>
            <div
              className="w-full max-w-14 rounded-t-md transition-all duration-500"
              style={{ height: barHeight, backgroundColor: color }}
            />
            <span className="flex w-full min-w-0 items-center justify-center gap-1.5 text-xs font-medium">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
              <span className="truncate">{name}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
