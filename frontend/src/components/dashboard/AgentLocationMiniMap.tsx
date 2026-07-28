"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";

const LIGHT_BASEMAP = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const LIGHT_BASEMAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const AGENT_COLOR = "#4f46e5";
const PU_COLOR = "#0ea5e9";

interface Point {
  lat: number;
  lng: number;
}

/** Fits the view to both points on mount. A map mounted inside a sheet
 * that's still animating open measures a 0x0 container, so this defers a
 * frame before touching the map instance rather than sizing it eagerly. */
function FitToPoints({ points }: { points: Point[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    const id = requestAnimationFrame(() => {
      map.invalidateSize();
      if (points.length === 1) {
        map.setView([points[0].lat, points[0].lng], 15);
      } else {
        const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [points, map]);

  return null;
}

interface AgentLocationMiniMapProps {
  agent: Point;
  pu?: Point;
}

export function AgentLocationMiniMap({ agent, pu }: AgentLocationMiniMapProps) {
  const points = pu ? [agent, pu] : [agent];

  return (
    <MapContainer
      center={[agent.lat, agent.lng]}
      zoom={15}
      scrollWheelZoom={false}
      className="h-56 w-full rounded-lg"
    >
      <TileLayer url={LIGHT_BASEMAP} attribution={LIGHT_BASEMAP_ATTRIBUTION} />
      <FitToPoints points={points} />
      {pu && (
        <Polyline
          positions={[
            [agent.lat, agent.lng],
            [pu.lat, pu.lng],
          ]}
          pathOptions={{ color: AGENT_COLOR, weight: 2, dashArray: "4 6", opacity: 0.7 }}
        />
      )}
      <CircleMarker
        center={[agent.lat, agent.lng]}
        radius={8}
        pathOptions={{ color: "#ffffff", weight: 2, fillColor: AGENT_COLOR, fillOpacity: 1 }}
      >
        <Tooltip direction="top" offset={[0, -8]}>
          Agent&apos;s location
        </Tooltip>
      </CircleMarker>
      {pu && (
        <CircleMarker
          center={[pu.lat, pu.lng]}
          radius={7}
          pathOptions={{ color: "#ffffff", weight: 2, fillColor: PU_COLOR, fillOpacity: 1 }}
        >
          <Tooltip direction="top" offset={[0, -8]}>
            Assigned polling unit
          </Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
