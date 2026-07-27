"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/useAuthStore";

export default function RootPage() {
  const router = useRouter();
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
    const { user, token } = useAuthStore.getState();
    if (!token || !user) {
      router.replace("/login");
    } else {
      router.replace(user.role === "field_officer" ? "/field" : "/dashboard");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
