"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface PlaceNode {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: "allied" | "hostile" | "neutral" | "dead";
  tier: "major" | "minor";
  controllerId?: string;
}

interface CharacterOnMap {
  id: string;
  name: string;
  traits: string[];
  cityId: string;
}

interface Movement {
  characterId: string;
  originCityId: string;
  destinationCityId: string;
  departureTick: number;
  arrivalTick: number;
}

interface MapData {
  cities: PlaceNode[];
  characters: CharacterOnMap[];
  movements: Movement[];
}

interface TradeRouteDisplay {
  cityA: string;
  cityB: string;
}

interface StrategicMapProps {
  data: MapData | null;
  viewTick: number;
  factionColors?: Map<string, string>; // controllerId -> faction color
  tradeRoutes?: TradeRouteDisplay[];
  onCityClick?: (cityId: string) => void;
}

const FALLBACK_COLORS: Record<string, string> = {
  allied: "#3b82f6",
  hostile: "#ef4444",
  neutral: "#ffffff",
  dead: "#1e1e1e",
};

const TAIWAN_CENTER: [number, number] = [23.7, 120.96];
const TAIWAN_ZOOM = 8;

export function StrategicMap({ data, viewTick, factionColors, tradeRoutes, onCityClick }: StrategicMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: TAIWAN_CENTER,
      zoom: TAIWAN_ZOOM,
      zoomControl: true,
      attributionControl: false,
    });

    // Dark tile layer
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map);

    layersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers when data changes
  useEffect(() => {
    const layers = layersRef.current;
    if (!layers || !data) return;

    layers.clearLayers();

    const cityCoords = new Map<string, [number, number]>();

    // Draw cities
    for (const city of data.cities) {
      const color = city.status === "dead"
        ? FALLBACK_COLORS.dead
        : (city.controllerId && factionColors?.get(city.controllerId)) ?? FALLBACK_COLORS[city.status] ?? FALLBACK_COLORS.neutral;
      const radius = city.tier === "major" ? 12 : 7;

      cityCoords.set(city.id, [city.lat, city.lng]);

      // Characters at this city
      const charsHere = data.characters.filter((c) => c.cityId === city.id);
      const charNames = charsHere.map((c) => c.name).join("、");

      const circle = L.circleMarker([city.lat, city.lng], {
        radius,
        color,
        fillColor: color,
        fillOpacity: city.status === "dead" ? 0.3 : 0.7,
        weight: city.tier === "major" ? 2 : 1,
      });

      // Tooltip
      const tooltipContent = `<div style="font-size:13px">
        <strong>${city.name}</strong><br/>
        <span style="color:${color}">${statusLabel(city.status)}</span>
        ${charNames ? `<br/><span style="color:#fbbf24">${charNames}</span>` : ""}
      </div>`;

      circle.bindTooltip(tooltipContent, {
        permanent: false,
        direction: "top",
        offset: [0, -radius],
        className: "dark-tooltip",
      });

      if (onCityClick) {
        circle.on("click", () => onCityClick(city.id));
      }

      circle.addTo(layers);

      // City name label
      const label = L.marker([city.lat, city.lng], {
        icon: L.divIcon({
          className: "city-label",
          html: `<span style="color:${color};font-size:${city.tier === "major" ? 12 : 10}px;font-weight:${city.tier === "major" ? 700 : 400};text-shadow:0 0 4px #000,0 0 4px #000">${city.name}</span>`,
          iconSize: [0, 0],
          iconAnchor: [0, -(radius + 6)],
        }),
      });
      label.addTo(layers);
    }

    // Draw movements as animated arrows
    for (const mov of data.movements) {
      const origin = cityCoords.get(mov.originCityId);
      const dest = cityCoords.get(mov.destinationCityId);
      if (!origin || !dest) continue;

      // Calculate current position based on tick progress
      const totalTicks = mov.arrivalTick - mov.departureTick;
      const elapsed = viewTick - mov.departureTick;
      const progress = totalTicks > 0 ? Math.min(1, Math.max(0, elapsed / totalTicks)) : 1;

      // Draw route line (dashed)
      const routeLine = L.polyline([origin, dest], {
        color: "#f59e0b",
        weight: 2,
        dashArray: "6 4",
        opacity: 0.5,
      });
      routeLine.addTo(layers);

      // Draw unit marker at interpolated position
      const currentLat = origin[0] + (dest[0] - origin[0]) * progress;
      const currentLng = origin[1] + (dest[1] - origin[1]) * progress;

      const char = data.characters.find((c) => c.id === mov.characterId);
      const unitMarker = L.circleMarker([currentLat, currentLng], {
        radius: 5,
        color: "#f59e0b",
        fillColor: "#f59e0b",
        fillOpacity: 1,
        weight: 2,
      });

      if (char) {
        unitMarker.bindTooltip(char.name, {
          permanent: false,
          direction: "top",
          className: "dark-tooltip",
        });
      }

      unitMarker.addTo(layers);
    }

    // Draw trade routes as green dashed lines
    if (tradeRoutes) {
      for (const route of tradeRoutes) {
        const a = cityCoords.get(route.cityA);
        const b = cityCoords.get(route.cityB);
        if (!a || !b) continue;

        const tradeLine = L.polyline([a, b], {
          color: "#22c55e",
          weight: 2,
          dashArray: "4 6",
          opacity: 0.5,
        });
        tradeLine.bindTooltip("貿易路線", { permanent: false, className: "dark-tooltip" });
        tradeLine.addTo(layers);
      }
    }
  }, [data, viewTick, onCityClick, tradeRoutes]);

  return (
    <div ref={containerRef} style={styles.container} />
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case "allied": return "友方";
    case "hostile": return "敵方";
    case "neutral": return "中立";
    case "dead": return "廢墟";
    default: return status;
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    minHeight: 0,
    borderRadius: 8,
    overflow: "hidden",
  },
};
