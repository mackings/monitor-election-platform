"use client";

import { useEffect, useState } from "react";
import { getWhatsappInterests, parseApiDate } from "@/lib/api/rain";
import type { WhatsappInterestRecord } from "@/types/rain";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

export function WhatsappInterestsTab() {
  const [interests, setInterests] = useState<WhatsappInterestRecord[] | null>(null);

  useEffect(() => {
    let ignore = false;
    getWhatsappInterests()
      .then((res) => {
        if (!ignore) setInterests(res);
      })
      .catch(() => {
        if (!ignore) setInterests([]);
      });
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">WhatsApp interest</h2>
      {interests === null && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      )}
      {interests?.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nobody has registered interest in your WhatsApp group yet.
        </p>
      )}
      <div className="space-y-2">
        {interests?.map((r, i) => (
          <div
            key={`${r.phone}-${i}`}
            className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2.5 text-sm dark:border-slate-800"
          >
            <p className="truncate font-medium">{r.full_name}</p>
            <p className="shrink-0 text-xs text-muted-foreground">
              {r.phone} · {format(parseApiDate(r.created_at), "d MMM")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
