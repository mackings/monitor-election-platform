"use client";

import { useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { SEQUENTIAL } from "./palette";

export interface PUVoteItem {
  code: string;
  name: string;
  lga: string;
  ward: string;
  /** null = hasn't recorded any votes yet (the "not recording" list). */
  votes: number | null;
}

/** A searchable, scrollable list of polling units -- with a vote count
 * and mini bar when they've reported, or bare (no bar, nothing to
 * compare) when they haven't. One component covers both the "recording"
 * and "not recording" cards since they're the same shape, just with or
 * without a number. */
export function PUVotesList({
  items,
  emptyLabel,
  maxHeightClass = "max-h-96",
  onSelect,
}: {
  items: PUVoteItem[];
  emptyLabel: string;
  maxHeightClass?: string;
  /** When set, each row becomes clickable -- e.g. to open a PU's full detail sheet. */
  onSelect?: (code: string) => void;
}) {
  const [query, setQuery] = useState("");
  const { resolvedTheme } = useTheme();
  const mode = resolvedTheme === "dark" ? "dark" : "light";
  const color = SEQUENTIAL.fill[mode];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.lga.toLowerCase().includes(q) ||
        i.ward.toLowerCase().includes(q),
    );
  }, [items, query]);

  const max = items.length > 0 ? Math.max(...items.map((i) => i.votes ?? 0)) : 0;

  return (
    <div>
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search polling unit, ward, LGA…"
          className="rounded-xl pl-9"
        />
      </div>
      <p className="mb-2 text-xs text-muted-foreground">
        {filtered.length.toLocaleString()} of {items.length.toLocaleString()} shown
      </p>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className={cn(maxHeightClass, "space-y-1 overflow-y-auto pr-1")}>
          {filtered.map((item, i) => (
            <div
              key={item.code}
              onClick={onSelect ? () => onSelect(item.code) : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-900",
                onSelect && "cursor-pointer",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                  item.votes == null
                    ? "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                    : i < 3
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
                )}
              >
                {item.votes != null ? i + 1 : "–"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.ward}
                  {item.ward && item.lga ? ", " : ""}
                  {item.lga}
                </p>
              </div>
              {item.votes != null && (
                <div className="flex w-32 shrink-0 items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${max > 0 ? (item.votes / max) * 100 : 0}%`, backgroundColor: color }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums">
                    {item.votes.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
