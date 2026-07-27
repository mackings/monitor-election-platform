"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import { memo, useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import type { PollingUnit } from "@/types";
import { PU_STATUS_COLOR } from "./statusColors";

// A small pulsing "radar ping" marker layered on top of a PU's normal dot
// when something needs an admin's attention (a distress alert or an
// incident) — the dozens of muted dots on the map otherwise make a single
// color change easy to miss, so these get an animated highlight instead.
// Built once (not per-render): there are only ever two possible colors.
function buildPulseIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<span class="relative flex h-4 w-4">
      <span class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style="background-color:${color}"></span>
      <span class="relative inline-flex h-4 w-4 rounded-full ring-2 ring-white" style="background-color:${color}"></span>
    </span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

// Used only until real polling-unit data has loaded.
const FALLBACK_CENTER: [number, number] = [8.0, 3.9];
const FALLBACK_ZOOM = 8;

/** Tight bounding box around the actual seeded PU coordinates (padded a
 * little), rather than a generic rectangle around Oyo State — a rectangle
 * around an irregularly-shaped state always leaks slivers of its
 * neighbors (Benin, Kwara, Ogun, Lagos, Osun...). Fitting to the real data
 * keeps the visible area to just what's actually in Oyo State. */
function boundsFromData(pollingUnits: PollingUnit[]): LatLngBoundsExpression | null {
  if (pollingUnits.length === 0) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const pu of pollingUnits) {
    if (pu.lat < minLat) minLat = pu.lat;
    if (pu.lat > maxLat) maxLat = pu.lat;
    if (pu.lng < minLng) minLng = pu.lng;
    if (pu.lng > maxLng) maxLng = pu.lng;
  }
  const latPad = Math.max((maxLat - minLat) * 0.06, 0.03);
  const lngPad = Math.max((maxLng - minLng) * 0.06, 0.03);
  return [
    [minLat - latPad, minLng - lngPad],
    [maxLat + latPad, maxLng + lngPad],
  ];
}

/** Fits and locks the view to the real data extent once it's loaded.
 * MapContainer only applies bounds-type props at creation time, so a
 * reactive fit has to happen imperatively via the map instance instead. */
function FitToData({ pollingUnits }: { pollingUnits: PollingUnit[] }) {
  const map = useMap();

  useEffect(() => {
    const bounds = boundsFromData(pollingUnits);
    if (!bounds) return;
    const fitZoom = map.getBoundsZoom(bounds);
    map.fitBounds(bounds, { padding: [16, 16] });
    map.setMaxBounds(bounds);
    map.setMinZoom(fitZoom);
  }, [pollingUnits, map]);

  return null;
}

export interface FocusTarget {
  lat: number;
  lng: number;
}

/** Pans/zooms to a specific point on demand — used when a search result
 * is picked. The caller passes a fresh object each time so this fires
 * even when the same PU is selected twice in a row. */
function FlyTo({ target }: { target: FocusTarget | null }) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 14), { duration: 0.8 });
  }, [target, map]);

  return null;
}

const LIGHT_BASEMAP = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const LIGHT_BASEMAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

interface OyoMapProps {
  /** Full PU set. Always rendered as markers — kept stable across
   * re-renders so React never has to mount/unmount thousands of Leaflet
   * layers (that churn, not the filtering itself, is what caused the
   * search box to feel like it was freezing). */
  pollingUnits: PollingUnit[];
  /** When set (e.g. while searching), PU codes NOT in this set are dimmed
   * instead of removed, so the marker count on the map never changes. */
  highlightCodes?: Set<string> | null;
  onSelect?: (pu: PollingUnit) => void;
  selectedCode?: string;
  focusTarget?: FocusTarget | null;
}

// Memoized: the parent dashboard re-renders on every keystroke of the
// search box, but this component's own props (pollingUnits, the
// highlightCodes set, selectedCode, focusTarget) only actually change
// once the search debounce fires. Without this, React would reconcile
// all ~3,400+ CircleMarker children on every keystroke regardless —
// that reconciliation cost was what made the search input feel like it
// was freezing.
export const OyoMap = memo(function OyoMap({
  pollingUnits,
  highlightCodes = null,
  onSelect,
  selectedCode,
  focusTarget = null,
}: OyoMapProps) {
  const distressIcon = useMemo(() => buildPulseIcon(PU_STATUS_COLOR.distress), []);
  const incidentIcon = useMemo(() => buildPulseIcon(PU_STATUS_COLOR.incident), []);
  const alertPUs = useMemo(
    () => pollingUnits.filter((pu) => pu.current_status === "distress" || pu.current_status === "incident"),
    [pollingUnits],
  );

  return (
    <MapContainer
      center={FALLBACK_CENTER}
      zoom={FALLBACK_ZOOM}
      scrollWheelZoom
      preferCanvas
      className="h-full w-full rounded-xl"
    >
      <TileLayer url={LIGHT_BASEMAP} attribution={LIGHT_BASEMAP_ATTRIBUTION} />
      <FitToData pollingUnits={pollingUnits} />
      <FlyTo target={focusTarget} />
      {pollingUnits.map((pu) => {
        const isSelected = pu.pu_code === selectedCode;
        const isDimmed = highlightCodes != null && !highlightCodes.has(pu.pu_code);
        return (
          <CircleMarker
            key={pu.pu_code}
            center={[pu.lat, pu.lng]}
            radius={isSelected ? 9 : 6}
            pathOptions={{
              color: "#ffffff",
              weight: isSelected ? 3 : 1.5,
              fillColor: PU_STATUS_COLOR[pu.current_status],
              fillOpacity: isDimmed ? 0.06 : 0.9,
              opacity: isDimmed ? 0.06 : 1,
            }}
            interactive={!isDimmed}
            eventHandlers={{ click: () => onSelect?.(pu) }}
          />
        );
      })}
      {alertPUs.map((pu) => (
        <Marker
          key={`alert-${pu.pu_code}`}
          position={[pu.lat, pu.lng]}
          icon={pu.current_status === "distress" ? distressIcon : incidentIcon}
          interactive={false}
        />
      ))}
    </MapContainer>
  );
});
