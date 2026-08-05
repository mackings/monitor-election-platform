"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useResolvedLocation } from "@/lib/hooks/useResolvedLocation";
import { triggerDistress } from "@/lib/api/officers";
import { queueDistress } from "@/lib/offline/queue";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { useAssignedPU } from "@/components/field/AssignedPUContext";
import { toast } from "sonner";
import { Radio } from "lucide-react";

export function DistressButton() {
  const { resolve } = useResolvedLocation();
  const assignedPU = useAssignedPU();
  const puCode = useAuthStore((s) => s.user?.assigned_pu_code ?? "");
  const updateLocalStatus = useAuthStore((s) => s.updateLocalStatus);
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleConfirm() {
    setSending(true);
    let lat: number, lng: number, approximate: boolean;
    try {
      ({ lat, lng, approximate } = await resolve(assignedPU));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't get your location.");
      setSending(false);
      return;
    }
    if (approximate) {
      toast.info("Couldn't get your device's GPS — using your assigned polling unit's location instead.");
    }
    try {
      await triggerDistress(puCode, lat, lng);
      updateLocalStatus("distress");
      toast.success("Distress alert sent — supervisors have been notified");
      setOpen(false);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error("Couldn't reach the server to send the alert. Check your connection and try again.");
      } else {
        // Deliberately not the same "saved, will send automatically" info
        // toast the other queued actions get -- for an alert this urgent,
        // implying help is on its way when nobody has actually been
        // notified yet would be actively dangerous. This has to be
        // unambiguous that nothing has gone out, and point to a real
        // fallback (call/text directly) rather than just "try again."
        await queueDistress(puCode, lat, lng);
        updateLocalStatus("distress");
        toast.error(
          "No connection — supervisors have NOT been notified yet. This will send automatically the instant you're back online. If you need help now, call your supervisor directly.",
          { duration: 12000 },
        );
        setOpen(false);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            size="lg"
            className="h-13 w-full gap-2 rounded-xl bg-red-600 text-base font-semibold text-white shadow-sm shadow-red-600/20 hover:bg-red-500"
          />
        }
      >
        <span className="relative flex h-5 w-5 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/40" />
          <Radio className="relative h-5 w-5" />
        </span>
        Distress alert
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send distress alert?</DialogTitle>
          <DialogDescription>
            This immediately notifies supervisors with your live location. Only use this if you
            need urgent help at your polling unit.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={sending}>
            {sending ? "Sending…" : "Yes, send alert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
