"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, X } from "lucide-react";
import type { PollingUnit } from "@/types";
import { PU_STATUS_COLOR, PU_STATUS_LABEL } from "@/components/map/statusColors";

interface PUSearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  results: PollingUnit[];
  totalMatches: number;
  onSelect: (pu: PollingUnit) => void;
}

export function PUSearchBar({ query, onQueryChange, results, totalMatches, onSelect }: PUSearchBarProps) {
  const [focused, setFocused] = useState(false);
  const showDropdown = focused && query.trim().length > 0;

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search by location, ward, LGA or PU code…"
          className="rounded-xl pl-9 pr-9"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onQueryChange("")}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-[1000] mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950">
          {results.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No polling units match &quot;{query}&quot;.</p>
          ) : (
            <>
              {results.map((pu) => (
                <button
                  key={pu.pu_code}
                  type="button"
                  onClick={() => onSelect(pu)}
                  className="flex w-full items-start justify-between gap-2 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-slate-50 dark:border-slate-900 dark:hover:bg-slate-900"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{pu.pu_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {pu.ward}, {pu.lga} · {pu.pu_code}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className="shrink-0 text-[10px]"
                    style={{
                      backgroundColor: `${PU_STATUS_COLOR[pu.current_status]}20`,
                      color: PU_STATUS_COLOR[pu.current_status],
                    }}
                  >
                    {PU_STATUS_LABEL[pu.current_status]}
                  </Badge>
                </button>
              ))}
              {totalMatches > results.length && (
                <p className="p-2 text-center text-xs text-muted-foreground">
                  +{totalMatches - results.length} more match{totalMatches - results.length === 1 ? "" : "es"} — refine your search
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
