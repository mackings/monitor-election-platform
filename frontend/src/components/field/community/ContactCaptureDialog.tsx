"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useCommunityIdentity } from "@/lib/hooks/useCommunityIdentity";

interface ContactCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  submitLabel: string;
  onSubmit: (fullName: string, phone: string) => Promise<void>;
}

/** Captures full name + phone once (pre-filled from whatever was cached
 * last time) and hands it to the caller -- shared by both the RSVP and
 * "Join WhatsApp" flows, which need identical inputs. */
export function ContactCaptureDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  onSubmit,
}: ContactCaptureDialogProps) {
  const { identity, setIdentity } = useCommunityIdentity();
  const [fullName, setFullName] = useState(identity?.full_name ?? "");
  const [phone, setPhone] = useState(identity?.phone ?? "");
  const [submitting, setSubmitting] = useState(false);

  function handleOpenChange(next: boolean) {
    if (next) {
      setFullName(identity?.full_name ?? "");
      setPhone(identity?.phone ?? "");
    }
    onOpenChange(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(fullName, phone);
      setIdentity({ full_name: fullName, phone });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="contact-name">Full name</Label>
              <Input id="contact-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-phone">Phone number</Label>
              <Input
                id="contact-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              className="w-full bg-indigo-600 text-white hover:bg-indigo-500"
              disabled={submitting}
            >
              {submitting ? "Sending…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
