import type { PollingUnit } from "@/types";

export function distinctLGAs(pus: PollingUnit[]): string[] {
  return Array.from(new Set(pus.map((pu) => pu.lga))).sort();
}

export function distinctWards(pus: PollingUnit[], lga?: string): string[] {
  const scoped = lga ? pus.filter((pu) => pu.lga === lga) : pus;
  return Array.from(new Set(scoped.map((pu) => pu.ward))).sort();
}
