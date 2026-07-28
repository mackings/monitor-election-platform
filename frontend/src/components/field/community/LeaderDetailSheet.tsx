"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ContactCaptureDialog } from "./ContactCaptureDialog";
import { leaderEvents, joinWhatsappInterest, rsvpToEvent, directionsUrl, parseApiDate } from "@/lib/api/rain";
import { formatDistanceKm } from "@/lib/geo/distance";
import type { CommunityLeader, LeaderEvent, RsvpResponseValue } from "@/types/rain";
import { format } from "date-fns";
import { toast } from "sonner";
import { MessageCircle, Phone, Navigation, Loader2 } from "lucide-react";

const EVENT_TYPE_LABEL: Record<string, string> = {
  townhall: "Townhall",
  campaign: "Campaign",
  door_to_door: "Door-to-door",
  community: "Community",
  other: "Event",
};

interface LeaderDetailSheetProps {
  leader: CommunityLeader | null;
  onOpenChange: (open: boolean) => void;
}

type PendingAction = { kind: "whatsapp" } | { kind: "rsvp"; event: LeaderEvent; response: RsvpResponseValue };

export function LeaderDetailSheet({ leader, onOpenChange }: LeaderDetailSheetProps) {
  // Keyed by leader id rather than reset synchronously on leader change --
  // stale data (from the previous leader) is treated as "still loading"
  // until the fetch for the current leader resolves, instead of clearing
  // state directly in the effect body.
  const [eventsState, setEventsState] = useState<{ leaderId: string; events: LeaderEvent[] } | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);

  useEffect(() => {
    if (!leader) return;
    let ignore = false;
    leaderEvents(leader.leader_id)
      .then((events) => {
        if (!ignore) setEventsState({ leaderId: leader.leader_id, events });
      })
      .catch(() => {
        if (!ignore) setEventsState({ leaderId: leader.leader_id, events: [] });
      });
    return () => {
      ignore = true;
    };
  }, [leader]);

  const stale = !leader || eventsState?.leaderId !== leader.leader_id;
  const events = stale ? null : eventsState!.events;

  async function handleWhatsapp(fullName: string, phone: string) {
    if (!leader) return;
    try {
      const res = await joinWhatsappInterest({ leader_id: leader.leader_id, full_name: fullName, phone });
      if (res.whatsapp_group_link) {
        toast.success("Opening the WhatsApp group…");
        window.open(res.whatsapp_group_link, "_blank", "noopener,noreferrer");
      } else {
        toast.info("This leader hasn't set up a group yet — your interest has been recorded.");
      }
    } catch {
      toast.error("Couldn't record your interest. Try again.");
    }
  }

  async function handleRsvp(event: LeaderEvent, response: RsvpResponseValue, fullName: string, phone: string) {
    try {
      await rsvpToEvent({ event_id: event.id, full_name: fullName, phone, response });
      toast.success("Your RSVP has been recorded.");
    } catch {
      toast.error("Couldn't record your RSVP. Try again.");
    }
  }

  return (
    <>
      <Sheet open={!!leader} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
          {leader && (
            <>
              <SheetHeader>
                <div className="flex items-start justify-between gap-3 pr-8">
                  <div>
                    <SheetTitle>{leader.name}</SheetTitle>
                    <SheetDescription>{leader.display_title || leader.role}</SheetDescription>
                  </div>
                  <span className="shrink-0 text-sm font-medium text-muted-foreground">
                    {formatDistanceKm(leader.distance_km)}
                  </span>
                </div>
              </SheetHeader>

              <div className="space-y-4 p-4">
                {leader.bio && <p className="text-sm">{leader.bio}</p>}
                {leader.address && <p className="text-sm text-muted-foreground">{leader.address}</p>}

                <div className="flex flex-wrap gap-2">
                  {leader.whatsapp_group_link !== null && leader.whatsapp_group_link !== undefined && (
                    <Button
                      className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500"
                      onClick={() => setPending({ kind: "whatsapp" })}
                    >
                      <MessageCircle className="h-4 w-4" />
                      Join WhatsApp
                    </Button>
                  )}
                  {leader.public_phone && (
                    <Button
                      variant="outline"
                      className="gap-1.5"
                      nativeButton={false}
                      render={<a href={`tel:${leader.public_phone}`} />}
                    >
                      <Phone className="h-4 w-4" />
                      Call
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="gap-1.5"
                    nativeButton={false}
                    render={<a href={directionsUrl(leader.lat, leader.lng, 18)} target="_blank" rel="noopener noreferrer" />}
                  >
                    <Navigation className="h-4 w-4" />
                    Directions
                  </Button>
                </div>

                <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
                  <h3 className="mb-2 text-sm font-semibold">Upcoming events</h3>
                  {events === null && (
                    <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading…
                    </div>
                  )}
                  {events && events.length === 0 && (
                    <p className="text-sm text-muted-foreground">No upcoming events.</p>
                  )}
                  <div className="space-y-3">
                    {events?.map((event) => (
                      <div key={event.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                        <p className="text-sm font-medium">{event.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {EVENT_TYPE_LABEL[event.event_type] ?? event.event_type} ·{" "}
                          {format(parseApiDate(event.starts_at), "EEE d MMM, h:mm a")}
                          {event.venue && ` · ${event.venue}`}
                        </p>
                        <div className="mt-2 flex gap-2">
                          <Button
                            size="sm"
                            className="bg-indigo-600 text-white hover:bg-indigo-500"
                            onClick={() => setPending({ kind: "rsvp", event, response: "going" })}
                          >
                            I&apos;ll be there
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPending({ kind: "rsvp", event, response: "interested" })}
                          >
                            Interested
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ContactCaptureDialog
        open={pending?.kind === "whatsapp"}
        onOpenChange={(open) => !open && setPending(null)}
        title="Join WhatsApp group"
        description="Share your name and phone so the leader knows who's joining."
        submitLabel="Join group"
        onSubmit={handleWhatsapp}
      />
      <ContactCaptureDialog
        open={pending?.kind === "rsvp"}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending?.kind === "rsvp" && pending.response === "going" ? "I'll be there" : "I'm interested"}
        description="Share your name and phone to RSVP."
        submitLabel="Confirm RSVP"
        onSubmit={(fullName, phone) => {
          if (pending?.kind !== "rsvp") return Promise.resolve();
          return handleRsvp(pending.event, pending.response, fullName, phone);
        }}
      />
    </>
  );
}
