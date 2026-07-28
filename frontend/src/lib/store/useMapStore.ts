import { create } from "zustand";
import type { PollingUnit, PUStatus, User, OfficerStatus, Location } from "@/types";

interface MapState {
  pollingUnits: Record<string, PollingUnit>;
  officers: Record<string, User>;
  setPollingUnits: (pus: PollingUnit[]) => void;
  setOfficers: (officers: User[]) => void;
  updatePUStatus: (puCode: string, status: PUStatus) => void;
  updateOfficerStatus: (officerId: string, status: OfficerStatus, location?: Location) => void;
  updateOfficerLocation: (officerId: string, location: Location, at: string) => void;
  assignOfficerToPU: (officerId: string, puCode: string) => void;
}

export const useMapStore = create<MapState>((set) => ({
  pollingUnits: {},
  officers: {},
  setPollingUnits: (pus) =>
    set({ pollingUnits: Object.fromEntries((pus ?? []).map((pu) => [pu.pu_code, pu])) }),
  setOfficers: (officers) =>
    set({ officers: Object.fromEntries((officers ?? []).map((o) => [o.id, o])) }),
  updatePUStatus: (puCode, status) =>
    set((state) => {
      const existing = state.pollingUnits[puCode];
      if (!existing) return state;
      return {
        pollingUnits: {
          ...state.pollingUnits,
          [puCode]: { ...existing, current_status: status },
        },
      };
    }),
  updateOfficerStatus: (officerId, status, location) =>
    set((state) => {
      const existing = state.officers[officerId];
      if (!existing) return state;
      return {
        officers: {
          ...state.officers,
          [officerId]: {
            ...existing,
            status,
            last_location: location ?? existing.last_location,
          },
        },
      };
    }),
  updateOfficerLocation: (officerId, location, at) =>
    set((state) => {
      const existing = state.officers[officerId];
      if (!existing) return state;
      return {
        officers: {
          ...state.officers,
          [officerId]: { ...existing, last_location: location, last_seen_at: at },
        },
      };
    }),
  // Mirrors the backend's AssignPU: keeps the relationship one-to-one on
  // both sides, so reassigning an officer clears their old PU's
  // back-reference and reassigning a PU clears its old officer's
  // assignment — otherwise either side would keep showing a stale link
  // until the next full refetch.
  assignOfficerToPU: (officerId, puCode) =>
    set((state) => {
      const officer = state.officers[officerId];
      if (!officer) return state;

      const officers = { ...state.officers };
      const pollingUnits = { ...state.pollingUnits };

      const prevPUCode = officer.assigned_pu_code;
      if (prevPUCode && prevPUCode !== puCode && pollingUnits[prevPUCode]) {
        pollingUnits[prevPUCode] = { ...pollingUnits[prevPUCode], assigned_officer_id: undefined };
      }

      const targetPU = pollingUnits[puCode];
      const prevOfficerId = targetPU?.assigned_officer_id;
      if (prevOfficerId && prevOfficerId !== officerId && officers[prevOfficerId]) {
        officers[prevOfficerId] = { ...officers[prevOfficerId], assigned_pu_code: undefined };
      }

      officers[officerId] = { ...officer, assigned_pu_code: puCode };
      if (targetPU) {
        pollingUnits[puCode] = { ...targetPU, assigned_officer_id: officerId };
      }

      return { officers, pollingUnits };
    }),
}));
