"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { trpc } from "../lib/trpc";
import { Timeline, type TimelineMarker } from "./Timeline";
import { CharacterDetail } from "./CharacterDetail";

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
  gold: number;
  garrison: number;
  development: number;
  siegedBy?: string;
  siegeTick?: number;
  specialty?: string;
  improvement?: string;
}

const SPECIALTY_LABELS: Record<string, string> = {
  military_academy: "軍校",
  forge: "鍛冶場",
  harbor: "港口",
  library: "書院",
  market: "市場",
  granary: "穀倉",
};

const SPECIALTY_EFFECTS: Record<string, string> = {
  military_academy: "每5天武力+1",
  forge: "守備防禦x1.5",
  harbor: "出發移動1天",
  library: "每5天智力+1",
  market: "收入+50%",
  granary: "圍城4天才損耗",
};

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

interface FactionInfo {
  id: string;
  leaderId: string;
  leaderName: string;
  members: string[];
  cities: string[];
  color: string;
}

interface BattleResult {
  tick: number;
  cityId: string;
  cityName: string;
  attackerId: string;
  attackerName: string;
  defenderId: string | null;
  defenderName: string | null;
  winner: "attacker" | "defender";
  captured: boolean;
}

interface MapPageProps {
  currentTick: number;
  viewTick: number;
  onTickChange: (tick: number) => void;
  playing: boolean;
  onPlayToggle: () => void;
  advancing: boolean;
  onAdvanceDay: () => Promise<{ battleResults?: BattleResult[] } | undefined>;
  timelineMarkers?: TimelineMarker[];
}

