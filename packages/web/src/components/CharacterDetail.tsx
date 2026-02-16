"use client";

import { useState, useEffect } from "react";
import { trpc } from "../lib/trpc";

interface CharacterInfo {
  id: string;
  name: string;
  traits: string[];
  cityId?: string;
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

interface CharacterDetailProps {
  characterId: string;
  factionName?: string;
  factionColor?: string;
  cityName?: string;
  onClose: () => void;
  onCharacterClick?: (id: string) => void;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  friend: { label: "友好", color: "#4ade80" },
  rival: { label: "敵對", color: "#f87171" },
  neutral: { label: "中立", color: "#9ca3af" },
};

export function CharacterDetail({
  characterId,
  factionName,
  factionColor,
  cityName,
  onClose,
  onCharacterClick,
}: CharacterDetailProps) {
  const [character, setCharacter] = useState<CharacterInfo | null>(null);
  const [relationships, setRelationships] = useState<RelationshipInfo[]>([]);
  const [allChars, setAllChars] = useState<Map<string, CharacterInfo>>(new Map());
  const [recentEvents, setRecentEvents] = useState<PairEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      trpc.character.getById.query({ id: characterId }),
      trpc.character.getRelationships.query({ characterId }),
      trpc.character.getAll.query(),
      trpc.simulation.getEventLog.query({ characterId }),
    ]).then(([char, rels, chars, events]) => {
      setCharacter(char as CharacterInfo | null);
      setRelationships(rels as RelationshipInfo[]);
      setAllChars(new Map((chars as CharacterInfo[]).map((c) => [c.id, c])));
      setRecentEvents((events as PairEvent[]).slice(-10).reverse());
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
            <h2 style={styles.name}>{character.name}</h2>
            <div style={styles.meta}>
              {factionName && (
                <span style={{ ...styles.factionTag, backgroundColor: factionColor ?? "#64748b" }}>
                  {factionName}
                </span>
              )}
              {cityName && <span style={styles.cityTag}>{cityName}</span>}
            </div>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Traits */}
        <div style={styles.section}>
          <h3 style={styles.subtitle}>特質</h3>
          <div style={styles.traitList}>
            {character.traits.map((t) => (
              <span key={t} style={styles.trait}>{t}</span>
            ))}
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
  traitList: { display: "flex", gap: 6, flexWrap: "wrap" },
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
};
