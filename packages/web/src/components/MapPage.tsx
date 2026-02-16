"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { trpc } from "../lib/trpc";
import { Timeline } from "./Timeline";

// Dynamically import StrategicMap to avoid SSR issues with Leaflet
const StrategicMap = dynamic(
  () => import("./StrategicMap").then((m) => ({ default: m.StrategicMap })),
  { ssr: false },
);

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

interface MapPageProps {
  currentTick: number;
  viewTick: number;
  onTickChange: (tick: number) => void;
  playing: boolean;
  onPlayToggle: () => void;
  advancing: boolean;
  onAdvanceDay: () => void;
}

export function MapPage({
  currentTick,
  viewTick,
  onTickChange,
  playing,
  onPlayToggle,
  advancing,
  onAdvanceDay,
}: MapPageProps) {
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [selectedCity, setSelectedCity] = useState<PlaceNode | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMapData = useCallback(async (tick: number) => {
    try {
      const data = await trpc.map.getMapData.query({ tick });
      setMapData(data as MapData);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMapData(viewTick);
  }, [viewTick, fetchMapData]);

  const handleCityClick = useCallback((cityId: string) => {
    if (!mapData) return;
    const city = mapData.cities.find((c) => c.id === cityId) ?? null;
    setSelectedCity(city);
  }, [mapData]);

  const charsInCity = useMemo(() => {
    if (!selectedCity || !mapData) return [];
    return mapData.characters.filter((c) => c.cityId === selectedCity.id);
  }, [selectedCity, mapData]);

  return (
    <div style={styles.layout}>
      <div style={styles.main}>
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <h1 style={styles.title}>RTK - Strategic Map</h1>
            <span style={styles.tick}>Day {viewTick}{viewTick !== currentTick ? ` (live: ${currentTick})` : ""}</span>
          </div>
          <div style={styles.controls}>
            <button
              onClick={onAdvanceDay}
              disabled={advancing}
              style={{
                ...styles.button,
                opacity: advancing ? 0.6 : 1,
                cursor: advancing ? "not-allowed" : "pointer",
              }}
            >
              {advancing ? "推進中..." : "推進一天"}
            </button>
          </div>
        </header>

        <Timeline
          currentTick={currentTick}
          viewTick={viewTick}
          onTickChange={onTickChange}
          playing={playing}
          onPlayToggle={onPlayToggle}
        />

        {loading ? (
          <div style={styles.loading}>Loading map...</div>
        ) : (
          <StrategicMap
            data={mapData}
            viewTick={viewTick}
            onCityClick={handleCityClick}
          />
        )}
      </div>

      {/* City detail sidebar */}
      <aside style={styles.sidebar}>
        {selectedCity ? (
          <>
            <h2 style={styles.sideTitle}>{selectedCity.name}</h2>
            <div style={styles.cityInfo}>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>狀態</span>
                <span style={{ color: statusColor(selectedCity.status), fontWeight: 600 }}>
                  {statusLabel(selectedCity.status)}
                </span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>等級</span>
                <span>{selectedCity.tier === "major" ? "主城" : "支城"}</span>
              </div>
              {selectedCity.controllerId && (
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>控制者</span>
                  <span>{selectedCity.controllerId}</span>
                </div>
              )}
            </div>

            <h3 style={styles.sideSubtitle}>
              駐軍 ({charsInCity.length})
            </h3>
            {charsInCity.length === 0 ? (
              <p style={styles.emptyText}>無駐軍</p>
            ) : (
              <div style={styles.charList}>
                {charsInCity.map((c) => (
                  <div key={c.id} style={styles.charItem}>
                    <span style={styles.charName}>{c.name}</span>
                    <span style={styles.charTraits}>{c.traits.join("、")}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p style={styles.hint}>點擊城市查看詳情</p>
        )}
      </aside>
    </div>
  );
}

function statusColor(status: string): string {
  switch (status) {
    case "allied": return "#3b82f6";
    case "hostile": return "#ef4444";
    case "neutral": return "#ffffff";
    case "dead": return "#4b5563";
    default: return "#9ca3af";
  }
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
  layout: {
    display: "flex",
    height: "100%",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    padding: 20,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    margin: 0,
  },
  tick: {
    fontSize: 14,
    color: "#f59e0b",
    backgroundColor: "#1e293b",
    padding: "4px 10px",
    borderRadius: 6,
    fontWeight: 600,
  },
  controls: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  button: {
    padding: "8px 16px",
    borderRadius: 6,
    border: "none",
    backgroundColor: "#f59e0b",
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 700,
  },
  loading: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    color: "#64748b",
  },
  sidebar: {
    width: 280,
    padding: 20,
    backgroundColor: "#1e293b",
    borderLeft: "1px solid #334155",
    color: "#e2e8f0",
    overflowY: "auto",
  },
  sideTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 0,
    marginBottom: 16,
  },
  sideSubtitle: {
    fontSize: 14,
    fontWeight: 600,
    marginTop: 16,
    marginBottom: 8,
    paddingTop: 12,
    borderTop: "1px solid #334155",
  },
  cityInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 14,
  },
  infoLabel: {
    color: "#94a3b8",
  },
  hint: {
    color: "#64748b",
    fontStyle: "italic",
  },
  emptyText: {
    fontSize: 13,
    color: "#64748b",
    fontStyle: "italic",
  },
  charList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  charItem: {
    padding: "6px 10px",
    backgroundColor: "#0f172a",
    borderRadius: 6,
  },
  charName: {
    fontSize: 14,
    fontWeight: 600,
    display: "block",
  },
  charTraits: {
    fontSize: 12,
    color: "#94a3b8",
    display: "block",
    marginTop: 2,
  },
};
