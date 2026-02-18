"use client";

import { useState, useEffect } from "react";
import { trpc } from "../lib/trpc";

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

const ROLE_LABELS: Record<CharacterRole, { label: string; color: string }> = {
  general: { label: "將軍", color: "#ef4444" },
  governor: { label: "太守", color: "#22c55e" },
  diplomat: { label: "外交官", color: "#3b82f6" },
  spymaster: { label: "間諜頭子", color: "#a855f7" },
};

const SKILL_LABELS: Record<string, { label: string; color: string }> = {
  leadership: { label: "統率", color: "#f59e0b" },
  tactics: { label: "戰術", color: "#ef4444" },
  commerce: { label: "商才", color: "#22c55e" },
  espionage: { label: "諜報", color: "#6366f1" },
};

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

interface CharacterDetailProps {
  characterId: string;
  factionName?: string;
  factionColor?: string;
  cityName?: string;
  isPlayerFaction?: boolean;
  currentTick?: number;
  onClose: () => void;
  onCharacterClick?: (id: string) => void;
  onAssignRole?: (characterId: string, role: CharacterRole) => void;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  friend: { label: "友好", color: "#4ade80" },
  rival: { label: "敵對", color: "#f87171" },
  neutral: { label: "中立", color: "#9ca3af" },
};

const ACHIEVEMENT_LABELS: Record<string, string> = {
  veteran: "百戰老將",
  conqueror: "攻城略地",
  spymaster_ace: "暗影之手",
  diplomat_star: "縱橫家",
};

