"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, getMe, RainApiError } from "@/lib/api/rain";
import { useRainAuthStore } from "@/lib/store/useRainAuthStore";
import { toast } from "sonner";
import { Users } from "lucide-react";

export function LeaderLoginForm() {
  const setSession = useRainAuthStore((s) => s.setSession);
  const setMe = useRainAuthStore((s) => s.setMe);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await login(phone, password);
      setSession(result.access_token, result.user);
      try {
        setMe(await getMe());
      } catch {
        // non-fatal -- permission-gated sections (like Broadcast) just
        // stay hidden until /api/me can be refetched
      }
      toast.success(`Welcome, ${result.user.first_name}`);
    } catch (err) {
      toast.error(err instanceof RainApiError ? err.message : "Couldn't log in. Check your phone and password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-heading text-lg font-bold tracking-tight">Community Leader Login</h1>
          <p className="text-xs text-muted-foreground">
            For registered community leaders only -- a separate account from your agent login.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="leader-phone">Phone number</Label>
          <Input
            id="leader-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="leader-password">Password</Label>
          <Input
            id="leader-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button
          type="submit"
          disabled={submitting}
          className="h-11 w-full rounded-xl bg-emerald-600 text-white hover:bg-emerald-500"
        >
          {submitting ? "Logging in…" : "Log in"}
        </Button>
      </form>
    </div>
  );
}