export function MapPage({
  currentTick,
  viewTick,
  onTickChange,
  playing,
  onPlayToggle,
  advancing,
  onAdvanceDay,
  timelineMarkers,
}: MapPageProps) {
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [selectedCity, setSelectedCity] = useState<PlaceNode | null>(null);
  const [selectedChar, setSelectedChar] = useState<string | null>(null);
  const [factions, setFactions] = useState<FactionInfo[]>([]);
  const [battleLog, setBattleLog] = useState<BattleResult[]>([]);
  const [commandCount, setCommandCount] = useState(0);
  const [detailCharId, setDetailCharId] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<{ winRate: number; attackPower: number; defensePower: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMapData = useCallback(async (tick: number) => {
    try {
      const [data, facs] = await Promise.all([
        trpc.map.getMapData.query({ tick }),
        trpc.simulation.getFactions.query(),
      ]);
      setMapData(data as MapData);
      setFactions(facs as FactionInfo[]);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMapData(viewTick);
  }, [viewTick, fetchMapData]);

  // Refresh selected city when mapData changes
  useEffect(() => {
    if (selectedCity && mapData) {
      const updated = mapData.cities.find((c) => c.id === selectedCity.id);
      if (updated) setSelectedCity(updated);
    }
  }, [mapData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCityClick = useCallback((cityId: string) => {
    if (!mapData) return;
    const city = mapData.cities.find((c) => c.id === cityId) ?? null;
    setSelectedCity(city);
    setSelectedChar(null);
  }, [mapData]);

  // Build controllerId -> faction color map
  const factionColors = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of factions) {
      for (const memberId of f.members) {
        map.set(memberId, f.color);
      }
    }
    return map;
  }, [factions]);

  const charsInCity = useMemo(() => {
    if (!selectedCity || !mapData) return [];
    return mapData.characters.filter((c) => c.cityId === selectedCity.id);
  }, [selectedCity, mapData]);

  // Fetch battle prediction when attacker and target are selected
  useEffect(() => {
    if (!selectedChar || !selectedCity || selectedCity.status === "allied") {
      setPrediction(null);
      return;
    }
    trpc.simulation.predictBattle
      .query({ attackerIds: [selectedChar], cityId: selectedCity.id })
      .then((r) => setPrediction(r as { winRate: number; attackPower: number; defensePower: number }))
      .catch(() => setPrediction(null));
  }, [selectedChar, selectedCity]);

  const handleReinforce = async (cityId: string) => {
    try {
      await trpc.simulation.queueCommand.mutate({
        type: "reinforce",
        characterId: "liu_bei",
        targetCityId: cityId,
      });
      setCommandCount((c) => c + 1);
    } catch {
      // silently fail
    }
  };

  const handleDevelop = async (cityId: string) => {
    try {
      await trpc.simulation.queueCommand.mutate({
        type: "develop",
        characterId: "liu_bei",
        targetCityId: cityId,
      });
      setCommandCount((c) => c + 1);
    } catch {
      // silently fail
    }
  };

  const handleBuildImprovement = async (cityId: string) => {
    try {
      await trpc.simulation.queueCommand.mutate({
        type: "build_improvement",
        characterId: "liu_bei",
        targetCityId: cityId,
      });
      setCommandCount((c) => c + 1);
    } catch {
      // silently fail
    }
  };

  const handleSpy = async (type: "spy" | "sabotage") => {
    if (!selectedChar || !selectedCity) return;
    try {
      await trpc.simulation.queueCommand.mutate({
        type,
        characterId: selectedChar,
        targetCityId: selectedCity.id,
      });
      setCommandCount((c) => c + 1);
    } catch {
      // silently fail
    }
  };

  const handleCommand = async (type: "move" | "attack") => {
    if (!selectedChar || !selectedCity) return;
    try {
      await trpc.simulation.queueCommand.mutate({
        type,
        characterId: selectedChar,
        targetCityId: selectedCity.id,
      });
      setCommandCount((c) => c + 1);
    } catch {
      // silently fail
    }
  };

  const handleAdvance = async () => {
    const result = await onAdvanceDay();
    if (result?.battleResults && result.battleResults.length > 0) {
      setBattleLog((prev) => [...prev, ...result.battleResults!]);
    }
    setCommandCount(0);
    // Refetch map data
    fetchMapData(viewTick + 1);
  };

  const controllerName = (controllerId?: string) => {
    if (!controllerId || !mapData) return "無";
    const char = mapData.characters.find((c) => c.id === controllerId);
    return char?.name ?? controllerId;
  };

  return (
    <div style={styles.layout}>
      <div style={styles.main}>
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <h1 style={styles.title}>RTK - Strategic Map</h1>
            <span style={styles.tick}>Day {viewTick}{viewTick !== currentTick ? ` (live: ${currentTick})` : ""}</span>
            {commandCount > 0 && (
              <span style={styles.cmdBadge}>{commandCount} 指令待執行</span>
            )}
          </div>
          <div style={styles.controls}>
            <button
              onClick={handleAdvance}
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
          markers={timelineMarkers}
        />

        {loading ? (
          <div style={styles.loading}>Loading map...</div>
        ) : (
          <StrategicMap
            data={mapData}
            viewTick={viewTick}
            factionColors={factionColors}
            onCityClick={handleCityClick}
          />
        )}
      </div>

      {/* Sidebar */}
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
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>控制者</span>
                <span>{controllerName(selectedCity.controllerId)}</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>金幣</span>
                <span style={{ color: "#f59e0b", fontWeight: 600 }}>{selectedCity.gold ?? 0}</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>守備</span>
                <span style={{ color: "#3b82f6", fontWeight: 600 }}>{selectedCity.garrison ?? 0}</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>開發</span>
                <span style={{ color: "#a855f7", fontWeight: 600 }}>Lv.{selectedCity.development ?? 0}/5</span>
              </div>
              {(() => {
                // Check if this is the last city for its faction
                const controllerFaction = factions.find((f) => f.members.includes(selectedCity.controllerId ?? ""));
                if (controllerFaction && controllerFaction.cities.length === 1 && controllerFaction.cities[0] === selectedCity.id) {
                  return (
                    <div style={{ ...styles.infoRow, color: "#f97316" }}>
                      <span style={styles.infoLabel}>警告</span>
                      <span style={{ fontWeight: 700, animation: "pulse 1.5s ease-in-out infinite" }}>最後據點！</span>
                    </div>
                  );
                }
                return null;
              })()}
              {selectedCity.specialty && (
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>特產</span>
                  <span style={{ color: "#22c55e", fontWeight: 600 }}>
                    {SPECIALTY_LABELS[selectedCity.specialty] ?? selectedCity.specialty}
                  </span>
                </div>
              )}
              {selectedCity.specialty && (
                <div style={{ ...styles.infoRow, fontSize: 11 }}>
                  <span style={styles.infoLabel}>效果</span>
                  <span style={{ color: "#94a3b8" }}>
                    {SPECIALTY_EFFECTS[selectedCity.specialty] ?? ""}
                    {selectedCity.improvement ? " (強化)" : ""}
                  </span>
                </div>
              )}
              {selectedCity.improvement && (
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>改良</span>
                  <span style={{ color: "#f59e0b", fontWeight: 600 }}>{selectedCity.improvement}</span>
                </div>
              )}
              {selectedCity.siegedBy && (
                <div style={{ ...styles.infoRow, color: "#ef4444" }}>
                  <span style={styles.infoLabel}>圍城中</span>
                  <span style={{ fontWeight: 700 }}>{selectedCity.siegedBy}</span>
                </div>
              )}
            </div>

            {/* Command buttons */}
            {selectedChar && (
              <div style={styles.cmdSection}>
                <p style={styles.cmdLabel}>指令目標：{selectedCity.name}</p>
                {prediction && selectedCity.status !== "allied" && (
                  <div style={styles.predictionRow}>
                    <span style={{ color: prediction.winRate >= 50 ? "#22c55e" : "#ef4444", fontWeight: 700, fontSize: 14 }}>
                      勝率 {prediction.winRate}%
                    </span>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>
                      攻:{prediction.attackPower} vs 守:{prediction.defensePower}
                    </span>
                  </div>
                )}
                <div style={styles.cmdButtons}>
                  <button style={styles.cmdMove} onClick={() => handleCommand("move")}>
                    移動至此
                  </button>
                  <button style={styles.cmdAttack} onClick={() => handleCommand("attack")}>
                    攻擊此城
                  </button>
                </div>
                {selectedCity.status !== "allied" && (
                  <div style={{ ...styles.cmdButtons, marginTop: 6 }}>
                    <button style={styles.spyBtn} onClick={() => handleSpy("spy")}>
                      偵查（100金）
                    </button>
                    <button style={styles.sabotageBtn} onClick={() => handleSpy("sabotage")}>
                      破壞（100金）
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Reinforce + Develop buttons */}
            {selectedCity.status === "allied" && (
              <div style={styles.cmdSection}>
                {(selectedCity.gold ?? 0) >= 100 && (
                  <>
                    <p style={styles.cmdLabel}>強化守備（100 金）</p>
                    <button style={styles.reinforceBtn} onClick={() => handleReinforce(selectedCity.id)}>
                      強化守備 +1
                    </button>
                  </>
                )}
                {(selectedCity.gold ?? 0) >= 300 && (selectedCity.development ?? 0) < 5 && (
                  <>
                    <p style={{ ...styles.cmdLabel, marginTop: 8 }}>城市開發（300 金，收入 +30%）</p>
                    <button style={styles.developBtn} onClick={() => handleDevelop(selectedCity.id)}>
                      開發 Lv.{(selectedCity.development ?? 0) + 1}
                    </button>
                  </>
                )}
                {(selectedCity.gold ?? 0) >= 500 && (selectedCity.development ?? 0) >= 3 && selectedCity.specialty && !selectedCity.improvement && (
                  <>
                    <p style={{ ...styles.cmdLabel, marginTop: 8 }}>建造改良（500 金，強化特產效果）</p>
                    <button style={styles.improvementBtn} onClick={() => handleBuildImprovement(selectedCity.id)}>
                      建造 {SPECIALTY_LABELS[selectedCity.specialty] ?? selectedCity.specialty}改良
                    </button>
                  </>
                )}
              </div>
            )}

            <h3 style={styles.sideSubtitle}>
              駐軍 ({charsInCity.length})
            </h3>
            {charsInCity.length === 0 ? (
              <p style={styles.emptyText}>無駐軍</p>
            ) : (
              <div style={styles.charList}>
                {charsInCity.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      ...styles.charItem,
                      border: selectedChar === c.id ? "1px solid #f59e0b" : "1px solid transparent",
                      cursor: "pointer",
                    }}
                    onClick={() => setSelectedChar(selectedChar === c.id ? null : c.id)}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={styles.charName}>{c.name}</span>
                      <button
                        style={styles.detailBtn}
                        onClick={(e) => { e.stopPropagation(); setDetailCharId(c.id); }}
                      >
                        詳情
                      </button>
                    </div>
                    <span style={styles.charTraits}>{c.traits.join("、")}</span>
                    {selectedChar === c.id && (
                      <span style={styles.selectedTag}>已選取</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Faction summary */}
            <h3 style={styles.sideSubtitle}>勢力概況</h3>
            <div style={styles.factionList}>
              {factions.map((f) => (
                <div key={f.id} style={styles.factionItem}>
                  <span style={{ ...styles.factionDot, backgroundColor: f.color }} />
                  <span style={styles.factionName}>{f.leaderName}</span>
                  <span style={styles.factionStats}>
                    {f.cities.length}城 {f.members.length}將
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <p style={styles.hint}>點擊城市查看詳情</p>

            {/* Battle log */}
            {battleLog.length > 0 && (
              <>
                <h3 style={{ ...styles.sideSubtitle, marginTop: 24 }}>戰報</h3>
                <div style={styles.battleList}>
                  {[...battleLog].reverse().map((b, i) => (
                    <div key={i} style={styles.battleItem}>
                      <span style={styles.battleDay}>Day {b.tick}</span>
                      <p style={styles.battleText}>
                        {b.attackerName} {b.captured ? "攻陷" : "未能攻下"}{" "}
                        <strong>{b.cityName}</strong>
                        {b.defenderName && ` (守將：${b.defenderName})`}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Faction summary */}
            <h3 style={{ ...styles.sideSubtitle, marginTop: 24 }}>勢力概況</h3>
            <div style={styles.factionList}>
              {factions.map((f) => (
                <div key={f.id} style={styles.factionItem}>
                  <span style={{ ...styles.factionDot, backgroundColor: f.color }} />
                  <span style={styles.factionName}>{f.leaderName}</span>
                  <span style={styles.factionStats}>
                    {f.cities.length}城 {f.members.length}將
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </aside>

      {/* Character detail modal */}
      {detailCharId && (
        <CharacterDetail
          characterId={detailCharId}
          factionName={factions.find((f) => f.members.includes(detailCharId))?.leaderName}
          factionColor={factionColors.get(detailCharId)}
          cityName={mapData?.cities.find((c) => c.id === mapData?.characters.find((ch) => ch.id === detailCharId)?.cityId)?.name}
          onClose={() => setDetailCharId(null)}
          onCharacterClick={(id) => setDetailCharId(id)}
        />
      )}
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
  layout: { display: "flex", height: "100%" },
  main: { flex: 1, display: "flex", flexDirection: "column", padding: 20 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  title: { fontSize: 22, fontWeight: "bold", margin: 0 },
  tick: { fontSize: 14, color: "#f59e0b", backgroundColor: "#1e293b", padding: "4px 10px", borderRadius: 6, fontWeight: 600 },
  cmdBadge: { fontSize: 12, color: "#0f172a", backgroundColor: "#f59e0b", padding: "2px 8px", borderRadius: 10, fontWeight: 700 },
  controls: { display: "flex", alignItems: "center", gap: 8 },
  button: { padding: "8px 16px", borderRadius: 6, border: "none", backgroundColor: "#f59e0b", color: "#0f172a", fontSize: 14, fontWeight: 700 },
  loading: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#64748b" },
  sidebar: { width: 280, padding: 20, backgroundColor: "#1e293b", borderLeft: "1px solid #334155", color: "#e2e8f0", overflowY: "auto" },
  sideTitle: { fontSize: 18, fontWeight: "bold", marginTop: 0, marginBottom: 16 },
  sideSubtitle: { fontSize: 14, fontWeight: 600, marginTop: 16, marginBottom: 8, paddingTop: 12, borderTop: "1px solid #334155" },
  cityInfo: { display: "flex", flexDirection: "column", gap: 8 },
  infoRow: { display: "flex", justifyContent: "space-between", fontSize: 14 },
  infoLabel: { color: "#94a3b8" },
  hint: { color: "#64748b", fontStyle: "italic" },
  emptyText: { fontSize: 13, color: "#64748b", fontStyle: "italic" },
  charList: { display: "flex", flexDirection: "column", gap: 6 },
  charItem: { padding: "6px 10px", backgroundColor: "#0f172a", borderRadius: 6 },
  charName: { fontSize: 14, fontWeight: 600, display: "block" },
  charTraits: { fontSize: 12, color: "#94a3b8", display: "block", marginTop: 2 },
  selectedTag: { fontSize: 10, color: "#f59e0b", fontWeight: 700, marginTop: 4, display: "block" },
  detailBtn: { fontSize: 11, padding: "2px 8px", borderRadius: 4, border: "1px solid #334155", backgroundColor: "transparent", color: "#94a3b8", cursor: "pointer" },
  cmdSection: { marginTop: 12, padding: "10px 12px", backgroundColor: "#0f172a", borderRadius: 8, borderLeft: "3px solid #f59e0b" },
  cmdLabel: { fontSize: 12, color: "#f59e0b", margin: "0 0 8px" },
  predictionRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  cmdButtons: { display: "flex", gap: 8 },
  cmdMove: { flex: 1, padding: "6px 0", borderRadius: 4, border: "none", backgroundColor: "#3b82f6", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  cmdAttack: { flex: 1, padding: "6px 0", borderRadius: 4, border: "none", backgroundColor: "#ef4444", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  reinforceBtn: { width: "100%", padding: "6px 0", borderRadius: 4, border: "none", backgroundColor: "#3b82f6", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  developBtn: { width: "100%", padding: "6px 0", borderRadius: 4, border: "none", backgroundColor: "#a855f7", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  improvementBtn: { width: "100%", padding: "6px 0", borderRadius: 4, border: "none", backgroundColor: "#22c55e", color: "#0f172a", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  spyBtn: { flex: 1, padding: "6px 0", borderRadius: 4, border: "none", backgroundColor: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  sabotageBtn: { flex: 1, padding: "6px 0", borderRadius: 4, border: "none", backgroundColor: "#a855f7", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  factionList: { display: "flex", flexDirection: "column", gap: 6 },
  factionItem: { display: "flex", alignItems: "center", gap: 8, fontSize: 13 },
  factionDot: { width: 10, height: 10, borderRadius: "50%", flexShrink: 0 },
  factionName: { fontWeight: 600 },
  factionStats: { color: "#94a3b8", marginLeft: "auto" },
  battleList: { display: "flex", flexDirection: "column", gap: 6 },
  battleItem: { padding: "6px 10px", backgroundColor: "#0f172a", borderRadius: 6, borderLeft: "3px solid #ef4444" },
  battleDay: { fontSize: 11, color: "#f59e0b", fontWeight: 600 },
  battleText: { fontSize: 13, color: "#cbd5e1", margin: "4px 0 0", lineHeight: 1.4 },
};
