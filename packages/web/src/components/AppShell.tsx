"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { trpc } from "../lib/trpc";
import { GraphPage } from "./GraphPage";
import { MapPage } from "./MapPage";
import { GameLog } from "./GameLog";
import { StatsPanel } from "./StatsPanel";
import { ToastStack, createToastId, type ToastMessage } from "./ToastStack";
import { VictoryScreen } from "./VictoryScreen";
import type { TimelineMarker } from "./Timeline";

type ViewTab = "graph" | "map" | "log" | "stats";
type SimSpeed = 1 | 2 | 5;
type Season = "spring" | "summer" | "autumn" | "winter";

const SEASON_INFO: Record<Season, { label: string; color: string }> = {
  spring: { label: "春", color: "#22c55e" },
  summer: { label: "夏", color: "#ef4444" },
  autumn: { label: "秋", color: "#f59e0b" },
  winter: { label: "冬", color: "#3b82f6" },
};

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
  attackPower?: number;
  defensePower?: number;
}

interface DiplomacyEvent {
  tick: number;
  type: "alliance_formed" | "alliance_broken" | "betrayal" | "demand_accepted" | "demand_rejected";
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

interface EventCardChoice {
  label: string;
  effect: Record<string, unknown>;
}

interface PendingEventCard {
  card: {
    id: string;
    title: string;
    description: string;
    choices: EventCardChoice[];
  };
  tick: number;
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
  const [season, setSeason] = useState<Season>("spring");
  const [allBattles, setAllBattles] = useState<BattleResult[]>([]);
  const [allDiplomacy, setAllDiplomacy] = useState<DiplomacyEvent[]>([]);
  const [summaries, setSummaries] = useState<Map<number, string>>(new Map());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [pendingCard, setPendingCard] = useState<PendingEventCard | null>(null);
  const [headline, setHeadline] = useState<{ text: string; color: string } | null>(null);
  const headlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      if (tickData.season) setSeason(tickData.season as Season);
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

