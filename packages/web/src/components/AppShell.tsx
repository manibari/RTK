"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { trpc } from "../lib/trpc";
import { GraphPage } from "./GraphPage";
import { MapPage } from "./MapPage";
import { GameLog } from "./GameLog";

type ViewTab = "graph" | "map" | "log";

interface BattleResult {
  tick: number;
  cityId: string;
  cityName: string;
  attackerId: string;
  attackerName: string;
  defenderId: string | null;
  defenderName: string | null;
  winner: "attacker" | "defender";
  captured: boolean;
}

interface DiplomacyEvent {
  tick: number;
  type: "alliance_formed" | "alliance_broken" | "betrayal";
  factionA: string;
  factionB: string;
  description: string;
}

type GameStatus = "ongoing" | "victory" | "defeat";

export function AppShell() {
  const [activeTab, setActiveTab] = useState<ViewTab>("graph");
  const [currentTick, setCurrentTick] = useState(0);
  const [viewTick, setViewTick] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [gameStatus, setGameStatus] = useState<GameStatus>("ongoing");
  const [allBattles, setAllBattles] = useState<BattleResult[]>([]);
  const [allDiplomacy, setAllDiplomacy] = useState<DiplomacyEvent[]>([]);
  const [summaries, setSummaries] = useState<Map<number, string>>(new Map());
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch initial state
  useEffect(() => {
    Promise.all([
      trpc.simulation.getCurrentTick.query(),
      trpc.simulation.getGameState.query(),
    ]).then(([tickData, state]) => {
      setCurrentTick(tickData.tick);
      setViewTick(tickData.tick);
      setGameStatus(state.status as GameStatus);
    }).catch(() => {});
  }, []);

  // Auto-play
  useEffect(() => {
    if (playing) {
      playRef.current = setInterval(() => {
        setViewTick((prev) => {
          if (prev >= currentTick) {
            setPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 500);
    }
    return () => {
      if (playRef.current) clearInterval(playRef.current);
    };
  }, [playing, currentTick]);

  const handlePlayToggle = useCallback(() => {
    if (playing) {
      setPlaying(false);
    } else {
      if (viewTick >= currentTick) setViewTick(0);
      setPlaying(true);
    }
  }, [playing, viewTick, currentTick]);

  const handleAdvanceDay = useCallback(async () => {
    if (gameStatus !== "ongoing") return undefined;
    setAdvancing(true);
    try {
      const result = await trpc.simulation.advanceDay.mutate();
      setCurrentTick(result.tick);
      setViewTick(result.tick);
      setGameStatus(result.gameStatus as GameStatus);

      // Accumulate log entries
      if (result.battleResults?.length > 0) {
        setAllBattles((prev) => [...prev, ...result.battleResults]);
      }
      if (result.diplomacyEvents?.length > 0) {
        setAllDiplomacy((prev) => [...prev, ...result.diplomacyEvents]);
      }
      if (result.dailySummary) {
        setSummaries((prev) => new Map(prev).set(result.tick, result.dailySummary));
      }

      return result;
    } finally {
      setAdvancing(false);
    }
  }, [gameStatus]);

  const statusBanner = gameStatus === "victory"
    ? { text: "勝利！你統一了天下！", color: "#22c55e" }
    : gameStatus === "defeat"
      ? { text: "戰敗...你的勢力已被消滅", color: "#ef4444" }
      : null;

  return (
    <div style={styles.root}>
      {/* Game over banner */}
      {statusBanner && (
        <div style={{ ...styles.banner, backgroundColor: statusBanner.color }}>
          {statusBanner.text}
        </div>
      )}

      {/* Tab bar */}
      <nav style={styles.tabBar}>
        <button
          style={activeTab === "graph" ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab("graph")}
        >
          關係圖
        </button>
        <button
          style={activeTab === "map" ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab("map")}
        >
          戰略地圖
        </button>
        <button
          style={activeTab === "log" ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab("log")}
        >
          日誌 {allBattles.length + allDiplomacy.length > 0 && (
            <span style={styles.logBadge}>{allBattles.length + allDiplomacy.length}</span>
          )}
        </button>
      </nav>

      {/* Content */}
      <div style={styles.content}>
        {activeTab === "graph" ? (
          <GraphPage
            currentTick={currentTick}
            viewTick={viewTick}
            onTickChange={setViewTick}
            playing={playing}
            onPlayToggle={handlePlayToggle}
            advancing={advancing || gameStatus !== "ongoing"}
            onAdvanceDay={handleAdvanceDay}
            onTickUpdate={(tick) => { setCurrentTick(tick); setViewTick(tick); }}
          />
        ) : activeTab === "map" ? (
          <MapPage
            currentTick={currentTick}
            viewTick={viewTick}
            onTickChange={setViewTick}
            playing={playing}
            onPlayToggle={handlePlayToggle}
            advancing={advancing || gameStatus !== "ongoing"}
            onAdvanceDay={handleAdvanceDay}
          />
        ) : (
          <GameLog
            battles={allBattles}
            diplomacy={allDiplomacy}
            summaries={summaries}
            currentTick={currentTick}
          />
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    backgroundColor: "#0f172a",
    color: "#e2e8f0",
    fontFamily: "system-ui, sans-serif",
  },
  banner: {
    padding: "12px 24px",
    textAlign: "center",
    fontSize: 18,
    fontWeight: 700,
    color: "#0f172a",
    flexShrink: 0,
  },
  tabBar: {
    display: "flex",
    gap: 0,
    borderBottom: "1px solid #334155",
    backgroundColor: "#0f172a",
    flexShrink: 0,
  },
  tab: {
    padding: "10px 24px",
    fontSize: 14,
    fontWeight: 600,
    color: "#64748b",
    backgroundColor: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    cursor: "pointer",
  },
  tabActive: {
    padding: "10px 24px",
    fontSize: 14,
    fontWeight: 600,
    color: "#f59e0b",
    backgroundColor: "transparent",
    border: "none",
    borderBottom: "2px solid #f59e0b",
    cursor: "pointer",
  },
  logBadge: {
    marginLeft: 6,
    fontSize: 11,
    backgroundColor: "#f59e0b",
    color: "#0f172a",
    padding: "1px 6px",
    borderRadius: 8,
    fontWeight: 700,
  },
  content: {
    flex: 1,
    minHeight: 0,
    display: "flex",
  },
};
