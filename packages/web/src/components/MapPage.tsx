"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { trpc } from "../lib/trpc";
import { theme } from "../lib/theme";
import { Timeline, type TimelineMarker } from "./Timeline";
import { CharacterDetail } from "./CharacterDetail";

const StrategicMap = dynamic(
  () => import("./StrategicMap").then((m) => ({ default: m.StrategicMap })),
  { ssr: false },
);

interface District {
  type: string;
  builtTick: number;
}

interface UnitComposition {
  infantry: number;
  cavalry: number;
  archers: number;
}

interface PlaceNode {
  id: string;
  name: string;
  description?: string;
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
  districts?: District[];
  food?: number;
  units?: UnitComposition;
  path?: string;
}

const DISTRICT_LABELS: Record<string, string> = {
  defense: "防禦區",
  commerce: "商業區",
  agriculture: "農業區",
  recruitment: "招募區",
};

const DISTRICT_EFFECTS: Record<string, string> = {
  defense: "守備+2",
  commerce: "收入+80%",
  agriculture: "圍城延遲+3天",
  recruitment: "招募-100金,成功率+25%",
};

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
  role?: string;
}

interface Movement {
  characterId: string;
  originCityId: string;
  destinationCityId: string;
  departureTick: number;
  arrivalTick: number;
}

interface RoadOnMap {
  fromCityId: string;
  toCityId: string;
  type: "official" | "mountain" | "waterway";
  travelTime: number;
}

interface MapData {
  cities: PlaceNode[];
  characters: CharacterOnMap[];
  movements: Movement[];
  roads?: RoadOnMap[];
}

interface FactionInfo {
  id: string;
  leaderId: string;
  leaderName: string;
  members: string[];
  cities: string[];
  color: string;
}