  const showHeadline = useCallback((text: string, color: string) => {
    setHeadline({ text, color });
    if (headlineTimerRef.current) clearTimeout(headlineTimerRef.current);
    headlineTimerRef.current = setTimeout(() => setHeadline(null), 4000);
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
      if (result.season) setSeason(result.season as Season);

      // Stop auto-sim on game over
      if (result.gameStatus !== "ongoing") {
        setAutoSim(false);
        autoSimRef.current = false;
      }

      // Accumulate log entries
      if (result.battleResults?.length > 0) {
        setAllBattles((prev) => [...prev, ...result.battleResults]);
        for (const b of result.battleResults) {
          const powerStr = b.attackPower != null ? ` [${b.attackPower} vs ${b.defensePower}]` : "";
          const text = b.captured
            ? `${b.attackerName} 攻陷 ${b.cityName}${powerStr}`
            : `${b.attackerName} 未能攻下 ${b.cityName}${powerStr}`;
          addToast(text, b.captured ? "#ef4444" : "#64748b");
          if (b.captured) showHeadline(`⚔ ${b.attackerName} 攻陷 ${b.cityName}！`, "#ef4444");
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
      if (result.betrayalEvents?.length > 0) {
        for (const b of result.betrayalEvents) {
          addToast(`${b.characterName} 背叛了 ${b.oldFaction}，投奔 ${b.newFaction}`, "#f97316");
          showHeadline(`${b.characterName} 叛變！投奔 ${b.newFaction}`, "#f97316");
        }
      }
      if (result.spyReports?.length > 0) {
        for (const s of result.spyReports) {
          if (s.success && s.missionType === "intel") {
            addToast(`${s.characterName} 偵查 ${s.targetCityName}：守備${s.intel?.garrison} 金幣${s.intel?.gold}`, "#6366f1");
          } else if (s.success && s.missionType === "sabotage") {
            addToast(`${s.characterName} 破壞 ${s.targetCityName}：${s.sabotageEffect}`, "#6366f1");
          } else if (s.caught) {
            addToast(`${s.characterName} 在 ${s.targetCityName} 被捕！`, "#ef4444");
          } else {
            addToast(`${s.characterName} 任務失敗`, "#64748b");
          }
        }
      }
      if (result.deathEvents?.length > 0) {
        for (const d of result.deathEvents) {
          const suffix = d.wasLeader && d.successorName ? `，${d.successorName} 繼任` : "";
          const heirSuffix = d.heirName ? `｜後嗣 ${d.heirName} 加入` : "";
          const causeText = d.cause === "old_age" ? "壽終正寢" : "戰死";
          addToast(`${d.characterName} ${causeText}${suffix}${heirSuffix}`, d.cause === "old_age" ? "#64748b" : "#991b1b");
          if (d.wasLeader) showHeadline(`${d.characterName} ${causeText}${suffix}`, "#991b1b");
        }
      }
      if (result.worldEvents?.length > 0) {
        for (const w of result.worldEvents) {
          const colors: Record<string, string> = { plague: "#a855f7", drought: "#f59e0b", bandits: "#f97316" };
          addToast(w.description, colors[w.type] ?? "#64748b");
        }
      }
      if (result.seasonalEvent) {
        const seasonColors: Record<string, string> = { spring: "#22c55e", summer: "#ef4444", autumn: "#f59e0b", winter: "#3b82f6" };
        addToast(`【${result.seasonalEvent.title}】${result.seasonalEvent.description}｜${result.seasonalEvent.effects}`, seasonColors[result.seasonalEvent.season] ?? "#64748b");
      }
      if (result.rebellionEvents?.length > 0) {
        for (const r of result.rebellionEvents) {
          const text = r.flippedToNeutral
            ? `${r.cityName} 爆發叛亂，城市脫離控制！`
            : `${r.cityName} 民變！守備-${r.garrisonLost}`;
          addToast(text, "#dc2626");
          if (r.flippedToNeutral) showHeadline(`${r.cityName} 叛亂！城市失守！`, "#dc2626");
        }
      }
      if (result.dailySummary) {
        setSummaries((prev) => new Map(prev).set(result.tick, result.dailySummary));
      }
      if (result.pendingCard) {
        setPendingCard(result.pendingCard as PendingEventCard);
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

  const handleEventCardChoice = useCallback(async (choiceIndex: number) => {
    try {
      const result = await trpc.simulation.resolveEventCard.mutate({ choiceIndex });
      if (result.success) {
        addToast(result.description, "#3b82f6");
      }
    } catch {
      // silently fail
    }
    setPendingCard(null);
  }, [addToast]);

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

  const handleSave = useCallback(async (slot: number) => {
    try {
      const result = await trpc.simulation.saveGame.mutate({ slot });
      addToast(`已存檔至 Slot ${slot}（Day ${result.tick}）`, "#3b82f6");
    } catch {
      addToast("存檔失敗", "#ef4444");
    }
  }, [addToast]);

  const handleLoad = useCallback(async (slot: number) => {
    setAutoSim(false);
    autoSimRef.current = false;
    try {
      const result = await trpc.simulation.loadGame.mutate({ slot });
      setCurrentTick(result.tick);
      setViewTick(result.tick);
      setGameStatus(result.gameStatus as GameStatus);
      setAllBattles([]);
      setAllDiplomacy([]);
      setSummaries(new Map());
      addToast(`已讀取 Slot ${slot}（Day ${result.tick}）`, "#3b82f6");
    } catch {
      addToast("讀取失敗", "#ef4444");
    }
  }, [addToast]);

  // Compute timeline markers from accumulated events
  const timelineMarkers: TimelineMarker[] = useMemo(() => {
    const markers: TimelineMarker[] = [];
    for (const b of allBattles) {
      markers.push({ tick: b.tick, color: b.captured ? "#ef4444" : "#94a3b8", type: "battle" });
    }
    for (const d of allDiplomacy) {
      markers.push({ tick: d.tick, color: d.type === "alliance_formed" ? "#22c55e" : "#f59e0b", type: "diplomacy" });
    }
    return markers;
  }, [allBattles, allDiplomacy]);

  return (
    <div style={styles.root}>
      {/* Victory / Defeat screen */}
      {gameStatus !== "ongoing" && (
        <VictoryScreen status={gameStatus as "victory" | "defeat"} onRestart={handleReset} />
      )}

      {/* Tab bar + auto-sim controls */}
      <nav style={styles.tabBar}>
        <div style={styles.tabGroup}>
          <span style={{ ...styles.seasonTag, backgroundColor: SEASON_INFO[season].color }}>
            {SEASON_INFO[season].label}
          </span>
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
          <button
            style={activeTab === "stats" ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab("stats")}
          >
            勢力
          </button>
        </div>

        {/* Save/Load + Auto-simulate controls */}
        <div style={styles.autoSimBar}>
          {[1, 2, 3].map((slot) => (
            <div key={slot} style={styles.saveSlot}>
              <button style={styles.saveBtn} onClick={() => handleSave(slot)}>存{slot}</button>
              <button style={styles.loadBtn} onClick={() => handleLoad(slot)}>讀{slot}</button>
            </div>
          ))}
          <div style={styles.divider} />
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

      {/* Event headline banner */}
      {headline && (
        <div style={{
          position: "absolute",
          top: 48,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1000,
          padding: "8px 24px",
          borderRadius: 8,
          backgroundColor: headline.color,
          color: "#fff",
          fontWeight: 700,
          fontSize: 15,
          boxShadow: `0 4px 20px ${headline.color}80`,
          animation: "headline-slide-in 0.3s ease-out",
          whiteSpace: "nowrap",
        }}>
          {headline.text}
        </div>
      )}
      <style>{`
        @keyframes headline-slide-in {
          from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

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
            timelineMarkers={timelineMarkers}
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
            timelineMarkers={timelineMarkers}
          />
        ) : activeTab === "log" ? (
          <GameLog
            battles={allBattles}
            diplomacy={allDiplomacy}
            summaries={summaries}
            currentTick={currentTick}
          />
        ) : (
          <StatsPanel currentTick={currentTick} onMessage={addToast} />
        )}
      </div>

      {/* Event card modal */}
      {pendingCard && (
        <div style={styles.cardOverlay}>
          <div style={styles.cardPanel}>
            <div style={styles.cardTick}>Day {pendingCard.tick}</div>
            <h2 style={styles.cardTitle}>{pendingCard.card.title}</h2>
            <p style={styles.cardDesc}>{pendingCard.card.description}</p>
            <div style={styles.cardChoices}>
              {pendingCard.card.choices.map((choice, i) => (
                <button
                  key={i}
                  style={styles.cardChoiceBtn}
                  onClick={() => handleEventCardChoice(i)}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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
    alignItems: "center",
  },
  seasonTag: {
    fontSize: 13,
    fontWeight: 700,
    padding: "4px 10px",
    borderRadius: 6,
    color: "#0f172a",
    marginRight: 8,
    marginLeft: 12,
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
  saveSlot: {
    display: "flex",
    gap: 2,
  },
  saveBtn: {
    padding: "4px 8px",
    borderRadius: "4px 0 0 4px",
    border: "1px solid #334155",
    backgroundColor: "#1e293b",
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
  },
  loadBtn: {
    padding: "4px 8px",
    borderRadius: "0 4px 4px 0",
    border: "1px solid #334155",
    borderLeft: "none",
    backgroundColor: "#1e293b",
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: "#334155",
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
  cardOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000,
  },
  cardPanel: {
    width: 380,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 28,
    color: "#e2e8f0",
    border: "2px solid #f59e0b",
  },
  cardTick: {
    fontSize: 12,
    color: "#f59e0b",
    fontWeight: 600,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 700,
    margin: "0 0 12px",
    color: "#f59e0b",
  },
  cardDesc: {
    fontSize: 14,
    color: "#cbd5e1",
    lineHeight: 1.6,
    margin: "0 0 20px",
  },
  cardChoices: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  cardChoiceBtn: {
    padding: "10px 16px",
    borderRadius: 8,
    border: "1px solid #334155",
    backgroundColor: "#0f172a",
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "left",
  },
};
