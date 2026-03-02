"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Delaunay } from "d3-delaunay";
import { CHINA_OUTLINE } from "../data/china-outline";
import { CITY_TO_REGION, STATE_REGIONS, REGION_BY_ID } from "../data/state-regions";
import { theme, FACTION_TERRITORY_COLORS as THEME_TERRITORY_COLORS } from "../lib/theme";

interface PlaceNode {
  id: string;
  provinceId: number;
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
  avatarUrl?: string;
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
  onCharacterClick?: (characterId: string) => void;
  playerFactionMembers?: Set<string>; // character IDs in player faction
}

const FALLBACK_COLORS: Record<string, string> = {
  allied: theme.info,
  hostile: theme.danger,
  neutral: theme.textPrimary,
  dead: "#1e1e1e",
};

// Faction-specific territory colors
const FACTION_TERRITORY_COLORS: Record<string, string> = {
  liu_bei: theme.factionShu,
  cao_cao: theme.factionWei,
  sun_quan: theme.factionWu,
  lu_bu: theme.factionLuBu,
  yuan_shao: theme.factionYuanShao,
  liu_biao: theme.factionLiuBiao,
  gongsun_zan: theme.factionGongsunZan,
  ma_chao: theme.factionMaChao,
};

// Faction leader display names for legend
const FACTION_LEADER_NAMES: Record<string, string> = {
  liu_bei: "劉備",
  cao_cao: "曹操",
  sun_quan: "孫權",
  lu_bu: "呂布",
  yuan_shao: "袁紹",
  liu_biao: "劉表",
  gongsun_zan: "公孫瓚",
  ma_chao: "馬超",
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

export function StrategicMap({ data, viewTick, factionColors, tradeRoutes, supplyStatus, droughtCities, roads, highlightCityIds, onCityClick, onCharacterClick, playerFactionMembers }: StrategicMapProps) {
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

    // Warm-toned tile layer
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map);

    const tilePane = map.getPane("tilePane");
    if (tilePane) {
      tilePane.style.filter = "sepia(0.4) brightness(0.35) contrast(1.1) saturate(0.6)";
    }

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

      // First pass: compute clipped polygons and faction assignments
      const clippedPolygons: ([number, number][] | null)[] = [];
      const cellFactions: (string | null)[] = [];

      for (let i = 0; i < liveCities.length; i++) {
        const cellPolygon = voronoi.cellPolygon(i);
        if (!cellPolygon) {
          clippedPolygons.push(null);
          cellFactions.push(null);
          continue;
        }
        const cellLatLng: [number, number][] = cellPolygon.map(([lng, lat]) => [lat, lng]);
        const clipped = clipPolygon(cellLatLng, CHINA_CLIP_POLYGON);
        clippedPolygons.push(clipped.length >= 3 ? clipped : null);
        cellFactions.push(liveCities[i].controllerId ?? null);
      }

      // Second pass: draw territory fills — only for faction-controlled cities
      for (let i = 0; i < liveCities.length; i++) {
        const clipped = clippedPolygons[i];
        if (!clipped) continue;

        const controllerId = cellFactions[i];
        if (!controllerId) continue; // uncontrolled cities stay blank

        const territoryColor = FACTION_TERRITORY_COLORS[controllerId] ?? factionColors?.get(controllerId);
        if (!territoryColor) continue;

        L.polygon(clipped as L.LatLngExpression[], {
          color: "transparent",
          fillColor: territoryColor,
          fillOpacity: 0.75,
          weight: 0,
        }).addTo(layers);
      }

      // Third pass: draw ALL province borders (every cell, controlled or not)
      for (let i = 0; i < liveCities.length; i++) {
        const clipped = clippedPolygons[i];
        if (!clipped) continue;

        L.polygon(clipped as L.LatLngExpression[], {
          color: theme.textSecondary,
          fillColor: "transparent",
          fillOpacity: 0,
          weight: 2,
          opacity: 0.7,
        }).addTo(layers);
      }

      // Shared: extract Delaunay circumcenters and half-edges for border passes
      const circumcenters = (voronoi as unknown as { circumcenters: Float64Array }).circumcenters;
      const { halfedges, triangles } = delaunay;

      // Build city → region lookup for live cities
      const cellRegions: (string | null)[] = liveCities.map((c) => CITY_TO_REGION[c.id] ?? null);

      // 3.5 pass: state (zhou) border lines — dashed, between province and faction borders
      for (let e = 0; e < halfedges.length; e++) {
        const opposite = halfedges[e];
        if (opposite < e) continue;

        const siteA = triangles[e];
        const nextE = e % 3 === 2 ? e - 2 : e + 1;
        const siteB = triangles[nextE];

        const rA = cellRegions[siteA];
        const rB = cellRegions[siteB];
        if (!rA || !rB || rA === rB) continue;

        const triA = Math.floor(e / 3);
        const triB = Math.floor(opposite / 3);
        const lat1 = circumcenters[triA * 2 + 1];
        const lng1 = circumcenters[triA * 2];
        const lat2 = circumcenters[triB * 2 + 1];
        const lng2 = circumcenters[triB * 2];

        L.polyline([[lat1, lng1], [lat2, lng2]] as L.LatLngExpression[], {
          color: "#d4c4a0",
          weight: 3,
          opacity: 0.6,
          dashArray: "8 4",
        }).addTo(layers);
      }

      // 3.7 pass: state name labels (EU4-style large translucent text)
      for (const region of STATE_REGIONS) {
        // Only show label if at least one city in this region is alive on the map
        const hasCity = region.cityIds.some((cid) => liveCities.some((c) => c.id === cid));
        if (!hasCity) continue;

        const labelMarker = L.marker([region.labelLat, region.labelLng], {
          interactive: false,
          icon: L.divIcon({
            className: "state-region-label",
            html: `<span style="font-size:16px;font-weight:700;color:${theme.textPrimary};opacity:0.35;letter-spacing:4px;white-space:nowrap;pointer-events:none;text-shadow:0 0 6px rgba(0,0,0,0.5)">${region.name}</span>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          }),
        });
        labelMarker.addTo(layers);
      }

      // Fourth pass: thick nation borders via Delaunay half-edge → Voronoi circumcenters
      for (let e = 0; e < halfedges.length; e++) {
        const opposite = halfedges[e];
        if (opposite < e) continue;

        const siteA = triangles[e];
        const nextE = e % 3 === 2 ? e - 2 : e + 1;
        const siteB = triangles[nextE];

        const fA = cellFactions[siteA];
        const fB = cellFactions[siteB];
        if (fA === fB || !fA || !fB) continue;

        const triA = Math.floor(e / 3);
        const triB = Math.floor(opposite / 3);
        const lat1 = circumcenters[triA * 2 + 1];
        const lng1 = circumcenters[triA * 2];
        const lat2 = circumcenters[triB * 2 + 1];
        const lng2 = circumcenters[triB * 2];

        L.polyline([[lat1, lng1], [lat2, lng2]] as L.LatLngExpression[], {
          color: theme.textPrimary,
          weight: 4,
          opacity: 0.9,
        }).addTo(layers);
      }
    }

    // === Road lines (between Voronoi and trade routes) ===
    const roadData = roads ?? data.roads;
    if (roadData) {
      const ROAD_STYLES: Record<RoadType, { color: string; dashArray?: string; weight: number }> = {
        official: { color: "#8b7355", weight: 2 },
        mountain: { color: "#6b4226", dashArray: "3 5", weight: 1 },
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
          color: theme.success,
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
        color: theme.accent,
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
        color: theme.accent,
        fillColor: theme.accent,
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

      const siegeInfo = city.siegedBy ? `<br/><span style="color:${theme.danger}">⚔ 被圍城中</span>` : "";
      const supplyInfo = supplyStatus && city.controllerId && supplyStatus[city.id] === false ? `<br/><span style="color:${theme.warning}">⚠ 補給中斷</span>` : "";
      const droughtInfo = droughtCities?.includes(city.id) ? `<br/><span style="color:#8b6b3a">☀ 旱災</span>` : "";
      const regionId = CITY_TO_REGION[city.id];
      const regionInfo = regionId ? REGION_BY_ID[regionId] : null;
      const regionLine = regionInfo ? `<br/><span style="color:${theme.textSecondary};font-size:11px">${regionInfo.name}</span>` : "";
      const tooltipContent = `<div style="font-size:13px">
        <strong><span style="color:${theme.accent}">#${city.provinceId}</span> ${city.name}</strong>${regionLine}<br/>
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
          color: theme.danger,
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
          color: theme.warning,
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
          color: "#8b6b3a",
          fillColor: "transparent",
          fillOpacity: 0,
          weight: 2,
          opacity: 0.6,
          className: "drought-pulse",
        });
        droughtRing.addTo(layers);
      }

      // City name label with province number
      const label = L.marker([city.lat, city.lng], {
        icon: L.divIcon({
          className: "city-label",
          html: `<span style="color:${color};font-size:${city.tier === "major" ? 12 : 10}px;font-weight:${city.tier === "major" ? 700 : 400};text-shadow:0 0 4px #000,0 0 4px #000"><span style="color:${theme.accent};font-size:${city.tier === "major" ? 10 : 8}px">${city.provinceId}.</span>${city.name}</span>`,
          iconSize: [0, 0],
          iconAnchor: [0, -(radius + 6)],
        }),
      });
      label.addTo(layers);

      // Reachable highlight ring
      if (highlightCityIds?.has(city.id)) {
        const highlightRing = L.circleMarker([city.lat, city.lng], {
          radius: radius + 5,
          color: theme.info,
          fillColor: "transparent",
          fillOpacity: 0,
          weight: 2,
          opacity: 0.9,
          className: "reachable-pulse",
        });
        highlightRing.addTo(layers);
      }
    }

    // === Character avatar markers (player faction only) ===
    if (playerFactionMembers && playerFactionMembers.size > 0) {
      // Group characters by city
      const charsByCity = new Map<string, typeof data.characters>();
      for (const ch of data.characters) {
        if (!playerFactionMembers.has(ch.id) || !ch.cityId) continue;
        const group = charsByCity.get(ch.cityId) ?? [];
        group.push(ch);
        charsByCity.set(ch.cityId, group);
      }

      for (const [cityId, chars] of charsByCity) {
        const coords = cityCoords.get(cityId);
        if (!coords) continue;
        const cityNode = data.cities.find((c) => c.id === cityId);
        const baseOffset = (cityNode?.tier === "major" ? 12 : 7) + 8;

        chars.slice(0, 5).forEach((ch, idx) => {
          // Arrange in an arc below the city
          const angleStep = 30;
          const angle = (180 + (idx - (Math.min(chars.length, 5) - 1) / 2) * angleStep) * Math.PI / 180;
          const offsetLat = Math.sin(angle) * baseOffset * 0.008;
          const offsetLng = Math.cos(angle) * baseOffset * 0.01;

          const avatarHtml = ch.avatarUrl
            ? `<img src="${ch.avatarUrl}" style="width:28px;height:28px;border-radius:50%;border:2px solid ${theme.factionShu};box-shadow:0 1px 4px rgba(0,0,0,0.5);cursor:pointer;object-fit:cover" />`
            : `<div style="width:28px;height:28px;border-radius:50%;border:2px solid ${theme.factionShu};background:${theme.bg2};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:${theme.factionShu};cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,0.5)">${ch.name.charAt(0)}</div>`;

          const marker = L.marker([coords[0] + offsetLat, coords[1] + offsetLng], {
            icon: L.divIcon({
              className: "char-avatar-marker",
              html: avatarHtml,
              iconSize: [32, 32],
              iconAnchor: [16, 16],
            }),
          });

          marker.bindTooltip(ch.name, {
            permanent: false,
            direction: "top",
            offset: [0, -16],
            className: "dark-tooltip",
          });

          if (onCharacterClick) {
            marker.on("click", () => onCharacterClick(ch.id));
          }

          marker.addTo(layers);
        });
      }
    }
  }, [data, viewTick, onCityClick, onCharacterClick, playerFactionMembers, factionColors, tradeRoutes, supplyStatus, droughtCities, roads, highlightCityIds]);

  // Compute active factions for legend
  const activeFactions = useMemo(() => {
    if (!data) return [];
    const seen = new Map<string, string>();
    for (const city of data.cities) {
      if (city.controllerId && !seen.has(city.controllerId)) {
        const color = FACTION_TERRITORY_COLORS[city.controllerId] ?? factionColors?.get(city.controllerId);
        if (color) {
          seen.set(city.controllerId, color);
        }
      }
    }
    return Array.from(seen.entries()).map(([id, color]) => ({
      id,
      name: FACTION_LEADER_NAMES[id] ?? id,
      color,
    }));
  }, [data, factionColors]);

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
          background: ${theme.bg2} !important;
          border: 1px solid ${theme.bg3} !important;
          color: ${theme.textPrimary} !important;
          border-radius: 6px !important;
          padding: 4px 8px !important;
        }
        .dark-tooltip .leaflet-tooltip-tip {
          border-top-color: ${theme.bg3} !important;
        }
      `}</style>
      <div style={styles.wrapper}>
        <div ref={containerRef} style={styles.mapContainer} />
        {activeFactions.length > 0 && (
          <div style={styles.legend}>
            {activeFactions.map((f) => (
              <div key={f.id} style={styles.legendItem}>
                <span style={{ ...styles.legendSwatch, background: f.color }} />
                <span style={styles.legendLabel}>{f.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
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
  wrapper: {
    position: "relative",
    flex: 1,
    minHeight: 0,
  },
  mapContainer: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
    overflow: "hidden",
  },
  legend: {
    position: "absolute",
    bottom: 12,
    left: 12,
    zIndex: 1000,
    background: theme.bg1a,
    border: `1px solid ${theme.bg3}`,
    borderRadius: 6,
    padding: "6px 10px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  legendSwatch: {
    display: "inline-block",
    width: 12,
    height: 12,
    borderRadius: 3,
    flexShrink: 0,
  },
  legendLabel: {
    fontSize: 11,
    color: theme.textSecondary,
    whiteSpace: "nowrap",
  },
};
