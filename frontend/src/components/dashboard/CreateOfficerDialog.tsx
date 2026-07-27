"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createOfficer, type CreateOfficerResult } from "@/lib/api/auth";
import { UserPlus } from "lucide-react";

interface CreateOfficerDialogProps {
  onCreated?: () => void;
  role?: "field_officer" | "admin";
}

export function CreateOfficerDialog({ onCreated, role = "field_officer" }: CreateOfficerDialogProps) {
  const isAdminInvite = role === "admin";
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [puCode, setPuCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CreateOfficerResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const created = await createOfficer({
        name,
        phone,
        email,
        role,
        assigned_pu_code: isAdminInvite ? undefined : puCode || undefined,
      });
      setResult(created);
      onCreated?.();
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setResult(null);
      setName("");
      setPhone("");
      setEmail("");
      setPuCode("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" className="gap-2 bg-indigo-600 text-white hover:bg-indigo-500" />}>
        <UserPlus className="h-4 w-4" />
        {isAdminInvite ? "Invite admin" : "Add agent"}
      </DialogTrigger>
      <DialogContent>
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle>{isAdminInvite ? "Admin invited" : "Agent created"}</DialogTitle>
              <DialogDescription>
                Share these credentials {isAdminInvite ? "with the new admin" : "with the agent"} now — the
                password won&apos;t be shown again.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-900">
              <p>
                <span className="text-muted-foreground">Username:</span>{" "}
                <span className="font-mono font-medium">{result.Username}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Password:</span>{" "}
                <span className="font-mono font-medium">{result.Password}</span>
              </p>
            </div>
            {result.User.email && (
              <p
                className={`text-sm ${
                  result.EmailSent
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {result.EmailSent
                  ? `Invite emailed to ${result.User.email}.`
                  : `Couldn't send the invite email to ${result.User.email} — share these credentials manually.`}
              </p>
            )}
            <DialogFooter>
              <Button
                className="bg-indigo-600 text-white hover:bg-indigo-500"
                onClick={() => handleOpenChange(false)}
              >
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{isAdminInvite ? "Invite an admin" : "Add field agent"}</DialogTitle>
              <DialogDescription>
                {isAdminInvite
                  ? "Adds a fellow admin to the dashboard with full access."
                  : "Generates login credentials for a new field officer."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone number</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={isAdminInvite ? "admin@example.com" : "agent@example.com"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {!isAdminInvite && (
                <div className="space-y-2">
                  <Label htmlFor="pu">Assigned polling unit code (optional)</Label>
                  <Input
                    id="pu"
                    placeholder="e.g. 30-26-06-001"
                    value={puCode}
                    onChange={(e) => setPuCode(e.target.value)}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="submit"
                className="bg-indigo-600 text-white hover:bg-indigo-500"
                disabled={loading}
              >
                {loading ? "Creating…" : isAdminInvite ? "Invite admin" : "Create agent"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
