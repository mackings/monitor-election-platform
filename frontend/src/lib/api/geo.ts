import { api } from "./client";

export function reverseGeocode(lat: number, lng: number) {
  return api.get<{ name: string }>(`/api/v1/geo/reverse?lat=${lat}&lng=${lng}`);
}

/** City-level fallback for when the browser's own Geolocation API is
 * unavailable -- derived server-side from the caller's IP address. */
export function getIPLocation() {
  return api.get<{ lat: number; lng: number; city: string }>("/api/v1/geo/ip-location");
}
