"use client";

import { useRef, useEffect, useCallback } from "react";

interface TimelineProps {
  currentTick: number;
  viewTick: number;
  onTickChange: (tick: number) => void;
  playing: boolean;
  onPlayToggle: () => void;
}

export function Timeline({ currentTick, viewTick, onTickChange, playing, onPlayToggle }: TimelineProps) {
  const disabled = currentTick === 0;

  return (
    <div style={styles.container}>
      <button
        onClick={onPlayToggle}
        disabled={disabled}
        style={{
          ...styles.playButton,
          opacity: disabled ? 0.4 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        {playing ? "||" : "\u25B6"}
      </button>
      <span style={styles.label}>Day {viewTick}</span>
      <input
        type="range"
        min={0}
        max={currentTick}
        value={viewTick}
        onChange={(e) => onTickChange(Number(e.target.value))}
        disabled={disabled}
        style={styles.slider}
      />
      <span style={styles.label}>/ {currentTick}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 0",
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    border: "1px solid #334155",
    backgroundColor: "#1e293b",
    color: "#e2e8f0",
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 13,
    color: "#94a3b8",
    minWidth: 50,
    fontVariantNumeric: "tabular-nums",
  },
  slider: {
    flex: 1,
    accentColor: "#f59e0b",
    height: 6,
  },
};
