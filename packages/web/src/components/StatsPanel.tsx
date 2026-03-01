"use client";

import { useState, useEffect, useCallback } from "react";
import { trpc } from "../lib/trpc";
import { theme } from "../lib/theme";

interface FactionStat {
  id: string;
  name: string;
  color: string;
  gold: number;
  cities: number;
  characters: number;
  power: number;
  morale: number;
  legacy: number;
  exhaustion: number;
}

type AlliancePair = [string, string];

interface Technology {
  id: string;
  name: string;
  description: string;
  cost: number;
  turns: number;
}

const TECHNOLOGIES: Technology[] = [
  { id: "iron_working", name: "鍛鐵術", description: "鍛冶場效果+50%", cost: 500, turns: 5 },
  { id: "archery", name: "弓術", description: "全員智力+5", cost: 400, turns: 4 },
  { id: "logistics", name: "兵站學", description: "移動速度+1", cost: 600, turns: 6 },
  { id: "spy_network", name: "諜報網", description: "諜報成功率+20%", cost: 450, turns: 4 },
  { id: "divine_strategy", name: "神算", description: "全員戰術+5", cost: 700, turns: 8 },
];

interface FactionTechState {
  completed: string[];
  current: { techId: string; startTick: number } | null;
}

interface CityInfo {
  id: string;
  name: string;
  garrison: number;
  gold: number;
  food?: number;
  development: number;
  controllerId?: string;
  loyalty?: number;
  specialty?: string;
  tier?: string;
}

interface CharacterInfo {
  id: string;
  name: string;
  avatarUrl?: string;
  military: number;
  intelligence: number;
  charm: number;
  cityId?: string;
  role?: string;
  skills?: { leadership: number; tactics: number; commerce: number; espionage: number };
}

interface StatsPanelProps {
  currentTick: number;
  onMessage?: (text: string, color: string) => void;
  onViewCharacter?: (id: string) => void;
}

const ROLE_LABELS: Record<string, string> = {
  general: "將軍",
  governor: "太守",
  diplomat: "外交官",
  spymaster: "間諜頭子",
};

