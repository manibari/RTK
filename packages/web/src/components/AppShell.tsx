"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { trpc } from "../lib/trpc";
import { GraphPage } from "./GraphPage";
import { MapPage } from "./MapPage";

type ViewTab = "graph" | "map";

export function AppShell() {
  const [activeTab, setActiveTab] = useState<ViewTab>("graph");
  const [currentTick, setCurrentTick] = useState(0);
  const [viewTick, setViewTick] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch initial tick
  useEffect(() => {
    trpc.simulation.getCurrentTick.query().then((data) => {
      setCurrentTick(data.tick);
      setViewTick(data.tick);
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
    setAdvancing(true);
    try {
      const result = await trpc.simulation.advanceDay.mutate();
      setCurrentTick(result.tick);
      setViewTick(result.tick);
      return result;
    } finally {
      setAdvancing(false);
    }
  }, []);

  return (
    <div style={styles.root}>
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
            advancing={advancing}
            onAdvanceDay={handleAdvanceDay}
            onTickUpdate={(tick) => { setCurrentTick(tick); setViewTick(tick); }}
          />
        ) : (
          <MapPage
            currentTick={currentTick}
            viewTick={viewTick}
            onTickChange={setViewTick}
            playing={playing}
            onPlayToggle={handlePlayToggle}
            advancing={advancing}
            onAdvanceDay={handleAdvanceDay}
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
  content: {
    flex: 1,
    minHeight: 0,
    display: "flex",
  },
};
