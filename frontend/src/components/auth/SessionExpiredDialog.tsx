"use client";

import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/lib/store/useSessionStore";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { LogIn } from "lucide-react";

/** Mounted once inside AuthGuard, so it's present under both the admin
 * dashboard and the field app. Pops up the moment any authenticated
 * request comes back 401 (see client.ts) instead of leaving the screen
 * silently frozen with no explanation -- deliberately not dismissable
 * except by actually logging back in, since there's nothing useful left
 * to do behind it once the token is dead. */
export function SessionExpiredDialog() {
  const expired = useSessionStore((s) => s.expired);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  function handleReLogin() {
    logout();
    router.replace("/login");
  }

  return (
    <Dialog open={expired} onOpenChange={() => {}} disablePointerDismissal>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Your session has expired</DialogTitle>
          <DialogDescription>
            For your security, you&apos;ve been signed out. Log in again to keep going — anything you&apos;d already
            submitted is safe.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={handleReLogin} className="w-full gap-2">
            <LogIn className="h-4 w-4" />
            Log in again
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