export function StatsPanel({ currentTick, onMessage, onViewCharacter }: StatsPanelProps) {
  const [stats, setStats] = useState<FactionStat[]>([]);
  const [alliances, setAlliances] = useState<AlliancePair[]>([]);
  const [history, setHistory] = useState<Record<string, { tick: number; power: number }[]>>({});
  const [techs, setTechs] = useState<Record<string, FactionTechState>>({});
  const [trustMap, setTrustMap] = useState<Record<string, number>>({});
  const [traditions, setTraditions] = useState<Record<string, { tradition: string; label: string; description: string } | null>>({});
  const [cities, setCities] = useState<CityInfo[]>([]);
  const [characters, setCharacters] = useState<CharacterInfo[]>([]);
  const [factionMembers, setFactionMembers] = useState<string[]>([]);
  const [expandedCity, setExpandedCity] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const [s, a, h, t, tr, trad, mapData, chars, factions] = await Promise.all([
        trpc.simulation.getFactionStats.query(),
        trpc.simulation.getAlliances.query(),
        trpc.simulation.getFactionHistory.query(),
        trpc.simulation.getFactionTechs.query(),
        trpc.simulation.getFactionTrust.query(),
        trpc.simulation.getFactionTraditions.query(),
        trpc.map.getMapData.query({ tick: currentTick }),
        trpc.character.getAll.query(),
        trpc.simulation.getFactions.query(),
      ]);
      setStats(s as FactionStat[]);
      setAlliances(a as unknown as AlliancePair[]);
      setHistory(h as Record<string, { tick: number; power: number }[]>);
      setTechs(t as Record<string, FactionTechState>);
      setTrustMap(tr as Record<string, number>);
      setTraditions(trad as Record<string, { tradition: string; label: string; description: string } | null>);
      setCities((mapData as { cities: CityInfo[] }).cities ?? []);
      setCharacters(chars as CharacterInfo[]);
      const shuFaction = (factions as { id: string; members: string[] }[]).find((f) => f.id === "shu");
      setFactionMembers(shuFaction?.members ?? []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [currentTick]);

  useEffect(() => {
    fetchStats();
  }, [currentTick, fetchStats]);

  const handlePropose = async (factionId: string) => {
    const result = await trpc.simulation.proposeAlliance.mutate({ factionId });
    if (result.success) fetchStats();
    onMessage?.(result.reason, result.success ? theme.success : theme.danger);
  };

  const handleBreak = async (factionId: string) => {
    const result = await trpc.simulation.breakAlliance.mutate({ factionId });
    if (result.success) fetchStats();
    onMessage?.(result.reason, result.success ? theme.accent : theme.danger);
  };

  const handleResearch = async (techId: string) => {
    try {
      await trpc.simulation.queueCommand.mutate({
        type: "start_research",
        characterId: "liu_bei",
        targetCityId: "",
        techId,
      });
      onMessage?.(`開始研發 ${TECHNOLOGIES.find((t) => t.id === techId)?.name ?? techId}`, theme.info);
      fetchStats();
    } catch {
      onMessage?.("研發指令失敗", theme.danger);
    }
  };

  if (loading) {
    return <div style={styles.loading}>Loading stats...</div>;
  }

  const playerStat = stats.find((s) => s.id === "shu");
  const otherStats = stats.filter((s) => s.id !== "shu");
  const playerCities = cities.filter((c) => c.controllerId && factionMembers.includes(c.controllerId));
  const playerChars = characters.filter((c) => factionMembers.includes(c.id));
  const charMap = new Map(characters.map((c) => [c.id, c]));

  const isAllied = (factionId: string): boolean =>
    alliances.some((a) => (a[0] === "shu" && a[1] === factionId) || (a[0] === factionId && a[1] === "shu"));

  return (
    <div style={styles.container}>
      {/* ── 己方勢力 Section ── */}
      {playerStat && (
        <div style={styles.playerSection}>
          <div style={styles.playerHeader}>
            <h2 style={{ ...styles.sectionTitle, color: playerStat.color }}>己方勢力 — {playerStat.name}</h2>
            <span style={styles.tickBadge}>Day {currentTick}</span>
          </div>

          {/* Overview bar */}
          <div style={styles.overviewBar}>
            <OverviewChip label="金幣" value={playerStat.gold} color={theme.accent} />
            <OverviewChip label="城市" value={playerStat.cities} color={theme.info} />
            <OverviewChip label="武將" value={playerStat.characters} color={theme.success} />
            <OverviewChip label="軍力" value={playerStat.power} color={theme.danger} />
            <OverviewChip label="士氣" value={playerStat.morale} color={playerStat.morale >= 60 ? theme.success : playerStat.morale >= 30 ? theme.accent : theme.danger} />
            <OverviewChip label="疲乏" value={playerStat.exhaustion} color={playerStat.exhaustion >= 70 ? theme.danger : theme.textMuted} />
          </div>

          {/* Tradition */}
          {traditions["shu"] && (
            <div style={styles.traditionBadge}>
              <span style={{ fontSize: 12, color: theme.special, fontWeight: 600 }}>{traditions["shu"]!.label}</span>
              <span style={{ fontSize: 10, color: theme.textSecondary, marginLeft: 6 }}>{traditions["shu"]!.description}</span>
            </div>
          )}

          {/* City list */}
          <div style={styles.subSection}>
            <h3 style={styles.subTitle}>城市 ({playerCities.length})</h3>
            <div style={styles.cityList}>
              {playerCities.map((city) => {
                const charsInCity = playerChars.filter((c) => c.cityId === city.id);
                const isExpanded = expandedCity === city.id;
                return (
                  <div key={city.id}>
                    <div
                      style={{ ...styles.cityRow, backgroundColor: isExpanded ? theme.bg3 : theme.bg1 }}
                      onClick={() => setExpandedCity(isExpanded ? null : city.id)}
                    >
                      <span style={styles.cityName}>{city.name}</span>
                      {city.tier && <span style={styles.tierTag}>{city.tier === "major" ? "主城" : "小城"}</span>}
                      {city.specialty && <span style={styles.specialtyTag}>{city.specialty}</span>}
                      <span style={{ ...styles.cityStatChip, color: theme.danger }}>兵{city.garrison}</span>
                      <span style={{ ...styles.cityStatChip, color: theme.accent }}>金{city.gold}</span>
                      <span style={{ ...styles.cityStatChip, color: theme.success }}>糧{city.food ?? 100}</span>
                      <span style={{ ...styles.cityStatChip, color: theme.info }}>忠{city.loyalty ?? 50}</span>
                      <span style={{ ...styles.cityStatChip, color: theme.textMuted }}>發{city.development}</span>
                      <span style={styles.charCount}>{charsInCity.length}將</span>
                      <span style={styles.expandIcon}>{isExpanded ? "▼" : "▶"}</span>
                    </div>
                    {isExpanded && (
                      <div style={styles.cityDetail}>
                        {charsInCity.length === 0 ? (
                          <span style={{ fontSize: 12, color: theme.textMuted, fontStyle: "italic" }}>無武將駐紮</span>
                        ) : (
                          charsInCity.map((ch) => (
                            <div
                              key={ch.id}
                              style={styles.charMiniRow}
                              onClick={(e) => { e.stopPropagation(); onViewCharacter?.(ch.id); }}
                            >
                              {ch.avatarUrl ? (
                                <img src={ch.avatarUrl} alt={ch.name} style={styles.charMiniAvatar} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                              ) : (
                                <div style={styles.charMiniFallback}>{ch.name.charAt(0)}</div>
                              )}
                              <span style={styles.charMiniName}>{ch.name}</span>
                              <span style={{ fontSize: 11, color: theme.danger }}>武{ch.military}</span>
                              <span style={{ fontSize: 11, color: theme.info }}>智{ch.intelligence}</span>
                              <span style={{ fontSize: 11, color: theme.accent }}>魅{ch.charm}</span>
                              {ch.role && <span style={styles.charMiniRole}>{ROLE_LABELS[ch.role] ?? ch.role}</span>}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Character list */}
          <div style={styles.subSection}>
            <h3 style={styles.subTitle}>武將 ({playerChars.length})</h3>
            <div style={styles.charGrid}>
              {playerChars.map((ch) => {
                const cityName = cities.find((c) => c.id === ch.cityId)?.name;
                return (
                  <div
                    key={ch.id}
                    style={styles.charCard}
                    onClick={() => onViewCharacter?.(ch.id)}
                  >
                    {ch.avatarUrl ? (
                      <img src={ch.avatarUrl} alt={ch.name} style={styles.charAvatar} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div style={styles.charAvatarFallback}>{ch.name.charAt(0)}</div>
                    )}
                    <div style={styles.charCardInfo}>
                      <span style={styles.charCardName}>{ch.name}</span>
                      <div style={styles.charCardStats}>
                        <span style={{ color: theme.danger }}>武{ch.military}</span>
                        <span style={{ color: theme.info }}>智{ch.intelligence}</span>
                        <span style={{ color: theme.accent }}>魅{ch.charm}</span>
                      </div>
                      <div style={styles.charCardMeta}>
                        {ch.role && <span style={styles.charRoleTag}>{ROLE_LABELS[ch.role] ?? ch.role}</span>}
                        {cityName && <span style={styles.charCityTag}>{cityName}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Technology (player only) */}
          {techs["shu"] && (
            <div style={styles.subSection}>
              <h3 style={styles.subTitle}>科技</h3>
              <div style={styles.techList}>
                {TECHNOLOGIES.map((tech) => {
                  const state = techs["shu"];
                  const completed = state.completed.includes(tech.id);
                  const researching = state.current?.techId === tech.id;
                  const progress = researching ? Math.min(1, (currentTick - state.current!.startTick) / tech.turns) : 0;
                  return (
                    <div key={tech.id} style={styles.techItem}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: completed ? theme.success : researching ? theme.accent : theme.textMuted, fontWeight: 600 }}>
                          {completed ? "✓ " : ""}{tech.name}
                        </span>
                        {!completed && !researching && !state.current && (
                          <button style={styles.researchBtn} onClick={() => handleResearch(tech.id)}>
                            研發({tech.cost}金/{tech.turns}天)
                          </button>
                        )}
                      </div>
                      {researching && (
                        <div style={styles.techBar}>
                          <div style={{ ...styles.techFill, width: `${progress * 100}%` }} />
                        </div>
                      )}
                      <span style={{ fontSize: 10, color: theme.textMuted }}>{tech.description}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Other Factions (Diplomacy) ── */}
      <div style={styles.diplomacySection}>
        <h2 style={styles.sectionTitle}>外交情勢</h2>
        <div style={styles.grid}>
          {otherStats.map((f) => {
            const maxPower = Math.max(...stats.map((s) => s.power), 1);
            const trustKey = ["shu", f.id].sort().join(":");
            const trust = trustMap[trustKey] ?? 50;
            return (
              <div key={f.id} style={{ ...styles.card, borderLeft: `4px solid ${f.color}` }}>
                <div style={styles.cardHeader}>
                  <span style={{ ...styles.factionName, color: f.color }}>{f.name}</span>
                  <span style={styles.factionId}>{f.id.toUpperCase()}</span>
                </div>

                <div style={styles.statRow}>
                  <span style={styles.statLabel}>城市</span>
                  <span style={styles.statValue}>{f.cities}</span>
                </div>
                <div style={styles.statRow}>
                  <span style={styles.statLabel}>武將</span>
                  <span style={styles.statValue}>{f.characters}</span>
                </div>
                <div style={styles.statRow}>
                  <span style={styles.statLabel}>軍力</span>
                  <div style={styles.barWrap}>
                    <div style={{ ...styles.bar, width: `${(f.power / maxPower) * 100}%`, backgroundColor: theme.danger }} />
                  </div>
                  <span style={styles.statValue}>{f.power}</span>
                </div>
                <div style={styles.statRow}>
                  <span style={styles.statLabel}>金幣</span>
                  <span style={styles.statValue}>{f.gold}</span>
                </div>
                <div style={styles.statRow}>
                  <span style={styles.statLabel}>士氣</span>
                  <span style={styles.statValue}>{f.morale}</span>
                </div>

                {/* Power trend sparkline */}
                {history[f.id] && history[f.id].length > 1 && (
                  <div style={styles.sparklineWrap}>
                    <span style={{ fontSize: 11, color: theme.textMuted }}>軍力趨勢</span>
                    <Sparkline data={history[f.id].map((e) => e.power)} color={f.color} />
                  </div>
                )}

                {/* Trust + diplomacy buttons */}
                <div style={styles.diplomacyRow}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, width: "100%" }}>
                    <span style={{ fontSize: 11, color: theme.textSecondary }}>信任</span>
                    <div style={{ flex: 1, height: 4, backgroundColor: theme.bg1, borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${trust}%`, backgroundColor: trust >= 60 ? theme.success : trust >= 30 ? theme.accent : theme.danger, borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 11, color: theme.textSecondary }}>{trust}</span>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {isAllied(f.id) ? (
                      <button style={styles.breakBtn} onClick={() => handleBreak(f.id)}>解除同盟</button>
                    ) : (
                      <button style={styles.allyBtn} onClick={() => handlePropose(f.id)}>提議結盟</button>
                    )}
                    <button
                      style={{ ...styles.dipBtn, backgroundColor: theme.indigo }}
                      onClick={async () => {
                        try {
                          await trpc.simulation.queueCommand.mutate({ type: "sow_discord", characterId: "liu_bei", targetCityId: "", targetFactionId: f.id });
                          onMessage?.(`對 ${f.id} 發動離間計（150金）`, theme.indigo);
                          fetchStats();
                        } catch { onMessage?.("離間計指令失敗", theme.danger); }
                      }}
                    >離間計</button>
                    <button
                      style={{ ...styles.dipBtn, backgroundColor: "#0891b2" }}
                      onClick={async () => {
                        try {
                          await trpc.simulation.queueCommand.mutate({ type: "propose_nap", characterId: "liu_bei", targetCityId: "", targetFactionId: f.id });
                          onMessage?.(`向 ${f.id} 提議互不侵犯條約`, "#0891b2");
                        } catch { onMessage?.("指令失敗", theme.danger); }
                      }}
                    >互不侵犯</button>
                    <button
                      style={{ ...styles.dipBtn, backgroundColor: theme.info }}
                      onClick={async () => {
                        try {
                          await trpc.simulation.queueCommand.mutate({ type: "propose_defense_pact", characterId: "liu_bei", targetCityId: "", targetFactionId: f.id });
                          onMessage?.(`向 ${f.id} 提議互助防禦條約`, theme.info);
                        } catch { onMessage?.("指令失敗", theme.danger); }
                      }}
                    >互助防禦</button>
                  </div>
                </div>

                {/* Other faction tech */}
                {techs[f.id] && (
                  <div style={styles.techSection}>
                    <span style={{ fontSize: 11, color: theme.textSecondary }}>科技: {techs[f.id].completed.map((t) => TECHNOLOGIES.find((tt) => tt.id === t)?.name ?? t).join(", ") || "無"}</span>
                  </div>
                )}

                {traditions[f.id] && (
                  <div style={styles.traditionBadge}>
                    <span style={{ fontSize: 12, color: theme.special, fontWeight: 600 }}>{traditions[f.id]!.label}</span>
                    <span style={{ fontSize: 10, color: theme.textSecondary, marginLeft: 6 }}>{traditions[f.id]!.description}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Current alliances */}
      {alliances.length > 0 && (
        <div style={styles.allianceSection}>
          <h2 style={styles.sectionTitle}>同盟關係</h2>
          <div style={styles.allianceList}>
            {alliances.map((a, i) => {
              const fA = stats.find((s) => s.id === a[0]);
              const fB = stats.find((s) => s.id === a[1]);
              return (
                <div key={i} style={styles.allianceItem}>
                  <span style={{ color: fA?.color ?? "#fff", fontWeight: 600 }}>{fA?.name ?? a[0]}</span>
                  <span style={styles.allianceArrow}>&harr;</span>
                  <span style={{ color: fB?.color ?? "#fff", fontWeight: 600 }}>{fB?.name ?? a[1]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={styles.overviewChip}>
      <span style={{ fontSize: 11, color: theme.textSecondary }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 120;
  const h = 24;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    padding: 20,
    overflowY: "auto",
    gap: 20,
  },
  loading: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: theme.textMuted,
    fontSize: 18,
  },

  // Player section
  playerSection: {
    backgroundColor: theme.bg2,
    borderRadius: 10,
    padding: 20,
    border: `1px solid ${theme.bg3}`,
  },
  playerHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    margin: 0,
    color: theme.textPrimary,
  },
  tickBadge: {
    fontSize: 13,
    color: theme.accent,
    backgroundColor: theme.bg1,
    padding: "4px 10px",
    borderRadius: 6,
    fontWeight: 600,
  },
  overviewBar: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap" as const,
    marginBottom: 16,
  },
  overviewChip: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    padding: "8px 14px",
    backgroundColor: theme.bg1,
    borderRadius: 8,
    minWidth: 60,
  },
  traditionBadge: {
    marginTop: 8,
    padding: "4px 8px",
    backgroundColor: "#2a2230",
    borderRadius: 4,
  },

  // Sub-sections
  subSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTop: `1px solid ${theme.bg3}`,
  },
  subTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: theme.accent,
    margin: "0 0 10px",
  },

  // City list
  cityList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
    maxHeight: 300,
    overflowY: "auto" as const,
  },
  cityRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    transition: "background-color 0.15s",
  },
  cityName: {
    fontWeight: 600,
    color: theme.textPrimary,
    minWidth: 56,
  },
  tierTag: {
    fontSize: 10,
    padding: "1px 5px",
    borderRadius: 4,
    backgroundColor: theme.bg3,
    color: theme.textSecondary,
  },
  specialtyTag: {
    fontSize: 10,
    padding: "1px 5px",
    borderRadius: 4,
    backgroundColor: `${theme.accent}20`,
    color: theme.accent,
  },
  cityStatChip: {
    fontSize: 11,
    fontWeight: 600,
  },
  charCount: {
    fontSize: 11,
    color: theme.textMuted,
    marginLeft: "auto",
  },
  expandIcon: {
    fontSize: 10,
    color: theme.textMuted,
    width: 12,
  },
  cityDetail: {
    padding: "6px 12px 10px 20px",
    backgroundColor: theme.bg1,
    borderRadius: "0 0 6px 6px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  },

  // Character mini row (in city detail)
  charMiniRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "4px 6px",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 12,
  },
  charMiniAvatar: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    objectFit: "cover" as const,
    flexShrink: 0,
  },
  charMiniFallback: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    backgroundColor: theme.bg3,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
    color: theme.textSecondary,
    flexShrink: 0,
  },
  charMiniName: {
    fontWeight: 600,
    color: theme.textPrimary,
    minWidth: 40,
  },
  charMiniRole: {
    fontSize: 10,
    padding: "1px 5px",
    borderRadius: 4,
    backgroundColor: theme.bg3,
    color: theme.accent,
    marginLeft: "auto",
  },

  // Character grid
  charGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 8,
    maxHeight: 360,
    overflowY: "auto" as const,
  },
  charCard: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    backgroundColor: theme.bg1,
    borderRadius: 8,
    cursor: "pointer",
  },
  charAvatar: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    objectFit: "cover" as const,
    flexShrink: 0,
  },
  charAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    backgroundColor: theme.bg3,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    fontWeight: 700,
    color: theme.textSecondary,
    flexShrink: 0,
  },
  charCardInfo: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
    flex: 1,
    minWidth: 0,
  },
  charCardName: {
    fontSize: 13,
    fontWeight: 700,
    color: theme.textPrimary,
  },
  charCardStats: {
    display: "flex",
    gap: 8,
    fontSize: 11,
    fontWeight: 600,
  },
  charCardMeta: {
    display: "flex",
    gap: 4,
  },
  charRoleTag: {
    fontSize: 10,
    padding: "1px 5px",
    borderRadius: 4,
    backgroundColor: `${theme.accent}20`,
    color: theme.accent,
    fontWeight: 600,
  },
  charCityTag: {
    fontSize: 10,
    padding: "1px 5px",
    borderRadius: 4,
    backgroundColor: theme.bg3,
    color: theme.textSecondary,
  },

  // Diplomacy section (other factions)
  diplomacySection: {
    marginTop: 0,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 12,
    marginTop: 12,
  },
  card: {
    backgroundColor: theme.bg2,
    borderRadius: 8,
    padding: 14,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  factionName: {
    fontSize: 16,
    fontWeight: 700,
  },
  factionId: {
    fontSize: 11,
    color: theme.textMuted,
    fontWeight: 600,
  },
  statRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    width: 36,
    flexShrink: 0,
  },
  barWrap: {
    flex: 1,
    height: 6,
    backgroundColor: theme.bg1,
    borderRadius: 3,
    overflow: "hidden",
  },
  bar: {
    height: "100%",
    borderRadius: 3,
    transition: "width 0.3s ease",
  },
  statValue: {
    fontSize: 13,
    fontWeight: 600,
    color: theme.textPrimary,
    width: 40,
    textAlign: "right" as const,
  },
  sparklineWrap: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    paddingTop: 6,
    borderTop: `1px solid ${theme.bg3}`,
  },
  diplomacyRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTop: `1px solid ${theme.bg3}`,
  },
  allyBtn: {
    padding: "4px 10px",
    borderRadius: 4,
    border: "none",
    backgroundColor: theme.success,
    color: theme.bg1,
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  },
  breakBtn: {
    padding: "4px 10px",
    borderRadius: 4,
    border: "none",
    backgroundColor: theme.danger,
    color: "#fff",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  },
  dipBtn: {
    padding: "4px 8px",
    borderRadius: 4,
    border: "none",
    color: "#fff",
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
  },
  techSection: {
    marginTop: 6,
    paddingTop: 6,
    borderTop: `1px solid ${theme.bg3}`,
  },
  techList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  techItem: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
  },
  techBar: {
    height: 4,
    backgroundColor: theme.bg1,
    borderRadius: 2,
    overflow: "hidden",
  },
  techFill: {
    height: "100%",
    backgroundColor: theme.accent,
    borderRadius: 2,
    transition: "width 0.3s",
  },
  researchBtn: {
    fontSize: 10,
    padding: "2px 6px",
    borderRadius: 4,
    border: "none",
    backgroundColor: theme.info,
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },

  // Alliance section
  allianceSection: {
    marginTop: 0,
  },
  allianceList: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 12,
    marginTop: 8,
  },
  allianceItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.bg2,
    padding: "8px 14px",
    borderRadius: 6,
    fontSize: 14,
  },
  allianceArrow: {
    color: theme.textMuted,
    fontSize: 16,
  },
};
