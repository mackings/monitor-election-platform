"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createLeaderEvent } from "@/lib/api/rain";
import { useGeolocation } from "@/lib/hooks/useGeolocation";
import type { LeaderEventType } from "@/types/rain";
import { toast } from "sonner";
import { Plus, LocateFixed, Loader2 } from "lucide-react";

const EVENT_TYPES: { value: LeaderEventType; label: string }[] = [
  { value: "townhall", label: "Townhall" },
  { value: "campaign", label: "Campaign" },
  { value: "door_to_door", label: "Door-to-door" },
  { value: "community", label: "Community" },
  { value: "other", label: "Other" },
];

export function CreateEventDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<LeaderEventType>("townhall");
  const [description, setDescription] = useState("");
  const [venue, setVenue] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { locate, loading: locating } = useGeolocation();

  function reset() {
    setTitle("");
    setEventType("townhall");
    setDescription("");
    setVenue("");
    setStartsAt("");
    setLat(null);
    setLng(null);
  }

  async function handleUseLocation() {
    try {
      const { lat: la, lng: ln } = await locate({ enableHighAccuracy: false, timeoutMs: 15000 });
      setLat(la);
      setLng(ln);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't get your location.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lat == null || lng == null) {
      toast.error("Set the event's location first.");
      return;
    }
    setSubmitting(true);
    try {
      await createLeaderEvent({
        title,
        event_type: eventType,
        description: description || undefined,
        venue: venue || undefined,
        lat,
        lng,
        starts_at: new Date(startsAt).toISOString(),
        is_published: true,
      });
      toast.success("Event created");
      reset();
      setOpen(false);
      onCreated();
    } catch {
      toast.error("Couldn't create the event. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="gap-1.5 bg-indigo-600 text-white hover:bg-indigo-500" />}>
        <Plus className="h-4 w-4" />
        New event
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New event</DialogTitle>
            <DialogDescription>Published immediately and visible in the public finder.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="event-title">Title</Label>
              <Input id="event-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={eventType} onValueChange={(v) => v && setEventType(v as LeaderEventType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-venue">Venue</Label>
              <Input id="event-venue" value={venue} onChange={(e) => setVenue(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-starts">Starts at</Label>
              <Input
                id="event-starts"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-description">Description</Label>
              <Textarea
                id="event-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Button
                type="button"
                variant="outline"
                onClick={handleUseLocation}
                disabled={locating}
                className="w-full gap-1.5"
              >
                {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                {lat != null ? "Location set" : "Use my current location"}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-indigo-600 text-white hover:bg-indigo-500"
            >
              {submitting ? "Creating…" : "Create event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
