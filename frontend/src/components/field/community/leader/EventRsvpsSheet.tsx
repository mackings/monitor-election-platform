"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getEventRsvps, parseApiDate } from "@/lib/api/rain";
import type { EventRsvpRecord, OwnLeaderEvent } from "@/types/rain";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

const RESPONSE_LABEL: Record<string, string> = {
  going: "Going",
  interested: "Interested",
  not_going: "Not going",
};

interface EventRsvpsSheetProps {
  event: OwnLeaderEvent | null;
  onOpenChange: (open: boolean) => void;
}

export function EventRsvpsSheet({ event, onOpenChange }: EventRsvpsSheetProps) {
  const [state, setState] = useState<{ eventId: string; rsvps: EventRsvpRecord[] } | null>(null);

  useEffect(() => {
    if (!event) return;
    let ignore = false;
    getEventRsvps(event.id)
      .then((rsvps) => {
        if (!ignore) setState({ eventId: event.id, rsvps });
      })
      .catch(() => {
        if (!ignore) setState({ eventId: event.id, rsvps: [] });
      });
    return () => {
      ignore = true;
    };
  }, [event]);

  const stale = !event || state?.eventId !== event.id;
  const rsvps = stale ? null : state!.rsvps;

  return (
    <Sheet open={!!event} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        {event && (
          <>
            <SheetHeader>
              <SheetTitle>{event.title}</SheetTitle>
              <SheetDescription>{event.going_count} going</SheetDescription>
            </SheetHeader>
            <div className="p-4">
              {rsvps === null && (
                <div className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              )}
              {rsvps && rsvps.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">No RSVPs yet.</p>
              )}
              <div className="space-y-2">
                {rsvps?.map((r, i) => (
                  <div
                    key={`${r.phone}-${i}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2.5 text-sm dark:border-slate-800"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.phone} · {format(parseApiDate(r.created_at), "d MMM, h:mm a")}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">
                      {RESPONSE_LABEL[r.response] ?? r.response}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
