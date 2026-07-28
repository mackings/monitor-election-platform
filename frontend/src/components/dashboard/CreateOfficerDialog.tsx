"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { listPollingUnits } from "@/lib/api/pollingUnits";
import type { PollingUnit } from "@/types";
import { UserPlus, X } from "lucide-react";

const MAX_PU_RESULTS = 8;

/** Search-select for the assigned PU: types-and-picks a real polling unit
 * rather than free-typing a code, since a mistyped code used to save
 * silently and just show the raw code forever instead of the PU's name. */
function PUPicker({ value, onChange }: { value: PollingUnit | null; onChange: (pu: PollingUnit | null) => void }) {
  const [allPUs, setAllPUs] = useState<PollingUnit[] | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (allPUs !== null) return;
    listPollingUnits()
      .then(setAllPUs)
      .catch(() => setAllPUs([]));
  }, [allPUs]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !allPUs) return [];
    return allPUs
      .filter((pu) => pu.pu_code.toLowerCase().includes(q) || pu.pu_name.toLowerCase().includes(q))
      .slice(0, MAX_PU_RESULTS);
  }, [query, allPUs]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-input px-3 py-2 text-sm">
        <span className="min-w-0 truncate">
          {value.pu_name} <span className="text-muted-foreground">({value.pu_code})</span>
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Clear selected polling unit"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        id="pu"
        placeholder={allPUs === null ? "Loading polling units…" : "Search by name or code…"}
        value={query}
        disabled={allPUs === null}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-input bg-popover shadow-md">
          {results.map((pu) => (
            <button
              key={pu.pu_code}
              type="button"
              className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-accent"
              onClick={() => {
                onChange(pu);
                setQuery("");
                setOpen(false);
              }}
            >
              {pu.pu_name} <span className="text-muted-foreground">({pu.pu_code})</span>
            </button>
          ))}
        </div>
      )}
      {open && query.trim().length > 0 && results.length === 0 && allPUs !== null && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-input bg-popover px-3 py-2 text-sm text-muted-foreground shadow-md">
          No matching polling unit.
        </div>
      )}
    </div>
  );
}

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
  const [selectedPU, setSelectedPU] = useState<PollingUnit | null>(null);
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
        assigned_pu_code: isAdminInvite ? undefined : (selectedPU?.pu_code ?? undefined),
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
      setSelectedPU(null);
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
                  <Label htmlFor="pu">Assigned polling unit (optional)</Label>
                  <PUPicker value={selectedPU} onChange={setSelectedPU} />
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
