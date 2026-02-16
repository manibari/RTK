"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { trpc } from "../lib/trpc";
import { GraphPage } from "./GraphPage";
import { MapPage } from "./MapPage";
import { GameLog } from "./GameLog";
import { ToastStack, createToastId, type ToastMessage } from "./ToastStack";

type ViewTab = "graph" | "map" | "log";
type SimSpeed = 1 | 2 | 5;

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

interface RecruitmentResult {
  tick: number;
  recruiterId: string;
  recruiterName: string;
  targetId: string;
  targetName: string;
  success: boolean;
  newFaction?: string;
}

type GameStatus = "ongoing" | "victory" | "defeat";

const SPEED_DELAYS: Record<SimSpeed, number> = { 1: 1500, 2: 750, 5: 300 };

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
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [autoSim, setAutoSim] = useState(false);
  const [simSpeed, setSimSpeed] = useState<SimSpeed>(1);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSimRef = useRef(false);
  const advancingRef = useRef(false);

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

  // Auto-play (timeline replay)
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

  const addToast = useCallback((text: string, color: string) => {
    setToasts((prev) => [...prev, { id: createToastId(), text, color }]);
  }, []);

  const handleAdvanceDay = useCallback(async () => {
    if (gameStatus !== "ongoing") return undefined;
    setAdvancing(true);
    advancingRef.current = true;
    try {
      const result = await trpc.simulation.advanceDay.mutate();
      setCurrentTick(result.tick);
      setViewTick(result.tick);
      setGameStatus(result.gameStatus as GameStatus);

      // Stop auto-sim on game over
      if (result.gameStatus !== "ongoing") {
        setAutoSim(false);
        autoSimRef.current = false;
      }

      // Accumulate log entries
      if (result.battleResults?.length > 0) {
        setAllBattles((prev) => [...prev, ...result.battleResults]);
        for (const b of result.battleResults) {
          const text = b.captured
            ? `${b.attackerName} 攻陷 ${b.cityName}`
            : `${b.attackerName} 未能攻下 ${b.cityName}`;
          addToast(text, b.captured ? "#ef4444" : "#64748b");
        }
      }
      if (result.diplomacyEvents?.length > 0) {
        setAllDiplomacy((prev) => [...prev, ...result.diplomacyEvents]);
        for (const d of result.diplomacyEvents) {
          const color = d.type === "alliance_formed" ? "#22c55e" : "#f59e0b";
          addToast(d.description, color);
        }
      }
      if (result.recruitmentResults?.length > 0) {
        for (const r of result.recruitmentResults as RecruitmentResult[]) {
          if (r.success) {
            addToast(`${r.recruiterName} 招降了 ${r.targetName}`, "#a855f7");
          }
        }
      }
      if (result.dailySummary) {
        setSummaries((prev) => new Map(prev).set(result.tick, result.dailySummary));
      }

      return result;
    } finally {
      setAdvancing(false);
      advancingRef.current = false;
    }
  }, [gameStatus, addToast]);

  // Auto-simulate loop
  useEffect(() => {
    autoSimRef.current = autoSim;
    if (!autoSim) return;

    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      if (!autoSimRef.current || advancingRef.current) return;
      await handleAdvanceDay();
      if (autoSimRef.current) {
        timer = setTimeout(loop, SPEED_DELAYS[simSpeed]);
      }
    };
    timer = setTimeout(loop, SPEED_DELAYS[simSpeed]);

    return () => clearTimeout(timer);
  }, [autoSim, simSpeed, handleAdvanceDay]);

  const toggleAutoSim = useCallback(() => {
    setAutoSim((prev) => {
      const next = !prev;
      autoSimRef.current = next;
      return next;
    });
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleReset = useCallback(async () => {
    setAutoSim(false);
    autoSimRef.current = false;
    await trpc.simulation.reset.mutate();
    setCurrentTick(0);
    setViewTick(0);
    setGameStatus("ongoing");
    setAllBattles([]);
    setAllDiplomacy([]);
    setSummaries(new Map());
    setToasts([]);
    addToast("遊戲已重置", "#22c55e");
  }, [addToast]);

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
          <button style={styles.resetBtn} onClick={handleReset}>重新開始</button>
        </div>
      )}

      {/* Tab bar + auto-sim controls */}
      <nav style={styles.tabBar}>
        <div style={styles.tabGroup}>
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
        </div>

        {/* Auto-simulate controls */}
        <div style={styles.autoSimBar}>
          <button
            style={{
              ...styles.autoSimBtn,
              backgroundColor: autoSim ? "#ef4444" : "#22c55e",
            }}
            onClick={toggleAutoSim}
            disabled={gameStatus !== "ongoing"}
          >
            {autoSim ? "停止模擬" : "自動模擬"}
          </button>
          <select
            style={styles.speedSelect}
            value={simSpeed}
            onChange={(e) => setSimSpeed(Number(e.target.value) as SimSpeed)}
          >
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={5}>5x</option>
          </select>
          {autoSim && <span style={styles.simIndicator}>模擬中...</span>}
        </div>
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
            advancing={advancing || autoSim || gameStatus !== "ongoing"}
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
            advancing={advancing || autoSim || gameStatus !== "ongoing"}
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

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
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
  resetBtn: {
    marginLeft: 16,
    padding: "6px 16px",
    borderRadius: 6,
    border: "2px solid #0f172a",
    backgroundColor: "transparent",
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  tabBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #334155",
    backgroundColor: "#0f172a",
    flexShrink: 0,
  },
  tabGroup: {
    display: "flex",
    gap: 0,
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
  autoSimBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    paddingRight: 16,
  },
  autoSimBtn: {
    padding: "6px 14px",
    borderRadius: 6,
    border: "none",
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  speedSelect: {
    padding: "4px 8px",
    borderRadius: 4,
    border: "1px solid #334155",
    backgroundColor: "#1e293b",
    color: "#e2e8f0",
    fontSize: 13,
  },
  simIndicator: {
    fontSize: 12,
    color: "#22c55e",
    fontWeight: 600,
    animation: "pulse 1.5s ease-in-out infinite",
  },
  content: {
    flex: 1,
    minHeight: 0,
    display: "flex",
  },
};
