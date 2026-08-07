"use client";

import { useEffect, useRef, useState } from "react";
import { GoogleMap, Marker, Polyline, useJsApiLoader } from "@react-google-maps/api";
import { formatDistanceToNow } from "date-fns";
import { MapPin, Loader2 } from "lucide-react";
import { useAgentTrail } from "@/lib/hooks/useAgentTrail";
import { useNowTick } from "@/lib/hooks/useNowTick";
import { haversineKm, formatDistanceKm } from "@/lib/geo/distance";
import type { PollingUnit, User } from "@/types";

const AGENT_COLOR = "#4f46e5";
const PU_COLOR = "#0ea5e9";
const MAP_CONTAINER_STYLE = { width: "100%", height: "14rem" };

// A desaturated, low-contrast theme so the agent/PU markers (the only
// saturated color on the map) stay the thing your eye lands on -- matches
// the muted CARTO "light_all" basemap the rest of the app's Leaflet maps
// use (see OyoMap), rather than Google's default saturated road colors.
const MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f4" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#78716c" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#d6d3d1" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#e7e5e4" }] },
  { featureType: "road.arterial", elementType: "labels", stylers: [{ visibility: "simplified" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#dbeafe" }] },
];

/** Rounded to ~11m precision so ordinary GPS jitter between pings doesn't
 * trigger a fresh geocode lookup every 25 seconds -- only a real,
 * meaningful move does. */
function geocodeKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

/** Google always puts a Plus Code first in a reverse-geocode result set
 * when the exact point has no rooftop-precision address -- the real
 * street/place name Google *does* have for the area is still in there,
 * just one or two entries further down (a route, then a neighborhood,
 * etc, each less specific than the last). Skipping past any result whose
 * only type is "plus_code" surfaces that named result instead of the
 * cryptic code. */
function bestAddress(results: google.maps.GeocoderResult[]): string | null {
  const named = results.find((r) => !(r.types.length === 1 && r.types[0] === "plus_code"));
  return named?.formatted_address ?? results[0]?.formatted_address ?? null;
}

/** Resolves a lat/lng to a human-readable address (street name where
 * Google has one) via the Maps JS API's Geocoder, running entirely in the
 * browser once the script is loaded -- no backend round-trip. Best-effort:
 * a failed lookup just leaves the name blank, since the map/coordinates
 * already convey the essential information. */
function usePlaceName(isLoaded: boolean, lat?: number, lng?: number) {
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || lat == null || lng == null) return;
    const key = geocodeKey(lat, lng);
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;

    if (!geocoderRef.current) geocoderRef.current = new google.maps.Geocoder();
    setLoading(true);
    const [roundedLat, roundedLng] = key.split(",").map(Number);
    geocoderRef.current
      .geocode({ location: { lat: roundedLat, lng: roundedLng } })
      .then((res) => setName(bestAddress(res.results)))
      .catch(() => setName(null))
      .finally(() => setLoading(false));
  }, [isLoaded, lat, lng]);

  return { name, loading };
}

interface AgentLiveMapProps {
  officer: User;
  assignedPU?: PollingUnit;
}

/** Google-Maps-backed live tracker for a single agent: shows their current
 * position with a resolved street address, a trail of everywhere they've
 * moved since this panel was opened, and whether they're moving right now
 * or have been stationary for a while. Panel-local by design -- see
 * useAgentTrail for why the trail always starts empty rather than loading
 * prior history. */
export function AgentLiveMap({ officer, assignedPU }: AgentLiveMapProps) {
  // Not read directly -- just forces a re-render every 15s so the
  // "waiting here for Xm" / "last updated Xm ago" text stays accurate
  // between location pings, not only when a new one arrives.
  useNowTick(15000);
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
  });
  const mapRef = useRef<google.maps.Map | null>(null);

  const location = officer.last_location;
  const { points, moving, stationarySinceMs } = useAgentTrail(officer.id, location, officer.last_seen_at);
  const { name: placeName, loading: placeLoading } = usePlaceName(isLoaded, location?.lat, location?.lng);

  // Keeps the live position centered as new pings arrive, without forcing
  // a rezoom every time (a rezoom-on-every-ping map feels like it's
  // fighting anyone trying to pan/zoom it manually to look around).
  useEffect(() => {
    if (mapRef.current && location) mapRef.current.panTo(location);
    // Keyed on lat/lng values, not the location object -- a new object
    // with the same coordinates (e.g. a store update triggered by an
    // unrelated field) must not re-trigger a pan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.lat, location?.lng]);

  const distanceKm =
    location && assignedPU ? haversineKm(location.lat, location.lng, assignedPU.lat, assignedPU.lng) : null;

  if (!location) {
    return (
      <div className="space-y-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span>Location</span>
        </div>
        <p className="text-muted-foreground">No location reported yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
      <div className="flex items-center gap-2 text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" />
        <span>Location</span>
      </div>

      {loadError ? (
        <div className="flex h-56 w-full items-center justify-center rounded-lg bg-slate-50 text-xs text-muted-foreground dark:bg-slate-900">
          Map couldn&apos;t load. Check the Google Maps API key.
        </div>
      ) : !isLoaded ? (
        <div className="flex h-56 w-full items-center justify-center rounded-lg bg-slate-50 text-sm text-muted-foreground dark:bg-slate-900">
          Loading map…
        </div>
      ) : (
        <GoogleMap
          mapContainerStyle={MAP_CONTAINER_STYLE}
          mapContainerClassName="rounded-lg overflow-hidden"
          center={location}
          zoom={16}
          onLoad={(map) => {
            mapRef.current = map;
          }}
          onUnmount={() => {
            mapRef.current = null;
          }}
          options={{
            styles: MAP_STYLE,
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: "greedy",
          }}
        >
          {assignedPU && (
            <>
              <Marker
                position={{ lat: assignedPU.lat, lng: assignedPU.lng }}
                title="Assigned polling unit"
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 7,
                  fillColor: PU_COLOR,
                  fillOpacity: 1,
                  strokeColor: "#ffffff",
                  strokeWeight: 2,
                }}
              />
              <Polyline
                path={[location, { lat: assignedPU.lat, lng: assignedPU.lng }]}
                options={{
                  strokeOpacity: 0,
                  icons: [
                    {
                      icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3, strokeColor: AGENT_COLOR },
                      offset: "0",
                      repeat: "12px",
                    },
                  ],
                }}
              />
            </>
          )}
          {points.length > 1 && (
            <Polyline
              path={points}
              options={{ strokeColor: AGENT_COLOR, strokeOpacity: 0.5, strokeWeight: 3 }}
            />
          )}
          <Marker
            position={location}
            title="Agent's location"
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: AGENT_COLOR,
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            }}
          />
        </GoogleMap>
      )}

      <p className="flex items-start gap-1.5">
        {placeLoading && <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
        <span>{placeName ?? (placeLoading ? "Resolving address…" : "Address unavailable")}</span>
      </p>
      <p>
        {distanceKm != null
          ? `${formatDistanceKm(distanceKm)} from ${assignedPU?.pu_name ?? "assigned PU"}`
          : "Distance to assigned PU unavailable"}
      </p>

      {moving === true && (
        <p className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Moving now
        </p>
      )}
      {moving === false && stationarySinceMs != null && (
        <p className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
          <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
          Waiting here — {formatDistanceToNow(stationarySinceMs)}
        </p>
      )}
      {moving === null && (
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Watching for movement…
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Last updated {formatDistanceToNow(new Date(officer.last_seen_at!), { addSuffix: true })}
      </p>
    </div>
  );
}
