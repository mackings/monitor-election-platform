"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOfficer } from "@/lib/api/officers";
import { toast } from "sonner";
import type { User } from "@/types";

export function EditOfficerDialog({
  officer,
  open,
  onOpenChange,
  onUpdated,
}: {
  officer: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset fields whenever the dialog opens for a (possibly different)
  // officer -- adjusted during render rather than an effect, so a live WS
  // update to `officer` (e.g. a status change) while this is open doesn't
  // clobber whatever the admin is typing, only a genuine open/officer
  // transition does.
  const resetKey = open && officer ? officer.id : null;
  const [lastResetKey, setLastResetKey] = useState<string | null>(null);
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    if (officer) {
      setName(officer.name);
      setPhone(officer.phone);
      setEmail(officer.email ?? "");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!officer) return;
    setSubmitting(true);
    try {
      await updateOfficer(officer.id, { name, phone, email });
      toast.success("Agent details updated");
      onUpdated();
      onOpenChange(false);
    } catch {
      toast.error("Couldn't update this agent. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit agent details</DialogTitle>
            <DialogDescription>Update this agent&apos;s name, phone, or email.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-officer-name">Full name</Label>
              <Input id="edit-officer-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-officer-phone">Phone number</Label>
              <Input id="edit-officer-phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-officer-email">Email</Label>
              <Input
                id="edit-officer-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-indigo-600 text-white hover:bg-indigo-500"
            >
              {submitting ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