interface BattleRound {
  phase: string;
  attackerDelta: number;
  defenderDelta: number;
  note?: string;
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
  attackPower?: number;
  defensePower?: number;
  tactic?: string;
  rounds?: BattleRound[];
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
  const [expandedBattle, setExpandedBattle] = useState<number | null>(null);
  const [commandCount, setCommandCount] = useState(0);
  const [detailCharId, setDetailCharId] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<{ winRate: number; attackPower: number; defensePower: number } | null>(null);
  const [tactic, setTactic] = useState<"aggressive" | "defensive" | "balanced">("balanced");
  const [supplyStatus, setSupplyStatus] = useState<Record<string, boolean>>({});
  const [tradeRoutes, setTradeRoutes] = useState<{ cityA: string; cityB: string }[]>([]);
  const [cityLoyalty, setCityLoyalty] = useState<Record<string, number>>({});
  const [vulnerability, setVulnerability] = useState<Record<string, { score: number; level: string }>>({});
  const [droughtCities, setDroughtCities] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchMapData = useCallback(async (tick: number) => {
    try {
      // Core data: map + factions (must succeed)
      const [data, facs] = await Promise.all([
        trpc.map.getMapData.query({ tick }),
        trpc.simulation.getFactions.query(),
      ]);
      setMapData(data as MapData);
      setFactions(facs as FactionInfo[]);

      // Supplementary data: fail individually without breaking the map
      const [supply, trades, loyalty, vuln, drought] = await Promise.allSettled([
        trpc.simulation.getSupplyStatus.query(),
        trpc.simulation.getTradeRoutes.query(),
        trpc.simulation.getCityLoyalty.query(),
        trpc.simulation.getCityVulnerability.query(),
        trpc.simulation.getDroughtCities.query(),
      ]);
      if (supply.status === "fulfilled") setSupplyStatus(supply.value as Record<string, boolean>);
      if (trades.status === "fulfilled") setTradeRoutes((trades.value as { cityA: string; cityB: string }[]) ?? []);
      if (loyalty.status === "fulfilled") setCityLoyalty(loyalty.value as Record<string, number>);
      if (vuln.status === "fulfilled") setVulnerability(vuln.value as Record<string, { score: number; level: string }>);
      if (drought.status === "fulfilled") setDroughtCities(drought.value as string[]);
    } catch (err) {
      console.error("[MapPage] fetchMapData failed:", err);
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

  // Identify which characters are neutral (not in any faction)
  const neutralCharIds = useMemo(() => {
    const allFactionMembers = new Set<string>();
    for (const f of factions) {
      for (const m of f.members) allFactionMembers.add(m);
    }
    return new Set(
      (mapData?.characters ?? []).filter((c) => !allFactionMembers.has(c.id)).map((c) => c.id),
    );
  }, [factions, mapData]);

  // Compute reachable neighbor cities for selected character
  const reachableCityIds = useMemo(() => {
    if (!selectedChar || !mapData?.roads) return new Set<string>();
    const char = mapData.characters.find((c) => c.id === selectedChar);
    if (!char?.cityId) return new Set<string>();

    const cityMap = new Map(mapData.cities.map((c) => [c.id, c]));
    const neighbors = new Set<string>();

    for (const road of mapData.roads) {
      let neighborId: string | null = null;
      if (road.fromCityId === char.cityId) neighborId = road.toCityId;
      else if (road.toCityId === char.cityId) neighborId = road.fromCityId;
      if (!neighborId) continue;

      const neighborCity = cityMap.get(neighborId);
      if (!neighborCity || neighborCity.status === "dead") continue;

      // Waterway check: needs harbor on either end
      if (road.type === "waterway") {
        const origin = cityMap.get(char.cityId);
        if (origin?.specialty !== "harbor" && neighborCity.specialty !== "harbor") continue;
      }

      neighbors.add(neighborId);
    }
    return neighbors;
  }, [selectedChar, mapData]);

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

  const handleSpy = async (type: "spy" | "sabotage" | "blockade") => {
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

  const handleHireNeutral = async (targetCharId: string) => {
    if (!selectedCity) return;
    try {
      await trpc.simulation.queueCommand.mutate({
        type: "hire_neutral",
        characterId: "liu_bei",
        targetCityId: selectedCity.id,
        targetCharacterId: targetCharId,
      });
      setCommandCount((c) => c + 1);
    } catch {
      // silently fail
    }
  };

  const handleAssignRole = async (charId: string, role: string) => {
    try {
      await trpc.simulation.queueCommand.mutate({
        type: "assign_role",
        characterId: charId,
        targetCityId: selectedCity?.id ?? "",
        role: role as "general" | "governor" | "diplomat" | "spymaster",
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
        ...(type === "attack" ? { tactic } : {}),
      });
      setCommandCount((c) => c + 1);
    } catch {
      // silently fail
    }
  };

  const handleEstablishTrade = async (targetCityId: string) => {
    if (!selectedCity) return;
    try {
      await trpc.simulation.queueCommand.mutate({
        type: "establish_trade",
        characterId: "liu_bei",
        targetCityId: selectedCity.id,
        tradeCityId: targetCityId,
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
      {/* Map fills entire container */}
      <div style={styles.mapContainer}>
        {loading ? (
          <div style={styles.loading}>Loading map...</div>
        ) : (
          <StrategicMap
            data={mapData}
            viewTick={viewTick}
            factionColors={factionColors}
            tradeRoutes={tradeRoutes}
            supplyStatus={supplyStatus}
            droughtCities={droughtCities}
            roads={mapData?.roads}
            highlightCityIds={reachableCityIds.size > 0 ? reachableCityIds : undefined}
            onCityClick={handleCityClick}
          />
        )}
      </div>

      {/* Floating header */}
      <div style={styles.headerOverlay}>
        <h1 style={styles.title}>RTK</h1>
        <span style={styles.tick}>Day {viewTick}{viewTick !== currentTick ? ` (live: ${currentTick})` : ""}</span>
        {commandCount > 0 && (
          <span style={styles.cmdBadge}>{commandCount} 指令待執行</span>
        )}
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

      {/* Floating timeline at bottom */}
      <div style={{ ...styles.timelineOverlay, right: sidebarOpen ? 296 : 12 }}>
        <Timeline
          currentTick={currentTick}
          viewTick={viewTick}
          onTickChange={onTickChange}
          playing={playing}
          onPlayToggle={onPlayToggle}
          markers={timelineMarkers}
        />
      </div>

      {/* Sidebar toggle button */}
      <button
        style={styles.sidebarToggle}
        onClick={() => setSidebarOpen((o) => !o)}
      >
        {sidebarOpen ? "✕" : "☰"}
      </button>

      {/* Floating sidebar */}
      {sidebarOpen && (
      <aside style={styles.sidebarOverlay}>
        {selectedCity ? (
          <>
            <h2 style={styles.sideTitle}>{selectedCity.name}</h2>
            {selectedCity.description && (
              <p style={{ fontSize: 13, color: theme.textSecondary, marginTop: -4, marginBottom: 8, fontStyle: "italic" }}>{selectedCity.description}</p>
            )}
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
              {/* Visual stat bars */}
              {(() => {
                const gold = selectedCity.gold ?? 0;
                const garrison = selectedCity.garrison ?? 0;
                const dev = selectedCity.development ?? 0;
                const food = selectedCity.food ?? 100;
                const loyalty = cityLoyalty[selectedCity.id] ?? 50;
                const vuln = vulnerability[selectedCity.id];
                const StatBar = ({ label, value, max, color, text }: { label: string; value: number; max: number; color: string; text?: string }) => (
                  <div style={{ marginBottom: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: theme.textSecondary, marginBottom: 2 }}>
                      <span>{label}</span>
                      <span style={{ color, fontWeight: 600 }}>{text ?? value}</span>
                    </div>
                    <div style={{ height: 6, backgroundColor: theme.bg1, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, (value / max) * 100)}%`, backgroundColor: color, borderRadius: 3, transition: "width 0.3s ease" }} />
                    </div>
                  </div>
                );
                const goldColor = gold < 100 ? theme.danger : gold < 300 ? theme.accent : theme.accent;
                const foodColor = food < 30 ? theme.danger : food < 60 ? theme.accent : theme.success;
                const garrisonColor = garrison < 2 ? theme.danger : garrison < 5 ? theme.accent : theme.info;
                const loyaltyColor = loyalty < 20 ? theme.danger : loyalty < 40 ? theme.accent : theme.success;
                return (
                  <div style={{ marginTop: 4 }}>
                    <StatBar label="金幣" value={gold} max={800} color={goldColor} />
                    <StatBar label="守備" value={garrison} max={10} color={garrisonColor} />
                    <StatBar label="開發" value={dev} max={5} color={theme.special} text={`Lv.${dev}/5`} />
                    <StatBar label="糧食" value={food} max={200} color={foodColor} />
                    {selectedCity.controllerId && (
                      <StatBar label="忠誠" value={Math.round(loyalty)} max={100} color={loyaltyColor} />
                    )}
                    {vuln && (() => {
                      const colors: Record<string, string> = { strong: theme.success, moderate: theme.accent, weak: theme.danger };
                      const labels: Record<string, string> = { strong: "堅固", moderate: "普通", weak: "脆弱" };
                      return <StatBar label="防禦" value={vuln.score} max={50} color={colors[vuln.level] ?? theme.textSecondary} text={`${labels[vuln.level]}(${vuln.score})`} />;
                    })()}
                  </div>
                );
              })()}
              {/* Unit composition */}
              {selectedCity.units && (selectedCity.units.infantry + selectedCity.units.cavalry + selectedCity.units.archers > 0) && (
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>兵種</span>
                  <span style={{ fontSize: 12, color: theme.textBody }}>
                    步{selectedCity.units.infantry} 騎{selectedCity.units.cavalry} 弓{selectedCity.units.archers}
                  </span>
                </div>
              )}
              {(() => {
                // Check if this is the last city for its faction
                const controllerFaction = factions.find((f) => f.members.includes(selectedCity.controllerId ?? ""));
                if (controllerFaction && controllerFaction.cities.length === 1 && controllerFaction.cities[0] === selectedCity.id) {
                  return (
                    <div style={{ ...styles.infoRow, color: theme.warning }}>
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
                  <span style={{ color: theme.success, fontWeight: 600 }}>
                    {SPECIALTY_LABELS[selectedCity.specialty] ?? selectedCity.specialty}
                  </span>
                </div>
              )}
              {selectedCity.specialty && (
                <div style={{ ...styles.infoRow, fontSize: 11 }}>
                  <span style={styles.infoLabel}>效果</span>
                  <span style={{ color: theme.textSecondary }}>
                    {SPECIALTY_EFFECTS[selectedCity.specialty] ?? ""}
                    {selectedCity.improvement ? " (強化)" : ""}
                  </span>
                </div>
              )}
              {selectedCity.improvement && (
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>改良</span>
                  <span style={{ color: theme.accent, fontWeight: 600 }}>{selectedCity.improvement}</span>
                </div>
              )}
              {selectedCity.siegedBy && (
                <div style={{ ...styles.infoRow, color: theme.danger }}>
                  <span style={styles.infoLabel}>圍城中</span>
                  <span style={{ fontWeight: 700 }}>{selectedCity.siegedBy}</span>
                </div>
              )}
              {selectedCity.controllerId && supplyStatus[selectedCity.id] !== undefined && (
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>補給</span>
                  <span style={{ color: supplyStatus[selectedCity.id] ? theme.success : theme.danger, fontWeight: 600 }}>
                    {supplyStatus[selectedCity.id] ? "已補給" : "補給中斷 (-30%金)"}
                  </span>
                </div>
              )}
            </div>

            {/* Command buttons */}
            {selectedChar && (
              <div style={styles.cmdSection}>
                <p style={styles.cmdLabel}>指令目標：{selectedCity.name}</p>
                {prediction && selectedCity.status !== "allied" && (
                  <div style={styles.predictionRow}>
                    <span style={{ color: prediction.winRate >= 50 ? theme.success : theme.danger, fontWeight: 700, fontSize: 14 }}>
                      勝率 {prediction.winRate}%
                    </span>
                    <span style={{ fontSize: 11, color: theme.textSecondary }}>
                      攻:{prediction.attackPower} vs 守:{prediction.defensePower}
                    </span>
                  </div>
                )}
                {selectedCity && reachableCityIds.size > 0 && !reachableCityIds.has(selectedCity.id) ? (
                  <div style={{ fontSize: 12, color: theme.textSecondary, padding: "6px 0" }}>
                    無道路連接
                  </div>
                ) : (
                  <div style={styles.cmdButtons}>
                    <button style={styles.cmdMove} onClick={() => handleCommand("move")}>
                      移動至此
                    </button>
                    <button style={styles.cmdAttack} onClick={() => handleCommand("attack")}>
                      攻擊此城
                    </button>
                  </div>
                )}
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, color: theme.textSecondary }}>戰術：</span>
                  <select
                    style={styles.tacticSelect}
                    value={tactic}
                    onChange={(e) => setTactic(e.target.value as "aggressive" | "defensive" | "balanced")}
                  >
                    <option value="balanced">均衡</option>
                    <option value="aggressive">猛攻（攻+30% 守-15%）</option>
                    <option value="defensive">防守（守+30% 攻-15%）</option>
                  </select>
                </div>
                {selectedCity.status !== "allied" && (
                  <div style={{ ...styles.cmdButtons, marginTop: 6 }}>
                    <button style={styles.spyBtn} onClick={() => handleSpy("spy")}>
                      偵查（100金）
                    </button>
                    <button style={styles.sabotageBtn} onClick={() => handleSpy("sabotage")}>
                      破壞（100金）
                    </button>
                    <button style={{ ...styles.sabotageBtn, backgroundColor: theme.info }} onClick={() => handleSpy("blockade")}>
                      封鎖（100金）
                    </button>
                  </div>
                )}
                {/* Siege engine button: when selected char is at a city being besieged by shu */}
                {selectedCity.siegedBy && (
                  <button
                    style={{ ...styles.reinforceBtn, backgroundColor: theme.special, marginTop: 6 }}
                    onClick={() => {
                      trpc.simulation.queueCommand.mutate({
                        type: "build_siege",
                        characterId: selectedChar,
                        targetCityId: selectedCity.id,
                      }).then(() => setCommandCount((c) => c + 1));
                    }}
                  >
                    攻城器械（300金，戰術≥2）
                  </button>
                )}
                {/* Diplomatic demand buttons for enemy cities */}
                {selectedCity.status === "hostile" && (
                  <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                    <button
                      style={{ ...styles.reinforceBtn, backgroundColor: theme.accent, fontSize: 11, flex: 1 }}
                      onClick={() => {
                        trpc.simulation.queueCommand.mutate({
                          type: "demand",
                          characterId: selectedChar,
                          targetCityId: selectedCity.id,
                          demandType: "tribute",
                          demandAmount: 100,
                        }).then(() => setCommandCount((c) => c + 1));
                      }}
                    >
                      索求歲幣（100金）
                    </button>
                    {selectedCity.siegedBy && (
                      <button
                        style={{ ...styles.reinforceBtn, backgroundColor: theme.warning, fontSize: 11, flex: 1 }}
                        onClick={() => {
                          trpc.simulation.queueCommand.mutate({
                            type: "demand",
                            characterId: selectedChar,
                            targetCityId: selectedCity.id,
                            demandType: "withdraw",
                          }).then(() => setCommandCount((c) => c + 1));
                        }}
                      >
                        要求撤退
                      </button>
                    )}
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
                {(selectedCity.gold ?? 0) >= 200 && (() => {
                  const playerFaction = factions.find((f) => f.id === "shu");
                  if (!playerFaction) return null;
                  const otherCities = mapData?.cities.filter(
                    (c) => c.id !== selectedCity.id && c.status === "allied" && !c.siegedBy,
                  ) ?? [];
                  if (otherCities.length === 0) return null;
                  return (
                    <>
                      <p style={{ ...styles.cmdLabel, marginTop: 8 }}>建立貿易路線（200 金，+10金/天）</p>
                      <select
                        style={styles.tacticSelect}
                        onChange={(e) => { if (e.target.value) handleEstablishTrade(e.target.value); e.target.value = ""; }}
                        defaultValue=""
                      >
                        <option value="" disabled>選擇目標城市</option>
                        {otherCities.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </>
                  );
                })()}
                {/* District display and build */}
                {(() => {
                  const districts = selectedCity.districts ?? [];
                  return (
                    <div style={{ marginTop: 8 }}>
                      <p style={{ ...styles.cmdLabel, marginBottom: 4 }}>區域 ({districts.length}/2)</p>
                      {districts.map((d, i) => (
                        <div key={i} style={{ fontSize: 11, color: theme.textSecondary }}>
                          {DISTRICT_LABELS[d.type] ?? d.type} — {DISTRICT_EFFECTS[d.type] ?? ""}
                        </div>
                      ))}
                      {districts.length < 2 && (selectedCity.development ?? 0) >= 2 && (selectedCity.gold ?? 0) >= 400 && (
                        <select
                          style={{ ...styles.tacticSelect, marginTop: 4 }}
                          onChange={(e) => {
                            if (!e.target.value) return;
                            trpc.simulation.queueCommand.mutate({
                              type: "build_district",
                              characterId: "liu_bei",
                              targetCityId: selectedCity.id,
                              districtType: e.target.value as "defense" | "commerce" | "agriculture" | "recruitment",
                            }).then(() => setCommandCount((c) => c + 1));
                            e.target.value = "";
                          }}
                          defaultValue=""
                        >
                          <option value="" disabled>建造區域（400金）</option>
                          {(["defense", "commerce", "agriculture", "recruitment"] as const)
                            .filter((t) => !districts.some((d) => d.type === t))
                            .map((t) => (
                              <option key={t} value={t}>{DISTRICT_LABELS[t]} — {DISTRICT_EFFECTS[t]}</option>
                            ))}
                        </select>
                      )}
                    </div>
                  );
                })()}
                {/* Unit training */}
                {(selectedCity.gold ?? 0) >= 80 && (
                  <div style={{ marginTop: 8 }}>
                    <p style={{ ...styles.cmdLabel, marginBottom: 4 }}>
                      訓練兵種（步{(selectedCity.units?.infantry ?? 1)} 騎{(selectedCity.units?.cavalry ?? 0)} 弓{(selectedCity.units?.archers ?? 0)}）
                    </p>
                    <div style={{ display: "flex", gap: 4 }}>
                      {([["infantry", "步兵", 80], ["cavalry", "騎兵", 150], ["archers", "弓兵", 120]] as const).map(([type, label, cost]) => (
                        (selectedCity.gold ?? 0) >= cost && (
                          <button
                            key={type}
                            style={{ ...styles.reinforceBtn, fontSize: 10, flex: 1, backgroundColor: type === "cavalry" ? theme.special : type === "archers" ? theme.success : theme.info }}
                            onClick={() => {
                              trpc.simulation.queueCommand.mutate({
                                type: "train_unit",
                                characterId: "liu_bei",
                                targetCityId: selectedCity.id,
                                unitType: type,
                              }).then(() => setCommandCount((c) => c + 1));
                            }}
                          >
                            {label}（{cost}金）
                          </button>
                        )
                      ))}
                    </div>
                  </div>
                )}
                {/* City specialization path */}
                {selectedCity.development >= 3 && (
                  <div style={{ marginTop: 8 }}>
                    <p style={{ ...styles.cmdLabel, marginBottom: 4 }}>
                      城市路線{selectedCity.path ? `：${{ fortress: "要塞", trade_hub: "商都", cultural: "文化", breadbasket: "糧倉" }[selectedCity.path] ?? selectedCity.path}` : "（未選擇）"}
                    </p>
                    {!selectedCity.path && (selectedCity.gold ?? 0) >= 400 && (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {([["fortress", "要塞", "防禦+20%"], ["trade_hub", "商都", "收入+50%"], ["cultural", "文化", "士氣+5,聲望+2"], ["breadbasket", "糧倉", "糧食+50%"]] as const).map(([path, label, desc]) => (
                          <button
                            key={path}
                            style={{ ...styles.reinforceBtn, fontSize: 10, flex: 1, backgroundColor: theme.special }}
                            title={desc}
                            onClick={() => {
                              trpc.simulation.queueCommand.mutate({
                                type: "set_path",
                                characterId: "liu_bei",
                                targetCityId: selectedCity.id,
                                cityPath: path,
                              }).then(() => setCommandCount((c) => c + 1));
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
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
                {charsInCity.map((c) => {
                  const isNeutral = neutralCharIds.has(c.id);
                  return (
                    <div
                      key={c.id}
                      style={{
                        ...styles.charItem,
                        border: selectedChar === c.id ? `1px solid ${theme.accent}` : isNeutral ? `1px solid ${theme.textMuted}` : "1px solid transparent",
                        cursor: "pointer",
                      }}
                      onClick={() => !isNeutral && setSelectedChar(selectedChar === c.id ? null : c.id)}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={styles.charName}>
                          {c.name}
                          {isNeutral && <span style={styles.neutralTag}>在野</span>}
                        </span>
                        <div style={{ display: "flex", gap: 4 }}>
                          {isNeutral && selectedCity?.status === "allied" && (
                            <button
                              style={styles.hireBtn}
                              onClick={(e) => { e.stopPropagation(); handleHireNeutral(c.id); }}
                            >
                              招募(200金)
                            </button>
                          )}
                          <button
                            style={styles.detailBtn}
                            onClick={(e) => { e.stopPropagation(); setDetailCharId(c.id); }}
                          >
                            詳情
                          </button>
                        </div>
                      </div>
                      <span style={styles.charTraits}>{c.traits.join("、")}</span>
                      {selectedChar === c.id && (
                        <span style={styles.selectedTag}>已選取</span>
                      )}
                    </div>
                  );
                })}
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
                    <div
                      key={i}
                      style={{ ...styles.battleItem, cursor: b.rounds ? "pointer" : "default" }}
                      onClick={() => b.rounds && setExpandedBattle(expandedBattle === i ? null : i)}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={styles.battleDay}>Day {b.tick}</span>
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          {b.tactic && (
                            <span style={{ fontSize: 10, color: theme.special, fontWeight: 600 }}>
                              {b.tactic === "aggressive" ? "猛攻" : b.tactic === "defensive" ? "堅守" : "平衡"}
                            </span>
                          )}
                          {b.attackPower != null && (
                            <span style={{ fontSize: 10, color: theme.textMuted }}>
                              [{b.attackPower} vs {b.defensePower}]
                            </span>
                          )}
                          {b.rounds && (
                            <span style={{ fontSize: 10, color: theme.textMuted }}>{expandedBattle === i ? "▲" : "▼"}</span>
                          )}
                        </div>
                      </div>
                      <p style={styles.battleText}>
                        {b.attackerName} {b.captured ? "攻陷" : "未能攻下"}{" "}
                        <strong>{b.cityName}</strong>
                        {b.defenderName && ` (守將：${b.defenderName})`}
                      </p>
                      {expandedBattle === i && b.rounds && (
                        <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${theme.bg3}`, display: "flex", flexDirection: "column", gap: 3 }}>
                          {b.rounds.map((r, ri) => (
                            <div key={ri} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11, padding: "2px 4px", backgroundColor: theme.bg1, borderRadius: 3 }}>
                              <span style={{ color: theme.textPrimary, fontWeight: 600, width: 60, flexShrink: 0 }}>{r.phase}</span>
                              <span style={{ color: theme.danger }}>攻+{r.attackerDelta}</span>
                              <span style={{ color: theme.info }}>守+{r.defenderDelta}</span>
                              {r.note && <span style={{ color: theme.textSecondary, marginLeft: "auto", fontSize: 10 }}>{r.note}</span>}
                            </div>
                          ))}
                        </div>
                      )}
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
      )}

      {/* Character detail modal */}
      {detailCharId && (
        <CharacterDetail
          characterId={detailCharId}
          factionName={factions.find((f) => f.members.includes(detailCharId))?.leaderName}
          factionColor={factionColors.get(detailCharId)}
          cityName={mapData?.cities.find((c) => c.id === mapData?.characters.find((ch) => ch.id === detailCharId)?.cityId)?.name}
          isPlayerFaction={factions.find((f) => f.id === "shu")?.members.includes(detailCharId)}
          currentTick={currentTick}
          onClose={() => setDetailCharId(null)}
          onCharacterClick={(id) => setDetailCharId(id)}
          onAssignRole={(charId, role) => handleAssignRole(charId, role)}
        />
      )}
    </div>
  );
}

function statusColor(status: string): string {
  switch (status) {
    case "allied": return theme.info;
    case "hostile": return theme.danger;
    case "neutral": return theme.textPrimary;
    case "dead": return theme.textMuted;
    default: return theme.textSecondary;
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
  layout: { position: "relative", flex: 1, height: "100%", overflow: "hidden" },
  mapContainer: { position: "absolute", inset: 0, display: "flex", flexDirection: "column" },
  loading: { height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: theme.textMuted },
  headerOverlay: {
    position: "absolute", top: 12, left: 12, zIndex: 500,
    display: "flex", alignItems: "center", gap: 10,
    backgroundColor: theme.bg1a, backdropFilter: "blur(8px)",
    padding: "8px 16px", borderRadius: 10,
    pointerEvents: "auto",
  },
  title: { fontSize: 18, fontWeight: "bold", margin: 0, color: theme.textPrimary },
  tick: { fontSize: 13, color: theme.accent, fontWeight: 600 },
  cmdBadge: { fontSize: 12, color: theme.bg1, backgroundColor: theme.accent, padding: "2px 8px", borderRadius: 10, fontWeight: 700 },
  button: { padding: "6px 14px", borderRadius: 6, border: "none", backgroundColor: theme.accent, color: theme.bg1, fontSize: 13, fontWeight: 700 },
  timelineOverlay: {
    position: "absolute", bottom: 12, left: 12, zIndex: 500,
    backgroundColor: theme.bg1a, backdropFilter: "blur(8px)",
    padding: "6px 12px", borderRadius: 10,
    pointerEvents: "auto",
  },
  sidebarToggle: {
    position: "absolute", top: 12, right: 12, zIndex: 600,
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: theme.bg1a, border: `1px solid ${theme.bg3}`,
    color: theme.textPrimary, cursor: "pointer", fontSize: 18,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  sidebarOverlay: {
    position: "absolute", top: 56, right: 12, bottom: 12,
    width: 280, zIndex: 500,
    backgroundColor: theme.bg2a, backdropFilter: "blur(12px)",
    borderRadius: 12, padding: 16, overflowY: "auto",
    color: theme.textPrimary,
    pointerEvents: "auto",
  },
  sideTitle: { fontSize: 18, fontWeight: "bold", marginTop: 0, marginBottom: 16 },
  sideSubtitle: { fontSize: 14, fontWeight: 600, marginTop: 16, marginBottom: 8, paddingTop: 12, borderTop: `1px solid ${theme.bg3}` },
  cityInfo: { display: "flex", flexDirection: "column", gap: 8 },
  infoRow: { display: "flex", justifyContent: "space-between", fontSize: 14 },
  infoLabel: { color: theme.textSecondary },
  hint: { color: theme.textMuted, fontStyle: "italic" },
  emptyText: { fontSize: 13, color: theme.textMuted, fontStyle: "italic" },
  charList: { display: "flex", flexDirection: "column", gap: 6 },
  charItem: { padding: "6px 10px", backgroundColor: theme.bg1t, borderRadius: 6 },
  charName: { fontSize: 14, fontWeight: 600, display: "block" },
  charTraits: { fontSize: 12, color: theme.textSecondary, display: "block", marginTop: 2 },
  selectedTag: { fontSize: 10, color: theme.accent, fontWeight: 700, marginTop: 4, display: "block" },
  detailBtn: { fontSize: 11, padding: "2px 8px", borderRadius: 4, border: `1px solid ${theme.bg3}`, backgroundColor: "transparent", color: theme.textSecondary, cursor: "pointer" },
  cmdSection: { marginTop: 12, padding: "10px 12px", backgroundColor: theme.bg1t, borderRadius: 8, borderLeft: `3px solid ${theme.accent}` },
  cmdLabel: { fontSize: 12, color: theme.accent, margin: "0 0 8px" },
  predictionRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  cmdButtons: { display: "flex", gap: 8 },
  cmdMove: { flex: 1, padding: "6px 0", borderRadius: 4, border: "none", backgroundColor: theme.info, color: theme.textPrimary, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  cmdAttack: { flex: 1, padding: "6px 0", borderRadius: 4, border: "none", backgroundColor: theme.danger, color: theme.textPrimary, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  reinforceBtn: { width: "100%", padding: "6px 0", borderRadius: 4, border: "none", backgroundColor: theme.info, color: theme.textPrimary, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  developBtn: { width: "100%", padding: "6px 0", borderRadius: 4, border: "none", backgroundColor: theme.special, color: theme.textPrimary, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  improvementBtn: { width: "100%", padding: "6px 0", borderRadius: 4, border: "none", backgroundColor: theme.success, color: theme.bg1, fontSize: 13, fontWeight: 700, cursor: "pointer" },
  spyBtn: { flex: 1, padding: "6px 0", borderRadius: 4, border: "none", backgroundColor: theme.indigo, color: theme.textPrimary, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  sabotageBtn: { flex: 1, padding: "6px 0", borderRadius: 4, border: "none", backgroundColor: theme.special, color: theme.textPrimary, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  factionList: { display: "flex", flexDirection: "column", gap: 6 },
  factionItem: { display: "flex", alignItems: "center", gap: 8, fontSize: 13 },
  factionDot: { width: 10, height: 10, borderRadius: "50%", flexShrink: 0 },
  factionName: { fontWeight: 600 },
  factionStats: { color: theme.textSecondary, marginLeft: "auto" },
  battleList: { display: "flex", flexDirection: "column", gap: 6 },
  battleItem: { padding: "6px 10px", backgroundColor: theme.bg1t, borderRadius: 6, borderLeft: `3px solid ${theme.danger}` },
  battleDay: { fontSize: 11, color: theme.accent, fontWeight: 600 },
  battleText: { fontSize: 13, color: theme.textBody, margin: "4px 0 0", lineHeight: 1.4 },
  neutralTag: { fontSize: 10, color: theme.textSecondary, marginLeft: 6, fontWeight: 400, fontStyle: "italic" },
  hireBtn: { fontSize: 11, padding: "2px 8px", borderRadius: 4, border: "none", backgroundColor: theme.accent, color: theme.bg1, fontWeight: 700, cursor: "pointer" },
  tacticSelect: { fontSize: 12, padding: "3px 8px", borderRadius: 4, border: `1px solid ${theme.bg3}`, backgroundColor: theme.bg1, color: theme.textPrimary, cursor: "pointer", flex: 1 },
};
