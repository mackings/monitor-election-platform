"use client";

import { useEffect, useState } from "react";
import { CreateEventDialog } from "./CreateEventDialog";
import { EventRsvpsSheet } from "./EventRsvpsSheet";
import { listLeaderEvents, parseApiDate } from "@/lib/api/rain";
import type { OwnLeaderEvent } from "@/types/rain";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

const EVENT_TYPE_LABEL: Record<string, string> = {
  townhall: "Townhall",
  campaign: "Campaign",
  door_to_door: "Door-to-door",
  community: "Community",
  other: "Event",
};

export function EventsTab() {
  const [events, setEvents] = useState<OwnLeaderEvent[] | null>(null);
  const [selected, setSelected] = useState<OwnLeaderEvent | null>(null);

  function reload() {
    listLeaderEvents()
      .then(setEvents)
      .catch(() => setEvents([]));
  }

  useEffect(reload, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">My events</h2>
        <CreateEventDialog onCreated={reload} />
      </div>

      {events === null && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      )}
      {events?.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No events yet — create one to invite your community.
        </p>
      )}
      <div className="space-y-2">
        {events?.map((event) => (
          <button
            key={event.id}
            type="button"
            onClick={() => setSelected(event)}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-left text-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/50 dark:border-slate-800 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-500/10"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{event.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {EVENT_TYPE_LABEL[event.event_type] ?? event.event_type} ·{" "}
                {format(parseApiDate(event.starts_at), "EEE d MMM, h:mm a")}
                {event.venue && ` · ${event.venue}`}
              </p>
            </div>
            <span className="shrink-0 text-xs font-medium text-muted-foreground">
              {event.going_count} going
            </span>
          </button>
        ))}
      </div>

      <EventRsvpsSheet event={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}
