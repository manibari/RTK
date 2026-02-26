"use client";

import { useState, useEffect } from "react";
import { trpc } from "../lib/trpc";
import { theme } from "../lib/theme";

type WinType = "conquest" | "diplomacy" | "economy";
type GameStatus = "victory" | "defeat";

interface TopCharacter {
  id: string;
  name: string;
  prestige: number;
  achievements: string[];
}

interface VictoryScreenProps {
  status: GameStatus;
  onRestart: () => void;
}

const WIN_LABELS: Record<WinType, { title: string; desc: string }> = {
  conquest: { title: "武力統一", desc: "以鐵騎踏遍天下，一統山河！" },
  diplomacy: { title: "外交聯盟", desc: "縱橫捭闔，天下諸侯皆為盟友！" },
  economy: { title: "經濟制霸", desc: "富可敵國，以財帛定天下！" },
};

const ACHIEVEMENT_LABELS: Record<string, string> = {
  veteran: "百戰老將",
  conqueror: "攻城略地",
  spymaster_ace: "暗影之手",
  diplomat_star: "縱橫家",
};

export function VictoryScreen({ status, onRestart }: VictoryScreenProps) {
  const [stats, setStats] = useState<{
    winType: WinType;
    tick: number;
    topCharacters: TopCharacter[];
    factionStats: { id: string; cities: number; gold: number; characters: number }[];
  } | null>(null);

  useEffect(() => {
    if (status === "victory") {
      trpc.simulation.getVictoryStats.query().then((data) => {
        setStats(data as typeof stats);
      }).catch(() => {});
    }
  }, [status]);

  if (status === "defeat") {
    return (
      <div style={styles.overlay}>
        <div style={styles.panel}>
          <h1 style={{ ...styles.title, color: theme.danger }}>戰敗</h1>
          <p style={styles.desc}>你的勢力已被消滅...</p>
          <button style={styles.restartBtn} onClick={onRestart}>重新開始</button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const win = WIN_LABELS[stats.winType];

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        <div style={styles.badge}>{win.title}</div>
        <h1 style={styles.title}>勝利！</h1>
        <p style={styles.desc}>{win.desc}</p>
        <div style={styles.tickInfo}>歷時 {stats.tick} 天</div>

        {stats.topCharacters.length > 0 && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>功勛榜</h3>
            {stats.topCharacters.map((c, i) => (
              <div key={c.id} style={styles.charRow}>
                <span style={styles.rank}>#{i + 1}</span>
                <span style={styles.charName}>{c.name}</span>
                <span style={styles.prestige}>威望 {c.prestige}</span>
                {c.achievements.length > 0 && (
                  <div style={styles.badges}>
                    {c.achievements.map((a) => (
                      <span key={a} style={styles.achieveBadge}>{ACHIEVEMENT_LABELS[a] ?? a}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>最終勢力</h3>
          {stats.factionStats.map((f) => (
            <div key={f.id} style={styles.factionRow}>
              <span style={styles.factionId}>{f.id.toUpperCase()}</span>
              <span style={styles.factionStat}>城{f.cities} 將{f.characters} 金{f.gold}</span>
            </div>
          ))}
        </div>

        <button style={styles.restartBtn} onClick={onRestart}>重新開始</button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3000,
  },
  panel: {
    width: 420,
    maxHeight: "80vh",
    overflowY: "auto",
    backgroundColor: theme.bg2,
    borderRadius: 16,
    padding: 32,
    color: theme.textPrimary,
    textAlign: "center",
    border: `2px solid ${theme.accent}`,
  },
  badge: {
    display: "inline-block",
    fontSize: 13,
    fontWeight: 700,
    padding: "4px 16px",
    borderRadius: 20,
    backgroundColor: theme.accent,
    color: theme.bg1,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 800,
    margin: "0 0 8px",
    color: theme.accent,
  },
  desc: {
    fontSize: 15,
    color: theme.textBody,
    margin: "0 0 8px",
    lineHeight: 1.5,
  },
  tickInfo: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 20,
  },
  section: {
    textAlign: "left",
    marginBottom: 16,
    paddingTop: 12,
    borderTop: `1px solid ${theme.bg3}`,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: theme.textPrimary,
    marginTop: 0,
    marginBottom: 8,
  },
  charRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 8px",
    backgroundColor: theme.bg1,
    borderRadius: 6,
    marginBottom: 4,
    flexWrap: "wrap",
  },
  rank: {
    fontSize: 13,
    fontWeight: 700,
    color: theme.accent,
    width: 24,
  },
  charName: {
    fontSize: 14,
    fontWeight: 600,
    color: theme.textPrimary,
  },
  prestige: {
    fontSize: 12,
    color: theme.special,
    fontWeight: 600,
    marginLeft: "auto",
  },
  badges: {
    display: "flex",
    gap: 4,
    width: "100%",
    paddingLeft: 32,
  },
  achieveBadge: {
    fontSize: 10,
    padding: "1px 6px",
    borderRadius: 8,
    backgroundColor: theme.special,
    color: "#fff",
    fontWeight: 600,
  },
  factionRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "4px 8px",
    backgroundColor: theme.bg1,
    borderRadius: 4,
    marginBottom: 4,
  },
  factionId: {
    fontSize: 13,
    fontWeight: 700,
    color: theme.textSecondary,
  },
  factionStat: {
    fontSize: 12,
    color: theme.textMuted,
  },
  restartBtn: {
    marginTop: 16,
    padding: "10px 32px",
    borderRadius: 8,
    border: "none",
    backgroundColor: theme.success,
    color: theme.bg1,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  },
};
