"use client";

import { useState, useEffect, useMemo } from "react";
import { trpc } from "../lib/trpc";
import { theme } from "../lib/theme";

// --- Types ---

interface CharacterSkills {
  leadership: number;
  tactics: number;
  commerce: number;
  espionage: number;
}

type CharacterRole = "general" | "governor" | "diplomat" | "spymaster";

interface CharacterInfo {
  id: string;
  name: string;
  biography?: string;
  avatarUrl?: string;
  traits: string[];
  cityId?: string;
  military: number;
  intelligence: number;
  charm: number;
  skills?: CharacterSkills;
  role?: CharacterRole;
  bornTick?: number;
  parentId?: string;
}

interface RelationshipInfo {
  sourceId: string;
  targetId: string;
  intimacy: number;
  relationshipType: string;
}

interface PairEvent {
  id: number;
  tick: number;
  actorId: string;
  targetId: string;
  eventCode: string;
  intimacyChange: number;
  narrative: string;
}

interface MentorPair {
  mentorId: string;
  apprenticeId: string;
  factionId: string;
  startTick: number;
}

interface CharacterPageProps {
  characterId: string;
  onBack: () => void;
  onViewCharacter: (id: string) => void;
  currentTick: number;
}

// --- Constants ---

const ROLE_LABELS: Record<CharacterRole, { label: string; color: string }> = {
  general: { label: "將軍", color: theme.danger },
  governor: { label: "太守", color: theme.success },
  diplomat: { label: "外交官", color: theme.info },
  spymaster: { label: "間諜頭子", color: theme.special },
};

const SKILL_LABELS: Record<string, { label: string; color: string }> = {
  leadership: { label: "統率", color: theme.accent },
  tactics: { label: "戰術", color: theme.danger },
  commerce: { label: "商才", color: theme.success },
  espionage: { label: "諜報", color: theme.indigo },
};

const RADAR_AXES = [
  { key: "military", label: "武力", angle: -90 },
  { key: "intelligence", label: "智力", angle: -18 },
  { key: "tactics", label: "戰術", angle: 54 },
  { key: "leadership", label: "統率", angle: 126 },
  { key: "charm", label: "魅力", angle: 198 },
] as const;

const ACHIEVEMENT_LABELS: Record<string, string> = {
  veteran: "百戰老將",
  conqueror: "攻城略地",
  spymaster_ace: "暗影之手",
  diplomat_star: "縱橫家",
  warrior: "百戰名將",
};

const REL_TYPE_COLORS: Record<string, { label: string; color: string }> = {
  friend: { label: "友好", color: "#7db88a" },
  rival: { label: "敵對", color: "#c47171" },
  neutral: { label: "中立", color: "#9c9c9c" },
};

// --- Faction portrait gradients ---
const FACTION_GRADIENTS: Record<string, string> = {
  shu: `linear-gradient(135deg, ${theme.factionShu}40, ${theme.factionShu}10)`,
  wei: `linear-gradient(135deg, ${theme.factionWei}40, ${theme.factionWei}10)`,
  wu: `linear-gradient(135deg, ${theme.factionWu}40, ${theme.factionWu}10)`,
  lu_bu: `linear-gradient(135deg, ${theme.factionLuBu}40, ${theme.factionLuBu}10)`,
};

const FACTION_NAMES: Record<string, string> = {
  shu: "蜀", wei: "魏", wu: "吳", lu_bu: "呂布",
};

// --- Component ---

