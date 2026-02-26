"use client";

import type { PairEvent, TimelinePoint } from "./GraphPage";
import { TrendChart } from "./TrendChart";
import { theme } from "../lib/theme";

interface RelationshipDetail {
  sourceId: string;
  targetId: string;
  intimacy: number;
  relationshipType: string;
}

interface CharacterInfo {
  id: string;
  name: string;
  traits: string[];
}

interface SidebarProps {
  selectedEdge: RelationshipDetail | null;
  characters: Map<string, CharacterInfo>;
  pairEvents: PairEvent[];
  timeline: TimelinePoint[];
  viewTick: number;
  dailySummary: string;
  currentTick: number;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  friend: { label: "友好", color: "#7db88a" },
  rival: { label: "敵對", color: "#c47171" },
  neutral: { label: "中立", color: "#9c9c9c" },
};

export function Sidebar({ selectedEdge, characters, pairEvents, timeline, viewTick, dailySummary, currentTick }: SidebarProps) {
  // No edge selected — show daily summary
  if (!selectedEdge) {
    return (
      <aside style={styles.container}>
        {currentTick > 0 && dailySummary ? (
          <>
            <h2 style={styles.title}>今日總結</h2>
            <div style={styles.summaryBox}>
              <span style={styles.summaryDay}>Day {currentTick}</span>
              <p style={styles.summaryText}>{dailySummary}</p>
            </div>
            <p style={{ ...styles.hint, marginTop: 16 }}>點擊連線查看關係詳情</p>
          </>
        ) : (
          <p style={styles.hint}>點擊連線查看關係詳情</p>
        )}
      </aside>
    );
  }

  const source = characters.get(selectedEdge.sourceId);
  const target = characters.get(selectedEdge.targetId);
  const typeInfo = TYPE_LABELS[selectedEdge.relationshipType] ?? TYPE_LABELS.neutral;

  return (
    <aside style={styles.container}>
      <h2 style={styles.title}>關係詳情</h2>

      <div style={styles.pair}>
        <span style={styles.name}>{source?.name ?? selectedEdge.sourceId}</span>
        <span style={{ ...styles.badge, backgroundColor: typeInfo.color }}>
          {typeInfo.label}
        </span>
        <span style={styles.name}>{target?.name ?? selectedEdge.targetId}</span>
      </div>

      <div style={styles.meter}>
        <div style={styles.meterLabel}>
          <span>親密度</span>
          <span>{selectedEdge.intimacy}/100</span>
        </div>
        <div style={styles.meterTrack}>
          <div
            style={{
              ...styles.meterFill,
              width: `${selectedEdge.intimacy}%`,
              backgroundColor: typeInfo.color,
            }}
          />
        </div>
      </div>

      {/* Trend Chart */}
      <div style={styles.section}>
        <h3 style={styles.subtitle}>親密度趨勢</h3>
        <TrendChart data={timeline} viewTick={viewTick} />
      </div>

      {/* Event History with Narratives */}
      <div style={styles.eventSection}>
        <h3 style={styles.subtitle}>
          事件紀錄 ({pairEvents.length})
        </h3>
        {pairEvents.length === 0 ? (
          <p style={styles.noEvents}>尚無互動紀錄。點擊「推進一天」開始模擬。</p>
        ) : (
          <div style={styles.eventList}>
            {[...pairEvents].reverse().map((evt) => {
              const isPositive = evt.intimacyChange > 0;
              return (
                <div key={evt.id} style={styles.eventItem}>
                  <div style={styles.eventHeader}>
                    <span style={styles.eventDay}>Day {evt.tick}</span>
                    <span
                      style={{
                        ...styles.eventDelta,
                        color: isPositive ? "#7db88a" : "#c47171",
                      }}
                    >
                      {isPositive ? "+" : ""}{evt.intimacyChange}
                    </span>
                  </div>
                  <p style={styles.eventNarrative}>
                    {evt.narrative || `好感度 ${evt.oldIntimacy} → ${evt.newIntimacy}`}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: 320,
    padding: 24,
    backgroundColor: theme.bg2,
    borderLeft: `1px solid ${theme.bg3}`,
    color: theme.textPrimary,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
  },
  hint: {
    color: theme.textMuted,
    fontStyle: "italic",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    marginTop: 0,
  },
  summaryBox: {
    padding: "12px 14px",
    backgroundColor: theme.bg1,
    borderRadius: 8,
    borderLeft: `3px solid ${theme.accent}`,
  },
  summaryDay: {
    fontSize: 11,
    color: theme.accent,
    fontWeight: 600,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 1.6,
    margin: "8px 0 0",
    color: theme.textBody,
  },
  pair: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
    flexWrap: "wrap" as const,
  },
  name: {
    fontSize: 16,
    fontWeight: 600,
  },
  badge: {
    padding: "2px 10px",
    borderRadius: 12,
    fontSize: 12,
    color: theme.bg1,
    fontWeight: 700,
  },
  meter: {
    marginBottom: 16,
  },
  meterLabel: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 13,
    marginBottom: 4,
    color: theme.textSecondary,
  },
  meterTrack: {
    height: 8,
    backgroundColor: theme.bg3,
    borderRadius: 4,
    overflow: "hidden" as const,
  },
  meterFill: {
    height: "100%",
    borderRadius: 4,
    transition: "width 0.3s",
  },
  section: {
    marginBottom: 12,
    paddingTop: 12,
    borderTop: `1px solid ${theme.bg3}`,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 4,
    marginTop: 0,
  },
  eventSection: {
    marginTop: 4,
    paddingTop: 12,
    borderTop: `1px solid ${theme.bg3}`,
    flex: 1,
  },
  noEvents: {
    fontSize: 13,
    color: theme.textMuted,
    fontStyle: "italic",
  },
  eventList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  eventItem: {
    padding: "8px 10px",
    backgroundColor: theme.bg1,
    borderRadius: 6,
  },
  eventHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  eventDay: {
    fontSize: 11,
    color: theme.accent,
    fontWeight: 600,
  },
  eventDelta: {
    fontSize: 13,
    fontWeight: 700,
  },
  eventNarrative: {
    fontSize: 13,
    color: theme.textBody,
    margin: 0,
    lineHeight: 1.5,
  },
};
