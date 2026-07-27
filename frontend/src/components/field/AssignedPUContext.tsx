"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getPollingUnit } from "@/lib/api/pollingUnits";
import { useAuthStore } from "@/lib/store/useAuthStore";
import type { PollingUnit } from "@/types";

const AssignedPUContext = createContext<PollingUnit | null>(null);

/** Resolves the officer's assigned_pu_code (all the auth session carries)
 * to the actual polling unit record, so the field UI can show its real
 * name instead of a bare code. Fetched once here and shared via context
 * so the header and page bodies don't each fetch it separately. */
export function AssignedPUProvider({ children }: { children: React.ReactNode }) {
  const puCode = useAuthStore((s) => s.user?.assigned_pu_code);
  const [pu, setPU] = useState<PollingUnit | null>(null);

  useEffect(() => {
    if (!puCode) return;
    let ignore = false;
    getPollingUnit(puCode)
      .then((result) => {
        if (!ignore) setPU(result);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [puCode]);

  return <AssignedPUContext.Provider value={pu}>{children}</AssignedPUContext.Provider>;
}

export function useAssignedPU() {
  return useContext(AssignedPUContext);
}
