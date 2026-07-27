"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/useAuthStore";
import type { Role } from "@/types";

/** Client-side route guard. The JWT lives in localStorage (not a cookie),
 * so redirecting has to happen after hydration in the browser rather than
 * in Next.js edge middleware. Hydration status lives in the auth store
 * itself (rather than local component state) so this effect never calls a
 * React state setter directly. */
export function AuthGuard({
  allow,
  children,
}: {
  allow: Role[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, token, hydrated, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!token || !user) {
      router.replace("/login");
      return;
    }
    if (!allow.includes(user.role)) {
      router.replace(user.role === "field_officer" ? "/field" : "/dashboard");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, token, user]);

  if (!hydrated || !token || !user || !allow.includes(user.role)) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
