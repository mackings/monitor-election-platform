import { api } from "./client";

export function reverseGeocode(lat: number, lng: number) {
  return api.get<{ name: string }>(`/api/v1/geo/reverse?lat=${lat}&lng=${lng}`);
}
