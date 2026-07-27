"use client";

import { useCallback, useState } from "react";

interface GeoState {
  lat: number | null;
  lng: number | null;
  error: string | null;
  loading: boolean;
}

/** Turns a raw GeolocationPositionError (or the "not supported"/insecure
 * origin cases) into a message that actually tells the officer what to
 * do, instead of a generic "check your connection" — this has nothing
 * to do with network connectivity. */
function describeGeoError(err: unknown): string {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Location access needs a secure connection (HTTPS). This page was opened over plain HTTP, so the browser blocks location — ask your admin for an HTTPS link.";
  }
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as GeolocationPositionError).code;
    switch (code) {
      case 1: // PERMISSION_DENIED
        return "Location permission was denied. Enable location access for this site in your browser settings and try again.";
      case 2: // POSITION_UNAVAILABLE
        return "Your device couldn't determine its location. Check that GPS/location services are turned on.";
      case 3: // TIMEOUT
        return "Getting your location timed out. Move to an open area and try again.";
    }
  }
  if (err instanceof Error) return err.message;
  return "Couldn't get your location.";
}

interface LocateOptions {
  /** GPS-accurate fix vs. faster network/Wi-Fi-based positioning. Defaults
   * to true (field officers are on phones with real GPS); desktop callers
   * (admin "near me" buttons) should pass false — forcing high accuracy on
   * a machine with no GPS chip makes some OSes report POSITION_UNAVAILABLE
   * instead of falling back to Wi-Fi-based positioning. */
  enableHighAccuracy?: boolean;
  timeoutMs?: number;
}

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ lat: null, lng: null, error: null, loading: false });

  const locate = useCallback((options?: LocateOptions): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        const error = "Geolocation isn't supported on this device/browser.";
        setState((s) => ({ ...s, error }));
        reject(new Error(error));
        return;
      }
      setState((s) => ({ ...s, loading: true, error: null }));
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setState({ lat, lng, error: null, loading: false });
          resolve({ lat, lng });
        },
        (err) => {
          const message = describeGeoError(err);
          setState((s) => ({ ...s, loading: false, error: message }));
          reject(new Error(message));
        },
        {
          enableHighAccuracy: options?.enableHighAccuracy ?? true,
          timeout: options?.timeoutMs ?? 10000,
        },
      );
    });
  }, []);

  return { ...state, locate };
}
