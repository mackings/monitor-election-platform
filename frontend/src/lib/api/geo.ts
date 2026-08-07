import { api } from "./client";

/** City-level fallback for when the browser's own Geolocation API is
 * unavailable -- derived server-side from the caller's IP address. */
export function getIPLocation() {
  return api.get<{ lat: number; lng: number; city: string }>("/api/v1/geo/ip-location");
}