export function CharacterPage({ characterId, onBack, onViewCharacter, currentTick }: CharacterPageProps) {
  const [character, setCharacter] = useState<CharacterInfo | null>(null);
  const [relationships, setRelationships] = useState<RelationshipInfo[]>([]);
  const [allChars, setAllChars] = useState<Map<string, CharacterInfo>>(new Map());
  const [recentEvents, setRecentEvents] = useState<PairEvent[]>([]);
  const [prestige, setPrestige] = useState(0);
  const [achievements, setAchievements] = useState<string[]>([]);
  const [favorability, setFavorability] = useState(60);
  const [mentorPairs, setMentorPairs] = useState<MentorPair[]>([]);
  const [factionId, setFactionId] = useState<string | null>(null);
  const [cityName, setCityName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      trpc.character.getById.query({ id: characterId }),
      trpc.character.getRelationships.query({ characterId }),
      trpc.character.getAll.query(),
      trpc.simulation.getEventLog.query({ characterId }),
      trpc.simulation.getCharacterAchievements.query({ characterId }),
      trpc.simulation.getCharacterFavorability.query({ characterId }),
      trpc.simulation.getMentorPairs.query(),
      trpc.simulation.getFactions.query(),
      trpc.map.getMapData.query({ tick: currentTick }),
    ]).then(([char, rels, chars, events, achievementData, favData, mentors, factions, mapData]) => {
      const c = char as CharacterInfo | null;
      setCharacter(c);
      setRelationships(rels as RelationshipInfo[]);
      const charMap = new Map((chars as CharacterInfo[]).map((ch) => [ch.id, ch]));
      setAllChars(charMap);
      setRecentEvents((events as PairEvent[]).slice(-20).reverse());
      const ad = achievementData as { prestige: number; achievements: string[] };
      setPrestige(ad.prestige);
      setAchievements(ad.achievements);
      setFavorability((favData as { favorability: number }).favorability);
      setMentorPairs(mentors as MentorPair[]);

      // Find faction
      const facs = factions as { id: string; members: string[] }[];
      const myFaction = facs.find((f) => f.members.includes(characterId));
      setFactionId(myFaction?.id ?? null);

      // Find city name
      const md = mapData as { cities: { id: string; name: string }[] };
      if (c?.cityId) {
        const city = md.cities.find((ct) => ct.id === c.cityId);
        setCityName(city?.name ?? null);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [characterId, currentTick]);

  // Radar chart values
  const radarValues = useMemo(() => {
    if (!character) return [];
    return RADAR_AXES.map((axis) => {
      let val = 0;
      if (axis.key === "military") val = character.military;
      else if (axis.key === "intelligence") val = character.intelligence;
      else if (axis.key === "charm") val = character.charm;
      else if (axis.key === "tactics") val = character.skills?.tactics ?? 0;
      else if (axis.key === "leadership") val = character.skills?.leadership ?? 0;
      return { ...axis, value: val * 20 }; // scale to 0-100
    });
  }, [character]);

  // Top 8 relationships for mini-network
  const topRelations = useMemo(() => {
    return [...relationships]
      .sort((a, b) => Math.abs(b.intimacy - 50) - Math.abs(a.intimacy - 50))
      .slice(0, 8);
  }, [relationships]);

  const age = character?.bornTick != null ? Math.floor((currentTick - character.bornTick) / 16) : null;

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingBox}>載入中...</div>
      </div>
    );
  }

  if (!character) return null;

  const factionColor = factionId
    ? ({ shu: theme.factionShu, wei: theme.factionWei, wu: theme.factionWu, lu_bu: theme.factionLuBu }[factionId] ?? theme.textMuted)
    : theme.textMuted;
  const factionGradient = factionId ? FACTION_GRADIENTS[factionId] ?? FACTION_GRADIENTS.shu : FACTION_GRADIENTS.shu;

  return (
    <div style={styles.container}>
      {/* Back button */}
      <button style={styles.backBtn} onClick={onBack}>← 返回</button>

      <div style={styles.scrollArea}>
        {/* === Portrait Section === */}
        <div style={{ ...styles.portraitSection, background: factionGradient }}>
          <div style={{ ...styles.portraitCircle, borderColor: factionColor }}>
            <span style={{ ...styles.portraitKanji, color: factionColor }}>
              {character.name.charAt(0)}
            </span>
          </div>
          <div style={styles.namePlate}>
            <h1 style={styles.heroName}>{character.name}</h1>
            <div style={styles.metaRow}>
              {age != null && <span style={styles.ageTag}>{age}歲</span>}
              {factionId && (
                <span style={{ ...styles.factionTag, backgroundColor: `${factionColor}30`, color: factionColor }}>
                  {FACTION_NAMES[factionId] ?? factionId}
                </span>
              )}
              {cityName && <span style={styles.cityTag}>{cityName}</span>}
              {character.role && (() => {
                const ri = ROLE_LABELS[character.role];
                return <span style={{ ...styles.roleTag, backgroundColor: ri.color }}>{ri.label}</span>;
              })()}
            </div>
            <div style={styles.traitRow}>
              {character.traits.map((t) => (
                <span key={t} style={styles.trait}>{t}</span>
              ))}
            </div>
          </div>
        </div>

        <div style={styles.contentGrid}>
          {/* === Left column === */}
          <div style={styles.leftCol}>
            {/* Radar Chart */}
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>能力值</h2>
              <RadarChart values={radarValues} color={factionColor} />
              <div style={styles.statNumbers}>
                <StatNum label="武" value={character.military} color={theme.danger} />
                <StatNum label="智" value={character.intelligence} color={theme.info} />
                <StatNum label="魅" value={character.charm} color={theme.accent} />
              </div>
            </div>

            {/* Skill Bars */}
            {character.skills && (
              <div style={styles.card}>
                <h2 style={styles.cardTitle}>技能</h2>
                {(Object.entries(character.skills) as [string, number][]).map(([key, val]) => {
                  const info = SKILL_LABELS[key];
                  if (!info) return null;
                  return (
                    <div key={key} style={styles.skillRow}>
                      <span style={{ ...styles.skillLabel, color: info.color }}>{info.label}</span>
                      <div style={styles.skillTrack}>
                        <div style={{ ...styles.skillFill, width: `${(val / 5) * 100}%`, backgroundColor: info.color }} />
                      </div>
                      <span style={styles.skillVal}>{val}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Achievements */}
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>聲望與成就</h2>
              <div style={styles.prestigeRow}>
                <span style={{ color: theme.special, fontWeight: 700 }}>威望</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: theme.textPrimary }}>{prestige}</span>
              </div>
              <div style={styles.favorRow}>
                <span style={{ color: favorability >= 60 ? theme.success : favorability >= 30 ? theme.accent : theme.danger, fontWeight: 700, fontSize: 13 }}>
                  支持度
                </span>
                <div style={styles.favorTrack}>
                  <div style={{
                    height: "100%",
                    width: `${favorability}%`,
                    backgroundColor: favorability >= 60 ? theme.success : favorability >= 30 ? theme.accent : theme.danger,
                    borderRadius: 3,
                  }} />
                </div>
                <span style={{ fontSize: 12, color: theme.textSecondary }}>{favorability}</span>
              </div>
              {achievements.length > 0 && (
                <div style={styles.badgeRow}>
                  {achievements.map((a) => (
                    <span key={a} style={styles.achieveBadge}>
                      {ACHIEVEMENT_LABELS[a] ?? a}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* === Right column === */}
          <div style={styles.rightCol}>
            {/* Biography */}
            {character.biography && (
              <div style={{ ...styles.card, ...styles.bioCard }}>
                <h2 style={styles.cardTitle}>傳記</h2>
                <p style={styles.bioText}>{character.biography}</p>
              </div>
            )}

            {/* Relationship Mini-Network */}
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>人際關係 ({relationships.length})</h2>
              {topRelations.length > 0 ? (
                <RelationshipNetwork
                  centerName={character.name}
                  relations={topRelations}
                  characterId={characterId}
                  allChars={allChars}
                  onCharClick={onViewCharacter}
                />
              ) : (
                <p style={styles.emptyText}>尚無人際關係</p>
              )}
              {/* Full list below network */}
              <div style={styles.relList}>
                {relationships.map((rel) => {
                  const otherId = rel.sourceId === characterId ? rel.targetId : rel.sourceId;
                  const other = allChars.get(otherId);
                  const typeInfo = REL_TYPE_COLORS[rel.relationshipType] ?? REL_TYPE_COLORS.neutral;
                  return (
                    <div
                      key={otherId}
                      style={styles.relItem}
                      onClick={() => onViewCharacter(otherId)}
                    >
                      <span style={styles.relName}>{other?.name ?? otherId}</span>
                      <span style={{ ...styles.relType, color: typeInfo.color }}>{typeInfo.label}</span>
                      <span style={styles.relIntimacy}>{rel.intimacy}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Deeds Timeline */}
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>事蹟</h2>
              {recentEvents.length === 0 ? (
                <p style={styles.emptyText}>尚無事件紀錄</p>
              ) : (
                <div style={styles.deedList}>
                  {recentEvents.map((evt) => {
                    const isPositive = evt.intimacyChange > 0;
                    return (
                      <div key={evt.id} style={styles.deedItem}>
                        <div style={styles.deedDot} />
                        <div style={styles.deedContent}>
                          <div style={styles.deedHeader}>
                            <span style={styles.deedDay}>Day {evt.tick}</span>
                            <span style={{ ...styles.deedDelta, color: isPositive ? "#7db88a" : "#c47171" }}>
                              {isPositive ? "+" : ""}{evt.intimacyChange}
                            </span>
                          </div>
                          <p style={styles.deedNarrative}>{evt.narrative}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Bar (player faction only) */}
        {factionId === "shu" && (
          <div style={styles.actionBar}>
            <h2 style={styles.cardTitle}>指令</h2>
            <div style={styles.actionBtns}>
              {character.role ? (
                <span style={{ fontSize: 13, color: theme.textSecondary }}>
                  目前職務：{ROLE_LABELS[character.role]?.label}
                </span>
              ) : null}
              <select
                style={styles.actionSelect}
                defaultValue=""
                onChange={async (e) => {
                  if (!e.target.value) return;
                  try {
                    await trpc.simulation.queueCommand.mutate({
                      type: "assign_role",
                      characterId,
                      targetCityId: character.cityId ?? "",
                      role: e.target.value as CharacterRole,
                    });
                  } catch { /* ignore */ }
                  e.target.value = "";
                }}
              >
                <option value="">指派職務...</option>
                <option value="general">將軍（攻擊+20%）</option>
                <option value="governor">太守（收入+20%）</option>
                <option value="diplomat">外交官（結盟+15%）</option>
                <option value="spymaster">間諜頭子（諜報+20%）</option>
              </select>
              {characterId !== "liu_bei" && (
                <button
                  style={styles.heirBtn}
                  onClick={async () => {
                    try {
                      await trpc.simulation.queueCommand.mutate({
                        type: "designate_heir",
                        characterId: "liu_bei",
                        targetCityId: "",
                        targetCharacterId: characterId,
                      });
                    } catch { /* ignore */ }
                  }}
                >
                  指定繼承人
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Radar Chart (pure SVG) ---

function RadarChart({ values, color }: { values: { label: string; value: number; angle: number }[]; color: string }) {
  const cx = 120, cy = 120, r = 90;

  const toXY = (angle: number, dist: number) => {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + dist * Math.cos(rad), y: cy + dist * Math.sin(rad) };
  };

  // Grid levels
  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  // Data polygon
  const dataPoints = values.map((v) => {
    const scale = Math.min(v.value, 100) / 100;
    return toXY(v.angle, r * scale);
  });
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + " Z";

  return (
    <svg width={240} height={240} style={{ display: "block", margin: "0 auto" }}>
      {/* Grid polygons */}
      {gridLevels.map((level) => {
        const pts = values.map((v) => toXY(v.angle, r * level));
        const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + " Z";
        return <path key={level} d={path} fill="none" stroke={theme.bg3} strokeWidth={1} />;
      })}

      {/* Axis lines */}
      {values.map((v) => {
        const end = toXY(v.angle, r);
        return <line key={v.label} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke={theme.bg3} strokeWidth={1} />;
      })}

      {/* Data fill */}
      <path d={dataPath} fill={`${color}40`} stroke={color} strokeWidth={2} />

      {/* Data points */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />
      ))}

      {/* Labels */}
      {values.map((v) => {
        const pos = toXY(v.angle, r + 18);
        return (
          <text
            key={v.label}
            x={pos.x}
            y={pos.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={theme.textSecondary}
            fontSize={11}
            fontWeight={600}
          >
            {v.label}
          </text>
        );
      })}
    </svg>
  );
}

// --- Stat Number ---

function StatNum({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <span style={{ fontSize: 13, fontWeight: 700, color }}>{label}</span>
      <div style={{ fontSize: 20, fontWeight: 700, color: theme.textPrimary }}>{value}</div>
    </div>
  );
}

// --- Relationship Mini-Network (SVG circle layout) ---

function RelationshipNetwork({
  centerName,
  relations,
  characterId,
  allChars,
  onCharClick,
}: {
  centerName: string;
  relations: RelationshipInfo[];
  characterId: string;
  allChars: Map<string, CharacterInfo>;
  onCharClick: (id: string) => void;
}) {
  const cx = 160, cy = 130, outerR = 100;

  const nodes = relations.map((rel, i) => {
    const otherId = rel.sourceId === characterId ? rel.targetId : rel.sourceId;
    const other = allChars.get(otherId);
    const angle = (i / relations.length) * 2 * Math.PI - Math.PI / 2;
    return {
      id: otherId,
      name: other?.name ?? otherId,
      x: cx + outerR * Math.cos(angle),
      y: cy + outerR * Math.sin(angle),
      rel,
    };
  });

  return (
    <svg width={320} height={260} style={{ display: "block", margin: "0 auto" }}>
      {/* Edges */}
      {nodes.map((n) => {
        const typeInfo = REL_TYPE_COLORS[n.rel.relationshipType] ?? REL_TYPE_COLORS.neutral;
        const width = Math.max(1, n.rel.intimacy / 25);
        return (
          <line
            key={n.id}
            x1={cx} y1={cy}
            x2={n.x} y2={n.y}
            stroke={typeInfo.color}
            strokeWidth={width}
            opacity={0.6}
          />
        );
      })}

      {/* Center node */}
      <circle cx={cx} cy={cy} r={22} fill={theme.accent} opacity={0.3} />
      <circle cx={cx} cy={cy} r={22} fill="none" stroke={theme.accent} strokeWidth={2} />
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fill={theme.textPrimary} fontSize={12} fontWeight={700}>
        {centerName.slice(0, 2)}
      </text>

      {/* Outer nodes */}
      {nodes.map((n) => {
        const typeInfo = REL_TYPE_COLORS[n.rel.relationshipType] ?? REL_TYPE_COLORS.neutral;
        return (
          <g key={n.id} style={{ cursor: "pointer" }} onClick={() => onCharClick(n.id)}>
            <circle cx={n.x} cy={n.y} r={16} fill={theme.bg2} stroke={typeInfo.color} strokeWidth={1.5} />
            <text x={n.x} y={n.y + 1} textAnchor="middle" dominantBaseline="middle" fill={theme.textPrimary} fontSize={10} fontWeight={600}>
              {n.name.slice(0, 2)}
            </text>
            <text x={n.x} y={n.y + 30} textAnchor="middle" fill={theme.textSecondary} fontSize={9}>
              {n.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// --- Styles ---

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    backgroundColor: theme.bg1,
    color: theme.textPrimary,
    height: "100%",
    overflow: "hidden",
  },
  loadingBox: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: theme.textMuted,
    fontSize: 16,
  },
  backBtn: {
    position: "absolute" as const,
    top: 8,
    left: 12,
    zIndex: 10,
    padding: "6px 14px",
    borderRadius: 6,
    border: `1px solid ${theme.bg3}`,
    backgroundColor: theme.bg2,
    color: theme.textPrimary,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  scrollArea: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "0 24px 24px",
  },

  // Portrait
  portraitSection: {
    display: "flex",
    alignItems: "center",
    gap: 24,
    padding: "40px 24px 24px",
    borderRadius: 12,
    marginBottom: 20,
    marginTop: 8,
  },
  portraitCircle: {
    width: 100,
    height: 100,
    borderRadius: "50%",
    border: "3px solid",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${theme.bg1}80`,
    flexShrink: 0,
  },
  portraitKanji: {
    fontSize: 48,
    fontWeight: 800,
    lineHeight: 1,
  },
  namePlate: {
    flex: 1,
  },
  heroName: {
    fontSize: 28,
    fontWeight: 800,
    margin: "0 0 6px",
    color: theme.textPrimary,
  },
  metaRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap" as const,
    marginBottom: 8,
  },
  ageTag: {
    fontSize: 12,
    color: theme.textSecondary,
    padding: "2px 8px",
    borderRadius: 8,
    backgroundColor: theme.bg3,
  },
  factionTag: {
    fontSize: 12,
    fontWeight: 700,
    padding: "2px 10px",
    borderRadius: 10,
  },
  cityTag: {
    fontSize: 12,
    padding: "2px 8px",
    borderRadius: 8,
    backgroundColor: theme.bg3,
    color: theme.textSecondary,
  },
  roleTag: {
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 10,
    color: "#fff",
    fontWeight: 700,
  },
  traitRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap" as const,
  },
  trait: {
    fontSize: 12,
    padding: "3px 10px",
    borderRadius: 12,
    backgroundColor: theme.bg3,
    color: theme.textBody,
  },

  // Content grid
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  leftCol: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
  },
  rightCol: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
  },

  // Cards
  card: {
    backgroundColor: theme.bg2,
    borderRadius: 10,
    padding: 16,
    border: `1px solid ${theme.bg3}`,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: theme.accent,
    margin: "0 0 12px",
  },

  // Stats
  statNumbers: {
    display: "flex",
    justifyContent: "center",
    gap: 32,
    marginTop: 8,
  },

  // Skills
  skillRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  skillLabel: {
    fontSize: 12,
    fontWeight: 700,
    width: 32,
  },
  skillTrack: {
    flex: 1,
    height: 6,
    backgroundColor: theme.bg1,
    borderRadius: 3,
    overflow: "hidden" as const,
  },
  skillFill: {
    height: "100%",
    borderRadius: 3,
    transition: "width 0.3s",
  },
  skillVal: {
    fontSize: 12,
    color: theme.textSecondary,
    width: 18,
    textAlign: "right" as const,
  },

  // Prestige
  prestigeRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  favorRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  favorTrack: {
    flex: 1,
    height: 6,
    backgroundColor: theme.bg1,
    borderRadius: 3,
    overflow: "hidden" as const,
  },
  badgeRow: {
    display: "flex",
    gap: 4,
    flexWrap: "wrap" as const,
  },
  achieveBadge: {
    fontSize: 11,
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 8,
    backgroundColor: theme.special,
    color: "#fff",
  },

  // Biography
  bioCard: {
    backgroundImage: `linear-gradient(135deg, ${theme.bg2}, ${theme.bg1}80)`,
    borderLeft: `3px solid ${theme.accent}`,
  },
  bioText: {
    fontSize: 14,
    color: theme.textBody,
    lineHeight: 1.7,
    margin: 0,
    fontStyle: "italic",
  },

  // Relationships
  emptyText: {
    fontSize: 13,
    color: theme.textMuted,
    fontStyle: "italic",
  },
  relList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
    marginTop: 12,
    maxHeight: 200,
    overflowY: "auto" as const,
  },
  relItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "4px 8px",
    borderRadius: 4,
    backgroundColor: theme.bg1,
    cursor: "pointer",
    fontSize: 13,
  },
  relName: {
    fontWeight: 600,
    flex: 1,
  },
  relType: {
    fontSize: 11,
    fontWeight: 700,
  },
  relIntimacy: {
    fontSize: 12,
    color: theme.textSecondary,
    width: 28,
    textAlign: "right" as const,
  },

  // Deeds timeline
  deedList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 0,
    position: "relative" as const,
    paddingLeft: 16,
    borderLeft: `2px solid ${theme.bg3}`,
    maxHeight: 320,
    overflowY: "auto" as const,
  },
  deedItem: {
    display: "flex",
    gap: 10,
    padding: "8px 0",
    position: "relative" as const,
  },
  deedDot: {
    position: "absolute" as const,
    left: -21,
    top: 14,
    width: 8,
    height: 8,
    borderRadius: "50%",
    backgroundColor: theme.accent,
  },
  deedContent: {
    flex: 1,
  },
  deedHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  deedDay: {
    fontSize: 11,
    color: theme.accent,
    fontWeight: 600,
  },
  deedDelta: {
    fontSize: 12,
    fontWeight: 700,
  },
  deedNarrative: {
    fontSize: 13,
    color: theme.textBody,
    margin: 0,
    lineHeight: 1.4,
  },

  // Action bar
  actionBar: {
    marginTop: 16,
    padding: 16,
    backgroundColor: theme.bg2,
    borderRadius: 10,
    border: `1px solid ${theme.bg3}`,
  },
  actionBtns: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap" as const,
  },
  actionSelect: {
    fontSize: 12,
    padding: "4px 10px",
    borderRadius: 6,
    border: `1px solid ${theme.bg3}`,
    backgroundColor: theme.bg1,
    color: theme.textPrimary,
    cursor: "pointer",
  },
  heirBtn: {
    padding: "4px 12px",
    fontSize: 12,
    backgroundColor: theme.special,
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontWeight: 700,
    cursor: "pointer",
  },
};
