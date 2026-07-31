"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getPollingUnit } from "@/lib/api/pollingUnits";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { useRefetchOnForeground } from "@/lib/hooks/useRefetchOnForeground";
import type { PollingUnit } from "@/types";

const AssignedPUContext = createContext<PollingUnit | null>(null);

/** Resolves the officer's assigned_pu_code (all the auth session carries)
 * to the actual polling unit record, so the field UI can show its real
 * name instead of a bare code. Fetched once here and shared via context
 * so the header and page bodies don't each fetch it separately. */
export function AssignedPUProvider({ children }: { children: React.ReactNode }) {
  const puCode = useAuthStore((s) => s.user?.assigned_pu_code);
  const [pu, setPU] = useState<PollingUnit | null>(null);

  const load = useCallback(() => {
    if (!puCode) return;
    getPollingUnit(puCode)
      .then((result) => setPU(result))
      .catch((err) => {
        // Swallowed from the UI's perspective (callers just see `pu` stay
        // null and fall back to the raw code) but logged so an outage like
        // the backend/DB being down doesn't look identical to "PU not
        // found" when someone's debugging why names aren't showing.
        console.error("Failed to resolve assigned polling unit:", err);
      });
  }, [puCode]);

  useEffect(() => {
    load();
  }, [load]);

  // An officer's phone backgrounding the tab for their whole shift/break is
  // the normal case here, not the exception -- refresh when they come back
  // instead of trusting whatever was current hours ago.
  useRefetchOnForeground(load);

  return <AssignedPUContext.Provider value={pu}>{children}</AssignedPUContext.Provider>;
}

export function useAssignedPU() {
  return useContext(AssignedPUContext);
}
