"use client";

import { useState } from "react";

interface BattleResult {
  tick: number;
  cityName: string;
  attackerName: string;
  defenderName: string | null;
  winner: "attacker" | "defender";
  captured: boolean;
  attackPower?: number;
  defensePower?: number;
}

interface DiplomacyEvent {
  tick: number;
  type: "alliance_formed" | "alliance_broken" | "betrayal";
  factionA: string;
  factionB: string;
  description: string;
}

interface GameLogEntry {
  tick: number;
  type: "battle" | "diplomacy" | "summary";
  text: string;
  color: string;
}

interface GameLogProps {
  battles: BattleResult[];
  diplomacy: DiplomacyEvent[];
  summaries: Map<number, string>;
  currentTick: number;
}

type LogFilter = "battle" | "diplomacy" | "summary";

export function GameLog({ battles, diplomacy, summaries, currentTick }: GameLogProps) {
  const [activeFilters, setActiveFilters] = useState<Set<LogFilter>>(new Set(["battle", "diplomacy", "summary"]));

  const toggleFilter = (f: LogFilter) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(f)) { next.delete(f); } else { next.add(f); }
      return next;
    });
  };

  // Merge all events into a unified log
  const entries: GameLogEntry[] = [];

  for (const b of battles) {
    const powerStr = b.attackPower != null ? ` [攻:${b.attackPower} vs 守:${b.defensePower}]` : "";
    const result = b.captured
      ? `${b.attackerName} 攻陷 ${b.cityName}${b.defenderName ? `（守將：${b.defenderName}）` : ""}${powerStr}`
      : `${b.attackerName} 未能攻下 ${b.cityName}${b.defenderName ? `（${b.defenderName} 防守成功）` : ""}${powerStr}`;
    entries.push({ tick: b.tick, type: "battle", text: result, color: b.captured ? "#ef4444" : "#94a3b8" });
  }

  for (const d of diplomacy) {
    const color = d.type === "alliance_formed" ? "#22c55e" : "#f59e0b";
    entries.push({ tick: d.tick, type: "diplomacy", text: d.description, color });
  }

  for (const [tick, summary] of summaries) {
    entries.push({ tick, type: "summary", text: summary, color: "#94a3b8" });
  }

  // Sort by tick descending
  entries.sort((a, b) => b.tick - a.tick);

  const filtered = entries.filter((e) => activeFilters.has(e.type as LogFilter));

  const typeLabels: Record<string, string> = {
    battle: "戰報",
    diplomacy: "外交",
    summary: "日報",
  };

  const filterColors: Record<string, string> = {
    battle: "#ef4444",
    diplomacy: "#22c55e",
    summary: "#94a3b8",
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>RTK - Game Log</h1>
        <span style={styles.tick}>Day {currentTick}</span>
        <div style={styles.filterBar}>
          {(["battle", "diplomacy", "summary"] as LogFilter[]).map((f) => (
            <button
              key={f}
              style={{
                ...styles.filterBtn,
                backgroundColor: activeFilters.has(f) ? filterColors[f] : "transparent",
                color: activeFilters.has(f) ? "#0f172a" : "#94a3b8",
                borderColor: filterColors[f],
              }}
              onClick={() => toggleFilter(f)}
            >
              {typeLabels[f]}
            </button>
          ))}
        </div>
        <span style={styles.count}>{filtered.length}/{entries.length}</span>
      </div>

      {filtered.length === 0 ? (
        <div style={styles.empty}>尚無記錄。推進遊戲開始產生事件。</div>
      ) : (
        <div style={styles.list}>
          {filtered.map((entry, i) => (
            <div key={i} style={styles.entry}>
              <div style={styles.entryHeader}>
                <span style={styles.entryDay}>Day {entry.tick}</span>
                <span style={{ ...styles.entryType, color: entry.color }}>
                  {typeLabels[entry.type]}
                </span>
              </div>
              <p style={styles.entryText}>{entry.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    padding: 20,
    overflowY: "auto",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
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
  filterBar: {
    display: "flex",
    gap: 4,
    marginLeft: 12,
  },
  filterBtn: {
    padding: "3px 10px",
    borderRadius: 4,
    border: "1px solid",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  },
  count: {
    fontSize: 13,
    color: "#64748b",
    marginLeft: "auto",
  },
  empty: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#64748b",
    fontStyle: "italic",
    fontSize: 16,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  entry: {
    padding: "10px 14px",
    backgroundColor: "#1e293b",
    borderRadius: 8,
  },
  entryHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  entryDay: {
    fontSize: 11,
    color: "#f59e0b",
    fontWeight: 600,
  },
  entryType: {
    fontSize: 11,
    fontWeight: 700,
  },
  entryText: {
    fontSize: 14,
    color: "#cbd5e1",
    margin: 0,
    lineHeight: 1.5,
  },
};
