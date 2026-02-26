"use client";

import { theme } from "../lib/theme";

interface TimelinePoint {
  tick: number;
  intimacy: number;
}

interface TrendChartProps {
  data: TimelinePoint[];
  viewTick: number;
  height?: number;
}

const PADDING = { top: 10, right: 10, bottom: 24, left: 32 };

export function TrendChart({ data, viewTick, height = 140 }: TrendChartProps) {
  if (data.length < 2) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: theme.textMuted, fontSize: 12 }}>至少需要 2 天資料才能繪製趨勢圖</span>
      </div>
    );
  }

  const width = 260;
  const chartW = width - PADDING.left - PADDING.right;
  const chartH = height - PADDING.top - PADDING.bottom;

  const maxTick = Math.max(...data.map((d) => d.tick));
  const minTick = 0;
  const tickRange = maxTick - minTick || 1;

  const toX = (tick: number) => PADDING.left + ((tick - minTick) / tickRange) * chartW;
  const toY = (intimacy: number) => PADDING.top + ((100 - intimacy) / 100) * chartH;

  const polyline = data.map((d) => `${toX(d.tick)},${toY(d.intimacy)}`).join(" ");

  // Find current view point
  const viewPoint = data.find((d) => d.tick === viewTick) ?? data[data.length - 1];

  // Y-axis labels
  const yLabels = [0, 25, 50, 75, 100];

  // X-axis labels (show first, last, and a few in between)
  const xLabels: number[] = [];
  if (maxTick <= 10) {
    for (let i = 0; i <= maxTick; i += 2) xLabels.push(i);
    if (!xLabels.includes(maxTick)) xLabels.push(maxTick);
  } else {
    const step = Math.ceil(maxTick / 5);
    for (let i = 0; i <= maxTick; i += step) xLabels.push(i);
    if (!xLabels.includes(maxTick)) xLabels.push(maxTick);
  }

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {/* Grid lines */}
      {yLabels.map((v) => (
        <g key={v}>
          <line x1={PADDING.left} y1={toY(v)} x2={width - PADDING.right} y2={toY(v)} stroke={theme.bg2} strokeWidth={1} />
          <text x={PADDING.left - 4} y={toY(v) + 4} textAnchor="end" fill={theme.textMuted} fontSize={9}>
            {v}
          </text>
        </g>
      ))}

      {/* X-axis labels */}
      {xLabels.map((t) => (
        <text key={t} x={toX(t)} y={height - 4} textAnchor="middle" fill={theme.textMuted} fontSize={9}>
          {t}
        </text>
      ))}

      {/* Line */}
      <polyline points={polyline} fill="none" stroke={theme.accent} strokeWidth={2} strokeLinejoin="round" />

      {/* Data dots */}
      {data.map((d) => (
        <circle key={d.tick} cx={toX(d.tick)} cy={toY(d.intimacy)} r={2.5} fill={theme.accent} />
      ))}

      {/* View tick indicator */}
      {viewPoint && (
        <>
          <line x1={toX(viewPoint.tick)} y1={PADDING.top} x2={toX(viewPoint.tick)} y2={height - PADDING.bottom} stroke={theme.accent} strokeWidth={1} strokeDasharray="3,3" opacity={0.5} />
          <circle cx={toX(viewPoint.tick)} cy={toY(viewPoint.intimacy)} r={5} fill={theme.accent} stroke={theme.bg1} strokeWidth={2} />
          <text x={toX(viewPoint.tick)} y={toY(viewPoint.intimacy) - 10} textAnchor="middle" fill={theme.accent} fontSize={11} fontWeight="bold">
            {viewPoint.intimacy}
          </text>
        </>
      )}
    </svg>
  );
}
