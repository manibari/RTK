"use client";

import { useState, useEffect, useCallback } from "react";
import { trpc } from "../lib/trpc";
import { theme } from "../lib/theme";

interface HeroEntry {
  id: string;
  name: string;
  alive: boolean;
  factionId: string | null;
  prestige: number;
  achievements: string[];
  legacy: boolean;
}

const FACTION_COLORS: Record<string, string> = {
  shu: theme.factionShu,
  wei: theme.factionWei,
  wu: theme.factionWu,
  lu_bu: theme.factionLuBu,
};

const FACTION_NAMES: Record<string, string> = {
  shu: "蜀",
  wei: "魏",
  wu: "吳",
  lu_bu: "呂布",
};

const ACHIEVEMENT_LABELS: Record<string, string> = {
  warrior: "百戰名將",
  conqueror: "征服者",
  spymaster: "暗影之主",
  diplomat: "縱橫家",
};

interface HeroHallProps {
  currentTick: number;
  onViewCharacter?: (id: string) => void;
}

export function HeroHall({ currentTick, onViewCharacter }: HeroHallProps) {
  const [heroes, setHeroes] = useState<HeroEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "alive" | "dead">("all");

  const fetchHeroes = useCallback(async () => {
    try {
      const data = await trpc.simulation.getHeroHall.query();
      setHeroes(data as HeroEntry[]);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHeroes();
  }, [currentTick, fetchHeroes]);

  const filtered = heroes.filter((h) => {
    if (filter === "alive") return h.alive;
    if (filter === "dead") return !h.alive;
    return true;
  });

  if (loading) {
    return <div style={styles.container}><span style={styles.loading}>載入中...</span></div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>英雄堂</h2>
        <div style={styles.filterGroup}>
          {(["all", "alive", "dead"] as const).map((f) => (
            <button
              key={f}
              style={filter === f ? styles.filterActive : styles.filterBtn}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "全部" : f === "alive" ? "在世" : "已故"}
            </button>
          ))}
        </div>
        <span style={styles.count}>{filtered.length} 位英雄</span>
      </div>

      {filtered.length === 0 ? (
        <div style={styles.empty}>尚無英雄入堂</div>
      ) : (
        <div style={styles.grid}>
          {filtered.map((hero) => (
            <HeroCard key={hero.id} hero={hero} onClick={onViewCharacter ? () => onViewCharacter(hero.id) : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}

function HeroCard({ hero, onClick }: { hero: HeroEntry; onClick?: () => void }) {
  const factionColor = hero.factionId ? FACTION_COLORS[hero.factionId] ?? theme.textMuted : theme.textMuted;
  const factionName = hero.factionId ? FACTION_NAMES[hero.factionId] ?? hero.factionId : "無所屬";

  return (
    <div style={{
      ...styles.card,
      borderColor: hero.alive ? factionColor : theme.bg3,
      opacity: hero.alive ? 1 : 0.7,
      cursor: onClick ? "pointer" : "default",
    }} onClick={onClick}>
      <div style={styles.cardHeader}>
        <span style={{ ...styles.heroName, color: hero.alive ? theme.textPrimary : theme.textSecondary }}>
          {hero.name}
        </span>
        <span style={{
          ...styles.statusBadge,
          backgroundColor: hero.alive ? `${theme.success}20` : `${theme.textMuted}20`,
          color: hero.alive ? theme.success : theme.textMuted,
        }}>
          {hero.alive ? "在世" : hero.legacy ? "遺志" : "已故"}
        </span>
      </div>

      <div style={styles.cardBody}>
        <div style={styles.row}>
          <span style={{ ...styles.factionTag, backgroundColor: `${factionColor}20`, color: factionColor }}>
            {factionName}
          </span>
          <span style={styles.prestige}>
            ★ {hero.prestige}
          </span>
        </div>

        {hero.achievements.length > 0 && (
          <div style={styles.achievements}>
            {hero.achievements.map((a) => (
              <span key={a} style={styles.achievementBadge}>
                {ACHIEVEMENT_LABELS[a] ?? a}
              </span>
            ))}
          </div>
        )}

        {hero.legacy && (
          <div style={styles.legacyTag}>遺產加成生效中</div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    padding: 20,
    overflow: "auto",
    backgroundColor: theme.bg1,
  },
  loading: {
    color: theme.textMuted,
    fontSize: 14,
    padding: 40,
    textAlign: "center",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 20,
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
    color: theme.accent,
  },
  filterGroup: {
    display: "flex",
    gap: 4,
  },
  filterBtn: {
    padding: "4px 12px",
    borderRadius: 6,
    border: `1px solid ${theme.bg3}`,
    backgroundColor: theme.bg2,
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  filterActive: {
    padding: "4px 12px",
    borderRadius: 6,
    border: `1px solid ${theme.accent}`,
    backgroundColor: `${theme.accent}20`,
    color: theme.accent,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  count: {
    marginLeft: "auto",
    fontSize: 13,
    color: theme.textMuted,
  },
  empty: {
    textAlign: "center",
    color: theme.textMuted,
    padding: 60,
    fontSize: 14,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 12,
  },
  card: {
    backgroundColor: theme.bg2,
    borderRadius: 10,
    border: `1px solid ${theme.bg3}`,
    borderLeftWidth: 3,
    padding: 14,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  heroName: {
    fontSize: 15,
    fontWeight: 700,
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 8,
  },
  cardBody: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  factionTag: {
    fontSize: 12,
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 6,
  },
  prestige: {
    fontSize: 14,
    fontWeight: 700,
    color: theme.accent,
  },
  achievements: {
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
  },
  achievementBadge: {
    fontSize: 11,
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 8,
    backgroundColor: `${theme.special}20`,
    color: theme.special,
  },
  legacyTag: {
    fontSize: 11,
    color: theme.accent,
    fontStyle: "italic",
  },
};
