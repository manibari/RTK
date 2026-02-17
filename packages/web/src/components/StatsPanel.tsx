"use client";

import { useState, useEffect, useCallback } from "react";
import { trpc } from "../lib/trpc";

interface FactionStat {
  id: string;
  name: string;
  color: string;
  gold: number;
  cities: number;
  characters: number;
  power: number;
}

type AlliancePair = [string, string];

interface StatsPanelProps {
  currentTick: number;
  onMessage?: (text: string, color: string) => void;
}

export function StatsPanel({ currentTick, onMessage }: StatsPanelProps) {
  const [stats, setStats] = useState<FactionStat[]>([]);
  const [alliances, setAlliances] = useState<AlliancePair[]>([]);
  const [history, setHistory] = useState<Record<string, { tick: number; power: number }[]>>({});
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const [s, a, h] = await Promise.all([
        trpc.simulation.getFactionStats.query(),
        trpc.simulation.getAlliances.query(),
        trpc.simulation.getFactionHistory.query(),
      ]);
      setStats(s as FactionStat[]);
      setAlliances(a as unknown as AlliancePair[]);
      setHistory(h as Record<string, { tick: number; power: number }[]>);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [currentTick, fetchStats]);

  const handlePropose = async (factionId: string) => {
    const result = await trpc.simulation.proposeAlliance.mutate({ factionId });
    if (result.success) {
      fetchStats();
    }
    onMessage?.(result.reason, result.success ? "#22c55e" : "#ef4444");
  };

  const handleBreak = async (factionId: string) => {
    const result = await trpc.simulation.breakAlliance.mutate({ factionId });
    if (result.success) {
      fetchStats();
    }
    onMessage?.(result.reason, result.success ? "#f59e0b" : "#ef4444");
  };

  if (loading) {
    return <div style={styles.loading}>Loading stats...</div>;
  }

  const maxPower = Math.max(...stats.map((s) => s.power), 1);
  const maxGold = Math.max(...stats.map((s) => s.gold), 1);
  const maxCities = Math.max(...stats.map((s) => s.cities), 1);

  const isAllied = (factionId: string): boolean =>
    alliances.some((a) => (a[0] === "shu" && a[1] === factionId) || (a[0] === factionId && a[1] === "shu"));

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>RTK - Faction Stats</h1>
        <span style={styles.tick}>Day {currentTick}</span>
      </div>

      {/* Faction cards */}
      <div style={styles.grid}>
        {stats.map((f) => (
          <div key={f.id} style={{ ...styles.card, borderLeft: `4px solid ${f.color}` }}>
            <div style={styles.cardHeader}>
              <span style={{ ...styles.factionName, color: f.color }}>{f.name}</span>
              <span style={styles.factionId}>{f.id.toUpperCase()}</span>
            </div>

            <div style={styles.statRow}>
              <span style={styles.statLabel}>城市</span>
              <div style={styles.barWrap}>
                <div style={{ ...styles.bar, width: `${(f.cities / maxCities) * 100}%`, backgroundColor: f.color }} />
              </div>
              <span style={styles.statValue}>{f.cities}</span>
            </div>

            <div style={styles.statRow}>
              <span style={styles.statLabel}>武將</span>
              <div style={styles.barWrap}>
                <div style={{ ...styles.bar, width: `${(f.characters / 10) * 100}%`, backgroundColor: f.color, opacity: 0.7 }} />
              </div>
              <span style={styles.statValue}>{f.characters}</span>
            </div>

            <div style={styles.statRow}>
              <span style={styles.statLabel}>軍力</span>
              <div style={styles.barWrap}>
                <div style={{ ...styles.bar, width: `${(f.power / maxPower) * 100}%`, backgroundColor: "#ef4444" }} />
              </div>
              <span style={styles.statValue}>{f.power}</span>
            </div>

            <div style={styles.statRow}>
              <span style={styles.statLabel}>金幣</span>
              <div style={styles.barWrap}>
                <div style={{ ...styles.bar, width: `${(f.gold / maxGold) * 100}%`, backgroundColor: "#f59e0b" }} />
              </div>
              <span style={styles.statValue}>{f.gold}</span>
            </div>

            {/* Power trend sparkline */}
            {history[f.id] && history[f.id].length > 1 && (
              <div style={styles.sparklineWrap}>
                <span style={{ fontSize: 11, color: "#64748b" }}>軍力趨勢</span>
                <Sparkline data={history[f.id].map((e) => e.power)} color={f.color} />
              </div>
            )}

            {/* Diplomacy buttons (only for non-player factions) */}
            {f.id !== "shu" && (
              <div style={styles.diplomacyRow}>
                {isAllied(f.id) ? (
                  <button style={styles.breakBtn} onClick={() => handleBreak(f.id)}>
                    解除同盟
                  </button>
                ) : (
                  <button style={styles.allyBtn} onClick={() => handlePropose(f.id)}>
                    提議結盟
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Current alliances */}
      {alliances.length > 0 && (
        <div style={styles.allianceSection}>
          <h2 style={styles.sectionTitle}>Current Alliances</h2>
          <div style={styles.allianceList}>
            {alliances.map((a, i) => {
              const fA = stats.find((s) => s.id === a[0]);
              const fB = stats.find((s) => s.id === a[1]);
              return (
                <div key={i} style={styles.allianceItem}>
                  <span style={{ color: fA?.color ?? "#fff", fontWeight: 600 }}>
                    {fA?.name ?? a[0]}
                  </span>
                  <span style={styles.allianceArrow}>&harr;</span>
                  <span style={{ color: fB?.color ?? "#fff", fontWeight: 600 }}>
                    {fB?.name ?? a[1]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
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
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
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
  loading: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#64748b",
    fontSize: 18,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 16,
  },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    padding: 16,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  factionName: {
    fontSize: 18,
    fontWeight: 700,
  },
  factionId: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: 600,
  },
  statRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 12,
    color: "#94a3b8",
    width: 36,
    flexShrink: 0,
  },
  barWrap: {
    flex: 1,
    height: 8,
    backgroundColor: "#0f172a",
    borderRadius: 4,
    overflow: "hidden",
  },
  bar: {
    height: "100%",
    borderRadius: 4,
    transition: "width 0.3s ease",
  },
  statValue: {
    fontSize: 13,
    fontWeight: 600,
    color: "#e2e8f0",
    width: 40,
    textAlign: "right" as const,
  },
  sparklineWrap: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTop: "1px solid #334155",
  },
  diplomacyRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTop: "1px solid #334155",
  },
  allyBtn: {
    width: "100%",
    padding: "6px 0",
    borderRadius: 4,
    border: "none",
    backgroundColor: "#22c55e",
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  breakBtn: {
    width: "100%",
    padding: "6px 0",
    borderRadius: 4,
    border: "none",
    backgroundColor: "#ef4444",
    color: "#fff",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  allianceSection: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 12,
    color: "#e2e8f0",
  },
  allianceList: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 12,
  },
  allianceItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1e293b",
    padding: "8px 14px",
    borderRadius: 6,
    fontSize: 14,
  },
  allianceArrow: {
    color: "#64748b",
    fontSize: 16,
  },
};
