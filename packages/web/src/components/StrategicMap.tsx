"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Delaunay } from "d3-delaunay";
import { CHINA_OUTLINE } from "../data/china-outline";

interface PlaceNode {
  id: string;
  name: string;
  description?: string;
  lat: number;
  lng: number;
  status: "allied" | "hostile" | "neutral" | "dead";
  tier: "major" | "minor";
  controllerId?: string;
  siegedBy?: string;
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

type RoadType = "official" | "mountain" | "waterway";

interface RoadDisplay {
  fromCityId: string;
  toCityId: string;
  type: RoadType;
}

interface MapData {
  cities: PlaceNode[];
  characters: CharacterOnMap[];
  movements: Movement[];
  roads?: RoadDisplay[];
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
  supplyStatus?: Record<string, boolean>; // cityId -> true if supplied
  droughtCities?: string[]; // city IDs currently under drought
  roads?: RoadDisplay[];
  highlightCityIds?: Set<string>;
  onCityClick?: (cityId: string) => void;
}

const FALLBACK_COLORS: Record<string, string> = {
  allied: "#3b82f6",
  hostile: "#ef4444",
  neutral: "#ffffff",
  dead: "#1e1e1e",
};

// Faction-specific territory colors
const FACTION_TERRITORY_COLORS: Record<string, string> = {
  liu_bei: "#3b82f6",  // blue (shu)
  cao_cao: "#ef4444",  // red (wei)
  sun_quan: "#22c55e", // green (wu)
  lu_bu: "#a855f7",    // purple
};

const CHINA_CENTER: [number, number] = [33.0, 108.0];
const CHINA_ZOOM = 5;

// Convert China outline from [lng, lat] to [lat, lng] for Leaflet
const CHINA_CLIP_POLYGON: [number, number][] = CHINA_OUTLINE.map(([lng, lat]) => [lat, lng]);

/**
 * Sutherland-Hodgman polygon clipping algorithm.
 * Clips `subject` polygon against `clip` polygon.
 * Both polygons use [lat, lng] coordinate pairs.
 */
function clipPolygon(subject: [number, number][], clip: [number, number][]): [number, number][] {
  let output = subject;

  for (let i = 0; i < clip.length; i++) {
    if (output.length === 0) return [];

    const edgeStart = clip[i];
    const edgeEnd = clip[(i + 1) % clip.length];
    const input = output;
    output = [];

    for (let j = 0; j < input.length; j++) {
      const current = input[j];
      const previous = input[(j + input.length - 1) % input.length];
      const currentInside = isInside(current, edgeStart, edgeEnd);
      const previousInside = isInside(previous, edgeStart, edgeEnd);

      if (currentInside) {
        if (!previousInside) {
          const inter = intersect(previous, current, edgeStart, edgeEnd);
          if (inter) output.push(inter);
        }
        output.push(current);
      } else if (previousInside) {
        const inter = intersect(previous, current, edgeStart, edgeEnd);
        if (inter) output.push(inter);
      }
    }
  }

  return output;
}

function isInside(point: [number, number], edgeStart: [number, number], edgeEnd: [number, number]): boolean {
  return (edgeEnd[0] - edgeStart[0]) * (point[1] - edgeStart[1]) -
         (edgeEnd[1] - edgeStart[1]) * (point[0] - edgeStart[0]) >= 0;
}

function intersect(
  a: [number, number], b: [number, number],
  c: [number, number], d: [number, number],
): [number, number] | null {
  const a1 = b[1] - a[1];
  const b1 = a[0] - b[0];
  const c1 = a1 * a[0] + b1 * a[1];

  const a2 = d[1] - c[1];
  const b2 = c[0] - d[0];
  const c2 = a2 * c[0] + b2 * c[1];

  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1e-10) return null;

  return [(b2 * c1 - b1 * c2) / det, (a1 * c2 - a2 * c1) / det];
}

