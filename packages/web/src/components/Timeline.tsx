"use client";

import { theme } from "../lib/theme";

export interface TimelineMarker {
  tick: number;
  color: string;
  type: "battle" | "diplomacy" | "recruitment";
}

interface TimelineProps {
  currentTick: number;
  viewTick: number;
  onTickChange: (tick: number) => void;
  playing: boolean;
  onPlayToggle: () => void;
  markers?: TimelineMarker[];
}

export function Timeline({ currentTick, viewTick, onTickChange, playing, onPlayToggle, markers = [] }: TimelineProps) {
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
      <div style={styles.sliderWrap}>
        {/* Event markers */}
        {currentTick > 0 && markers.map((m, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${(m.tick / currentTick) * 100}%`,
              top: -3,
              width: 4,
              height: 4,
              borderRadius: "50%",
              backgroundColor: m.color,
              transform: "translateX(-2px)",
              pointerEvents: "none",
            }}
          />
        ))}
        <input
          type="range"
          min={0}
          max={currentTick}
          value={viewTick}
          onChange={(e) => onTickChange(Number(e.target.value))}
          disabled={disabled}
          style={styles.slider}
        />
      </div>
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
    border: `1px solid ${theme.bg3}`,
    backgroundColor: theme.bg2,
    color: theme.textPrimary,
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 13,
    color: theme.textSecondary,
    minWidth: 50,
    fontVariantNumeric: "tabular-nums",
  },
  sliderWrap: {
    flex: 1,
    position: "relative" as const,
    paddingTop: 6,
  },
  slider: {
    width: "100%",
    accentColor: theme.accent,
    height: 6,
  },
};
