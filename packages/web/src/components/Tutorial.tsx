"use client";

import { useState, useEffect, useCallback } from "react";
import { theme } from "../lib/theme";

const STORAGE_KEY = "rtk_tutorial_complete";

interface TutorialStep {
  target: string; // CSS selector
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right";
}

const STEPS: TutorialStep[] = [
  {
    target: "[data-tutorial='tab-graph']",
    title: "關係圖",
    description: "查看角色之間的親疏關係。點擊角色可檢視詳細資料。",
    position: "bottom",
  },
  {
    target: "[data-tutorial='tab-map']",
    title: "戰略地圖",
    description: "俯瞰各城池的控制權與軍隊部署。可在此發布攻擊、移動指令。",
    position: "bottom",
  },
  {
    target: "[data-tutorial='advance-btn']",
    title: "推進時間",
    description: "按下此按鈕或按 Space 鍵推進一月，執行所有待命令。",
    position: "bottom",
  },
  {
    target: "[data-tutorial='auto-sim']",
    title: "自動模擬",
    description: "開啟自動模擬讓遊戲自動推進。可調整速度。",
    position: "bottom",
  },
  {
    target: "[data-tutorial='undo-btn']",
    title: "撤銷",
    description: "後悔了嗎？Ctrl+Z 或按此按鈕可撤銷上一步。按 ? 查看所有快捷鍵。",
    position: "bottom",
  },
];

export function Tutorial() {
  const [step, setStep] = useState(-1); // -1 = not started or dismissed

  useEffect(() => {
    if (typeof window === "undefined") return;
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) setStep(0);
  }, []);

  const handleNext = useCallback(() => {
    setStep((prev) => {
      if (prev >= STEPS.length - 1) {
        localStorage.setItem(STORAGE_KEY, "true");
        return -1;
      }
      return prev + 1;
    });
  }, []);

  const handleSkip = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "true");
    setStep(-1);
  }, []);

  if (step < 0 || step >= STEPS.length) return null;

  const current = STEPS[step];

  return (
    <>
      {/* Backdrop */}
      <div style={styles.backdrop} onClick={handleSkip} />

      {/* Tooltip */}
      <div style={styles.tooltip}>
        <div style={styles.stepCount}>
          {step + 1} / {STEPS.length}
        </div>
        <h4 style={styles.title}>{current.title}</h4>
        <p style={styles.desc}>{current.description}</p>
        <div style={styles.actions}>
          <button style={styles.skipBtn} onClick={handleSkip}>
            跳過教學
          </button>
          <button style={styles.nextBtn} onClick={handleNext}>
            {step === STEPS.length - 1 ? "開始遊戲" : "下一步"}
          </button>
        </div>
      </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    zIndex: 4000,
  },
  tooltip: {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    zIndex: 4001,
    width: 360,
    padding: 24,
    backgroundColor: theme.bg2,
    borderRadius: 12,
    border: `2px solid ${theme.accent}`,
    color: theme.textPrimary,
  },
  stepCount: {
    fontSize: 12,
    color: theme.textMuted,
    fontWeight: 600,
    marginBottom: 8,
  },
  title: {
    margin: "0 0 8px",
    fontSize: 18,
    fontWeight: 700,
    color: theme.accent,
  },
  desc: {
    margin: "0 0 20px",
    fontSize: 14,
    color: theme.textBody,
    lineHeight: 1.6,
  },
  actions: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
  },
  skipBtn: {
    padding: "8px 16px",
    borderRadius: 8,
    border: `1px solid ${theme.bg3}`,
    backgroundColor: "transparent",
    color: theme.textMuted,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  nextBtn: {
    padding: "8px 20px",
    borderRadius: 8,
    border: "none",
    backgroundColor: theme.accent,
    color: theme.bg1,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
};