export function StrategicMap({ data, viewTick, factionColors, tradeRoutes, supplyStatus, droughtCities, roads, highlightCityIds, onCityClick }: StrategicMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: CHINA_CENTER,
      zoom: CHINA_ZOOM,
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

    // Build city coordinate map first (needed for Voronoi and other layers)
    for (const city of data.cities) {
      cityCoords.set(city.id, [city.lat, city.lng]);
    }

    // === Territory polygons (Voronoi) — rendered first (bottom layer) ===
    const liveCities = data.cities.filter((c) => c.status !== "dead");
    if (liveCities.length >= 2) {
      // d3-delaunay uses [x, y] = [lng, lat]
      const points = liveCities.map((c): [number, number] => [c.lng, c.lat]);
      const delaunay = Delaunay.from(points);
      const voronoi = delaunay.voronoi([70, 18, 140, 55]); // bounding box [xmin, ymin, xmax, ymax]

      for (let i = 0; i < liveCities.length; i++) {
        const city = liveCities[i];
        const cellPolygon = voronoi.cellPolygon(i);
        if (!cellPolygon) continue;

        // Convert Voronoi cell from [lng, lat] to [lat, lng] for clipping/Leaflet
        const cellLatLng: [number, number][] = cellPolygon.map(([lng, lat]) => [lat, lng]);

        // Clip to China outline
        const clipped = clipPolygon(cellLatLng, CHINA_CLIP_POLYGON);
        if (clipped.length < 3) continue;

        // Determine territory color
        const controllerId = city.controllerId;
        const territoryColor = controllerId
          ? FACTION_TERRITORY_COLORS[controllerId] ?? factionColors?.get(controllerId) ?? "transparent"
          : "transparent";

        if (territoryColor === "transparent") continue;

        const polygon = L.polygon(clipped as L.LatLngExpression[], {
          color: territoryColor,
          fillColor: territoryColor,
          fillOpacity: 0.2,
          weight: 1,
          opacity: 0.4,
        });
        polygon.addTo(layers);
      }
    }

    // === Road lines (between Voronoi and trade routes) ===
    const roadData = roads ?? data.roads;
    if (roadData) {
      const ROAD_STYLES: Record<RoadType, { color: string; dashArray?: string; weight: number }> = {
        official: { color: "#78716c", weight: 2 },
        mountain: { color: "#92400e", dashArray: "3 5", weight: 1 },
        waterway: { color: "#0ea5e9", dashArray: "6 3", weight: 2 },
      };

      for (const road of roadData) {
        const from = cityCoords.get(road.fromCityId);
        const to = cityCoords.get(road.toCityId);
        if (!from || !to) continue;

        const style = ROAD_STYLES[road.type] ?? ROAD_STYLES.official;
        const line = L.polyline([from, to], {
          color: style.color,
          weight: style.weight,
          dashArray: style.dashArray,
          opacity: 0.6,
        });
        line.addTo(layers);
      }
    }

    // === Trade routes (below movement lines) ===
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

    // === Movement lines and unit markers ===
    for (const mov of data.movements) {
      const origin = cityCoords.get(mov.originCityId);
      const dest = cityCoords.get(mov.destinationCityId);
      if (!origin || !dest) continue;

      const totalTicks = mov.arrivalTick - mov.departureTick;
      const elapsed = viewTick - mov.departureTick;
      const progress = totalTicks > 0 ? Math.min(1, Math.max(0, elapsed / totalTicks)) : 1;

      const routeLine = L.polyline([origin, dest], {
        color: "#f59e0b",
        weight: 2,
        dashArray: "6 4",
        opacity: 0.5,
      });
      routeLine.addTo(layers);

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

    // === City markers and labels (top layer) ===
    for (const city of data.cities) {
      const color = city.status === "dead"
        ? FALLBACK_COLORS.dead
        : (city.controllerId && factionColors?.get(city.controllerId)) ?? FALLBACK_COLORS[city.status] ?? FALLBACK_COLORS.neutral;
      const radius = city.tier === "major" ? 12 : 7;

      const charsHere = data.characters.filter((c) => c.cityId === city.id);
      const charNames = charsHere.map((c) => c.name).join("、");

      const circle = L.circleMarker([city.lat, city.lng], {
        radius,
        color,
        fillColor: color,
        fillOpacity: city.status === "dead" ? 0.3 : 0.7,
        weight: city.tier === "major" ? 2 : 1,
      });

      const siegeInfo = city.siegedBy ? `<br/><span style="color:#ef4444">⚔ 被圍城中</span>` : "";
      const supplyInfo = supplyStatus && city.controllerId && supplyStatus[city.id] === false ? `<br/><span style="color:#f97316">⚠ 補給中斷</span>` : "";
      const droughtInfo = droughtCities?.includes(city.id) ? `<br/><span style="color:#a16207">☀ 旱災</span>` : "";
      const tooltipContent = `<div style="font-size:13px">
        <strong>${city.name}</strong><br/>
        <span style="color:${color}">${statusLabel(city.status)}</span>${siegeInfo}${supplyInfo}${droughtInfo}
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

      // Siege pulse ring
      if (city.siegedBy) {
        const pulseRing = L.circleMarker([city.lat, city.lng], {
          radius: radius + 6,
          color: "#ef4444",
          fillColor: "transparent",
          fillOpacity: 0,
          weight: 2,
          opacity: 0.8,
          className: "siege-pulse",
        });
        pulseRing.addTo(layers);
      }

      // Supply disruption marker
      if (supplyStatus && city.controllerId && supplyStatus[city.id] === false) {
        const supplyRing = L.circleMarker([city.lat, city.lng], {
          radius: radius + 4,
          color: "#f97316",
          fillColor: "transparent",
          fillOpacity: 0,
          weight: 2,
          opacity: 0.7,
          dashArray: "4 3",
        });
        supplyRing.addTo(layers);
      }

      // Drought marker
      if (droughtCities?.includes(city.id)) {
        const droughtRing = L.circleMarker([city.lat, city.lng], {
          radius: radius + 8,
          color: "#a16207",
          fillColor: "transparent",
          fillOpacity: 0,
          weight: 2,
          opacity: 0.6,
          className: "drought-pulse",
        });
        droughtRing.addTo(layers);
      }

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

      // Reachable highlight ring
      if (highlightCityIds?.has(city.id)) {
        const highlightRing = L.circleMarker([city.lat, city.lng], {
          radius: radius + 5,
          color: "#06b6d4",
          fillColor: "transparent",
          fillOpacity: 0,
          weight: 2,
          opacity: 0.9,
          className: "reachable-pulse",
        });
        highlightRing.addTo(layers);
      }
    }
  }, [data, viewTick, onCityClick, factionColors, tradeRoutes, supplyStatus, droughtCities, roads, highlightCityIds]);

  return (
    <>
      <style>{`
        .siege-pulse {
          animation: siege-pulse-anim 1.5s ease-in-out infinite;
        }
        @keyframes siege-pulse-anim {
          0%, 100% { opacity: 0.3; stroke-width: 2; }
          50% { opacity: 0.9; stroke-width: 4; }
        }
        .drought-pulse {
          animation: drought-pulse-anim 2s ease-in-out infinite;
        }
        @keyframes drought-pulse-anim {
          0%, 100% { opacity: 0.3; stroke-width: 1; }
          50% { opacity: 0.7; stroke-width: 3; }
        }
        .reachable-pulse {
          animation: reachable-pulse-anim 1.5s ease-in-out infinite;
        }
        @keyframes reachable-pulse-anim {
          0%, 100% { opacity: 0.5; stroke-width: 2; }
          50% { opacity: 1; stroke-width: 3; }
        }
        .dark-tooltip {
          background: #1e293b !important;
          border: 1px solid #334155 !important;
          color: #e2e8f0 !important;
          border-radius: 6px !important;
          padding: 4px 8px !important;
        }
        .dark-tooltip .leaflet-tooltip-tip {
          border-top-color: #334155 !important;
        }
      `}</style>
      <div ref={containerRef} style={styles.container} />
    </>
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