export function CharacterDetail({
  characterId,
  factionName,
  factionColor,
  cityName,
  isPlayerFaction,
  currentTick,
  onClose,
  onCharacterClick,
  onAssignRole,
}: CharacterDetailProps) {
  const [character, setCharacter] = useState<CharacterInfo | null>(null);
  const [relationships, setRelationships] = useState<RelationshipInfo[]>([]);
  const [allChars, setAllChars] = useState<Map<string, CharacterInfo>>(new Map());
  const [recentEvents, setRecentEvents] = useState<PairEvent[]>([]);
  const [prestige, setPrestige] = useState(0);
  const [achievements, setAchievements] = useState<string[]>([]);
  const [favorability, setFavorability] = useState(60);
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
    ]).then(([char, rels, chars, events, achievementData, favData]) => {
      setCharacter(char as CharacterInfo | null);
      setRelationships(rels as RelationshipInfo[]);
      setAllChars(new Map((chars as CharacterInfo[]).map((c) => [c.id, c])));
      setRecentEvents((events as PairEvent[]).slice(-10).reverse());
      const ad = achievementData as { prestige: number; achievements: string[] };
      setPrestige(ad.prestige);
      setAchievements(ad.achievements);
      setFavorability((favData as { favorability: number }).favorability);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [characterId]);

  if (loading) {
    return (
      <div style={styles.overlay} onClick={onClose}>
        <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
          <p style={styles.loading}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!character) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h2 style={styles.name}>
              {character.name}
              {character.bornTick != null && currentTick != null && (
                <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 400, marginLeft: 8 }}>
                  {Math.floor((currentTick - character.bornTick) / 16)}歲
                </span>
              )}
            </h2>
            <div style={styles.meta}>
              {factionName && (
                <span style={{ ...styles.factionTag, backgroundColor: factionColor ?? "#64748b" }}>
                  {factionName}
                </span>
              )}
              {cityName && <span style={styles.cityTag}>{cityName}</span>}
              {character.parentId && (
                <span style={{ ...styles.cityTag, backgroundColor: "#6366f1", color: "#fff", cursor: "pointer" }} onClick={() => onCharacterClick?.(character.parentId!)}>
                  之後
                </span>
              )}
              {character.role && (() => {
                const ri = ROLE_LABELS[character.role];
                return <span style={{ ...styles.roleTag, backgroundColor: ri.color }}>{ri.label}</span>;
              })()}
            </div>
            {isPlayerFaction && onAssignRole && (
              <div style={styles.roleSelect}>
                <select
                  style={styles.roleDropdown}
                  value={character.role ?? ""}
                  onChange={(e) => {
                    if (e.target.value) onAssignRole(characterId, e.target.value as CharacterRole);
                  }}
                >
                  <option value="">指派職務</option>
                  <option value="general">將軍（攻擊+20%）</option>
                  <option value="governor">太守（收入+20%）</option>
                  <option value="diplomat">外交官（結盟+15%）</option>
                  <option value="spymaster">間諜頭子（諜報+20%）</option>
                </select>
              </div>
            )}
          </div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Traits + Combat Rating */}
        <div style={styles.section}>
          <h3 style={styles.subtitle}>特質</h3>
          <div style={styles.traitList}>
            {character.traits.map((t) => (
              <span key={t} style={styles.trait}>{t}</span>
            ))}
          </div>
          <div style={styles.ratingGrid}>
            <div style={styles.ratingItem}>
              <span style={{ ...styles.ratingLabel, color: "#ef4444" }}>武</span>
              <span style={styles.ratingValue}>{character.military}</span>
            </div>
            <div style={styles.ratingItem}>
              <span style={{ ...styles.ratingLabel, color: "#3b82f6" }}>智</span>
              <span style={styles.ratingValue}>{character.intelligence}</span>
            </div>
            <div style={styles.ratingItem}>
              <span style={{ ...styles.ratingLabel, color: "#f59e0b" }}>魅</span>
              <span style={styles.ratingValue}>{character.charm}</span>
            </div>
          </div>
          {/* Skills */}
          {character.skills && (
            <div style={styles.skillGrid}>
              {(Object.entries(character.skills) as [string, number][]).map(([key, val]) => {
                const info = SKILL_LABELS[key];
                if (!info || val === 0) return null;
                return (
                  <div key={key} style={styles.skillItem}>
                    <span style={{ ...styles.skillLabel, color: info.color }}>{info.label}</span>
                    <div style={styles.skillBar}>
                      <div style={{ ...styles.skillFill, width: `${(val / 5) * 100}%`, backgroundColor: info.color }} />
                    </div>
                    <span style={styles.skillValue}>{val}</span>
                  </div>
                );
              })}
            </div>
          )}
          {/* Prestige & Achievements */}
          {prestige > 0 && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #334155" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: "#a855f7", fontWeight: 700 }}>威望</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>{prestige}</span>
              </div>
              {achievements.length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                  {achievements.map((a) => (
                    <span key={a} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 8, backgroundColor: "#a855f7", color: "#fff", fontWeight: 600 }}>
                      {ACHIEVEMENT_LABELS[a] ?? a}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* Favorability */}
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #334155", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: favorability >= 60 ? "#22c55e" : favorability >= 30 ? "#f59e0b" : "#ef4444", fontWeight: 700 }}>支持度</span>
            <div style={{ flex: 1, height: 6, backgroundColor: "#0f172a", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${favorability}%`, backgroundColor: favorability >= 60 ? "#22c55e" : favorability >= 30 ? "#f59e0b" : "#ef4444", borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{favorability}</span>
          </div>
        </div>

        {/* Relationships */}
        <div style={styles.section}>
          <h3 style={styles.subtitle}>關係 ({relationships.length})</h3>
          <div style={styles.relList}>
            {relationships.map((rel) => {
              const otherId = rel.sourceId === characterId ? rel.targetId : rel.sourceId;
              const other = allChars.get(otherId);
              const typeInfo = TYPE_LABELS[rel.relationshipType] ?? TYPE_LABELS.neutral;
              return (
                <div
                  key={otherId}
                  style={styles.relItem}
                  onClick={() => onCharacterClick?.(otherId)}
                >
                  <span style={styles.relName}>{other?.name ?? otherId}</span>
                  <span style={{ ...styles.relType, color: typeInfo.color }}>{typeInfo.label}</span>
                  <span style={styles.relIntimacy}>{rel.intimacy}</span>
                  <div style={styles.relBar}>
                    <div style={{ ...styles.relFill, width: `${rel.intimacy}%`, backgroundColor: typeInfo.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent events */}
        <div style={styles.section}>
          <h3 style={styles.subtitle}>近期事件</h3>
          {recentEvents.length === 0 ? (
            <p style={styles.empty}>尚無事件紀錄</p>
          ) : (
            <div style={styles.eventList}>
              {recentEvents.map((evt) => {
                const other = allChars.get(
                  evt.actorId === characterId ? evt.targetId : evt.actorId,
                );
                return (
                  <div key={evt.id} style={styles.eventItem}>
                    <span style={styles.eventDay}>Day {evt.tick}</span>
                    <span style={styles.eventDelta}>
                      {evt.intimacyChange > 0 ? "+" : ""}{evt.intimacyChange}
                    </span>
                    <span style={styles.eventOther}>
                      {other?.name ?? "?"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  panel: {
    width: 420,
    maxHeight: "80vh",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 24,
    overflowY: "auto",
    color: "#e2e8f0",
  },
  loading: { textAlign: "center", color: "#64748b" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  name: { fontSize: 22, fontWeight: "bold", margin: 0 },
  meta: { display: "flex", gap: 8, marginTop: 6 },
  factionTag: {
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 10,
    color: "#0f172a",
    fontWeight: 700,
  },
  cityTag: {
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 10,
    backgroundColor: "#334155",
    color: "#94a3b8",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#64748b",
    fontSize: 18,
    cursor: "pointer",
    padding: 4,
  },
  section: {
    marginBottom: 16,
    paddingTop: 12,
    borderTop: "1px solid #334155",
  },
  subtitle: { fontSize: 14, fontWeight: 600, marginTop: 0, marginBottom: 8 },
  traitList: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 },
  ratingGrid: { display: "flex", gap: 12, marginTop: 4 },
  ratingItem: { display: "flex", alignItems: "center", gap: 4 },
  ratingLabel: { fontSize: 13, fontWeight: 700 },
  ratingValue: { fontSize: 14, fontWeight: 600, color: "#e2e8f0" },
  skillGrid: { display: "flex", flexDirection: "column", gap: 4, marginTop: 10, paddingTop: 8, borderTop: "1px solid #334155" },
  skillItem: { display: "flex", alignItems: "center", gap: 6 },
  skillLabel: { fontSize: 11, fontWeight: 700, width: 28 },
  skillBar: { flex: 1, height: 6, backgroundColor: "#0f172a", borderRadius: 3, overflow: "hidden" },
  skillFill: { height: "100%", borderRadius: 3, transition: "width 0.3s" },
  skillValue: { fontSize: 11, color: "#94a3b8", width: 16, textAlign: "right" },
  trait: {
    fontSize: 12,
    padding: "3px 10px",
    borderRadius: 12,
    backgroundColor: "#334155",
    color: "#cbd5e1",
  },
  relList: { display: "flex", flexDirection: "column", gap: 6 },
  relItem: {
    display: "grid",
    gridTemplateColumns: "1fr auto auto 80px",
    alignItems: "center",
    gap: 8,
    padding: "4px 8px",
    borderRadius: 4,
    backgroundColor: "#0f172a",
    cursor: "pointer",
    fontSize: 13,
  },
  relName: { fontWeight: 600 },
  relType: { fontSize: 11, fontWeight: 700 },
  relIntimacy: { fontSize: 12, color: "#94a3b8", textAlign: "right" },
  relBar: { height: 4, backgroundColor: "#334155", borderRadius: 2, overflow: "hidden" },
  relFill: { height: "100%", borderRadius: 2, transition: "width 0.3s" },
  empty: { fontSize: 13, color: "#64748b", fontStyle: "italic" },
  eventList: { display: "flex", flexDirection: "column", gap: 4 },
  eventItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    padding: "3px 8px",
    backgroundColor: "#0f172a",
    borderRadius: 4,
  },
  eventDay: { color: "#f59e0b", fontWeight: 600, minWidth: 48 },
  eventDelta: { fontWeight: 700, minWidth: 30 },
  eventOther: { color: "#94a3b8" },
  roleTag: {
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 10,
    color: "#fff",
    fontWeight: 700,
  },
  roleSelect: { marginTop: 4 },
  roleDropdown: {
    fontSize: 12,
    padding: "3px 8px",
    borderRadius: 4,
    border: "1px solid #334155",
    backgroundColor: "#0f172a",
    color: "#e2e8f0",
    cursor: "pointer",
  },
};
