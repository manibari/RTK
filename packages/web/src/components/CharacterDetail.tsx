"use client";

import { useState, useEffect } from "react";
import { trpc } from "../lib/trpc";
import { theme } from "../lib/theme";

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

interface MentorPair {
  mentorId: string;
  apprenticeId: string;
  factionId: string;
  startTick: number;
}

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
  onViewFullProfile?: (id: string) => void;
  onAssignRole?: (characterId: string, role: CharacterRole) => void;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  friend: { label: "友好", color: "#7db88a" },
  rival: { label: "敵對", color: "#c47171" },
  neutral: { label: "中立", color: "#9c9c9c" },
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
  onViewFullProfile,
  onAssignRole,
}: CharacterDetailProps) {
  const [character, setCharacter] = useState<CharacterInfo | null>(null);
  const [relationships, setRelationships] = useState<RelationshipInfo[]>([]);
  const [allChars, setAllChars] = useState<Map<string, CharacterInfo>>(new Map());
  const [recentEvents, setRecentEvents] = useState<PairEvent[]>([]);
  const [prestige, setPrestige] = useState(0);
  const [achievements, setAchievements] = useState<string[]>([]);
  const [favorability, setFavorability] = useState(60);
  const [mentorPairs, setMentorPairs] = useState<MentorPair[]>([]);
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
    ]).then(([char, rels, chars, events, achievementData, favData, mentors]) => {
      setCharacter(char as CharacterInfo | null);
      setRelationships(rels as RelationshipInfo[]);
      setAllChars(new Map((chars as CharacterInfo[]).map((c) => [c.id, c])));
      setRecentEvents((events as PairEvent[]).slice(-10).reverse());
      const ad = achievementData as { prestige: number; achievements: string[] };
      setPrestige(ad.prestige);
      setAchievements(ad.achievements);
      setFavorability((favData as { favorability: number }).favorability);
      setMentorPairs(mentors as MentorPair[]);
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
          {character.avatarUrl && (
            <img
              src={character.avatarUrl}
              alt={character.name}
              style={styles.avatar}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <div>
            <h2 style={styles.name}>
              {character.name}
              {character.bornTick != null && currentTick != null && (
                <span style={{ fontSize: 13, color: theme.textSecondary, fontWeight: 400, marginLeft: 8 }}>
                  {Math.floor((currentTick - character.bornTick) / 16)}歲
                </span>
              )}
            </h2>
            <div style={styles.meta}>
              {factionName && (
                <span style={{ ...styles.factionTag, backgroundColor: factionColor ?? theme.textMuted }}>
                  {factionName}
                </span>
              )}
              {cityName && <span style={styles.cityTag}>{cityName}</span>}
              {character.parentId && (
                <span style={{ ...styles.cityTag, backgroundColor: theme.indigo, color: "#fff", cursor: "pointer" }} onClick={() => onCharacterClick?.(character.parentId!)}>
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
            {isPlayerFaction && characterId !== "liu_bei" && (
              <button
                style={{ marginTop: 4, padding: "2px 8px", fontSize: 11, backgroundColor: theme.special, color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
                onClick={async () => {
                  try {
                    await trpc.simulation.queueCommand.mutate({ type: "designate_heir", characterId: "liu_bei", targetCityId: "", targetCharacterId: characterId });
                  } catch { /* ignore */ }
                }}
              >
                指定繼承人
              </button>
            )}
          </div>
          {onViewFullProfile && (
            <button
              style={{
                padding: "4px 12px",
                fontSize: 11,
                backgroundColor: theme.accent,
                color: theme.bg1,
                border: "none",
                borderRadius: 6,
                fontWeight: 700,
                cursor: "pointer",
                marginLeft: "auto",
              }}
              onClick={() => { onViewFullProfile(characterId); onClose(); }}
            >
              查看完整資料
            </button>
          )}
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
          {character.biography && (
            <p style={styles.biography}>{character.biography}</p>
          )}
          <div style={styles.ratingGrid}>
            <div style={styles.ratingItem}>
              <span style={{ ...styles.ratingLabel, color: theme.danger }}>武</span>
              <span style={styles.ratingValue}>{character.military}</span>
            </div>
            <div style={styles.ratingItem}>
              <span style={{ ...styles.ratingLabel, color: theme.info }}>智</span>
              <span style={styles.ratingValue}>{character.intelligence}</span>
            </div>
            <div style={styles.ratingItem}>
              <span style={{ ...styles.ratingLabel, color: theme.accent }}>魅</span>
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
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${theme.bg3}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: theme.special, fontWeight: 700 }}>威望</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: theme.textPrimary }}>{prestige}</span>
              </div>
              {achievements.length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                  {achievements.map((a) => (
                    <span key={a} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 8, backgroundColor: theme.special, color: "#fff", fontWeight: 600 }}>
                      {ACHIEVEMENT_LABELS[a] ?? a}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* Favorability */}
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${theme.bg3}`, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: favorability >= 60 ? theme.success : favorability >= 30 ? theme.accent : theme.danger, fontWeight: 700 }}>支持度</span>
            <div style={{ flex: 1, height: 6, backgroundColor: theme.bg1, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${favorability}%`, backgroundColor: favorability >= 60 ? theme.success : favorability >= 30 ? theme.accent : theme.danger, borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 12, color: theme.textSecondary }}>{favorability}</span>
          </div>
        </div>

        {/* Mentor/Apprentice */}
        {(() => {
          const asMentor = mentorPairs.find((p) => p.mentorId === characterId);
          const asApprentice = mentorPairs.find((p) => p.apprenticeId === characterId);
          const hasMentorRole = asMentor || asApprentice;
          // Eligible apprentice targets: same-faction chars in same city, not already in a pair
          const pairedIds = new Set(mentorPairs.flatMap((p) => [p.mentorId, p.apprenticeId]));
          const eligibleApprentices = isPlayerFaction && !pairedIds.has(characterId)
            ? [...allChars.values()].filter((c) =>
                c.id !== characterId &&
                c.cityId === character.cityId &&
                !pairedIds.has(c.id),
              )
            : [];

          return (hasMentorRole || (isPlayerFaction && eligibleApprentices.length > 0)) ? (
            <div style={styles.section}>
              <h3 style={styles.subtitle}>師徒</h3>
              {asMentor && (
                <div style={{ fontSize: 13, color: theme.accent, marginBottom: 4 }}>
                  師父 → 學徒：
                  <span
                    style={{ color: theme.textPrimary, cursor: "pointer", fontWeight: 600, marginLeft: 4 }}
                    onClick={() => onCharacterClick?.(asMentor.apprenticeId)}
                  >
                    {allChars.get(asMentor.apprenticeId)?.name ?? asMentor.apprenticeId}
                  </span>
                </div>
              )}
              {asApprentice && (
                <div style={{ fontSize: 13, color: theme.info, marginBottom: 4 }}>
                  學徒 ← 師父：
                  <span
                    style={{ color: theme.textPrimary, cursor: "pointer", fontWeight: 600, marginLeft: 4 }}
                    onClick={() => onCharacterClick?.(asApprentice.mentorId)}
                  >
                    {allChars.get(asApprentice.mentorId)?.name ?? asApprentice.mentorId}
                  </span>
                </div>
              )}
              {isPlayerFaction && !pairedIds.has(characterId) && eligibleApprentices.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <select
                    style={styles.roleDropdown}
                    defaultValue=""
                    onChange={async (e) => {
                      if (!e.target.value) return;
                      try {
                        await trpc.simulation.queueCommand.mutate({
                          type: "assign_mentor",
                          characterId: characterId,
                          targetCityId: character.cityId ?? "",
                          targetCharacterId: e.target.value,
                        });
                      } catch { /* ignore */ }
                    }}
                  >
                    <option value="">指派學徒...</option>
                    {eligibleApprentices.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ) : null;
        })()}

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
    backgroundColor: theme.bg2,
    borderRadius: 12,
    padding: 24,
    overflowY: "auto",
    color: theme.textPrimary,
  },
  loading: { textAlign: "center", color: theme.textMuted },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 12,
    objectFit: "cover" as const,
    marginRight: 12,
    flexShrink: 0,
  },
  biography: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 1.5,
    marginTop: 8,
    marginBottom: 8,
    fontStyle: "italic",
  },
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
    color: theme.bg1,
    fontWeight: 700,
  },
  cityTag: {
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 10,
    backgroundColor: theme.bg3,
    color: theme.textSecondary,
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: theme.textMuted,
    fontSize: 18,
    cursor: "pointer",
    padding: 4,
  },
  section: {
    marginBottom: 16,
    paddingTop: 12,
    borderTop: `1px solid ${theme.bg3}`,
  },
  subtitle: { fontSize: 14, fontWeight: 600, marginTop: 0, marginBottom: 8 },
  traitList: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 },
  ratingGrid: { display: "flex", gap: 12, marginTop: 4 },
  ratingItem: { display: "flex", alignItems: "center", gap: 4 },
  ratingLabel: { fontSize: 13, fontWeight: 700 },
  ratingValue: { fontSize: 14, fontWeight: 600, color: theme.textPrimary },
  skillGrid: { display: "flex", flexDirection: "column", gap: 4, marginTop: 10, paddingTop: 8, borderTop: `1px solid ${theme.bg3}` },
  skillItem: { display: "flex", alignItems: "center", gap: 6 },
  skillLabel: { fontSize: 11, fontWeight: 700, width: 28 },
  skillBar: { flex: 1, height: 6, backgroundColor: theme.bg1, borderRadius: 3, overflow: "hidden" },
  skillFill: { height: "100%", borderRadius: 3, transition: "width 0.3s" },
  skillValue: { fontSize: 11, color: theme.textSecondary, width: 16, textAlign: "right" },
  trait: {
    fontSize: 12,
    padding: "3px 10px",
    borderRadius: 12,
    backgroundColor: theme.bg3,
    color: theme.textBody,
  },
  relList: { display: "flex", flexDirection: "column", gap: 6 },
  relItem: {
    display: "grid",
    gridTemplateColumns: "1fr auto auto 80px",
    alignItems: "center",
    gap: 8,
    padding: "4px 8px",
    borderRadius: 4,
    backgroundColor: theme.bg1,
    cursor: "pointer",
    fontSize: 13,
  },
  relName: { fontWeight: 600 },
  relType: { fontSize: 11, fontWeight: 700 },
  relIntimacy: { fontSize: 12, color: theme.textSecondary, textAlign: "right" },
  relBar: { height: 4, backgroundColor: theme.bg3, borderRadius: 2, overflow: "hidden" },
  relFill: { height: "100%", borderRadius: 2, transition: "width 0.3s" },
  empty: { fontSize: 13, color: theme.textMuted, fontStyle: "italic" },
  eventList: { display: "flex", flexDirection: "column", gap: 4 },
  eventItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    padding: "3px 8px",
    backgroundColor: theme.bg1,
    borderRadius: 4,
  },
  eventDay: { color: theme.accent, fontWeight: 600, minWidth: 48 },
  eventDelta: { fontWeight: 700, minWidth: 30 },
  eventOther: { color: theme.textSecondary },
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
    border: `1px solid ${theme.bg3}`,
    backgroundColor: theme.bg1,
    color: theme.textPrimary,
    cursor: "pointer",
  },
};
