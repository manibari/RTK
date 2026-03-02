import { useEffect, useCallback, useState } from "react";

type ViewTab = "graph" | "map" | "log" | "stats" | "heroes";

export interface KeyboardActions {
  onAdvanceDay: () => void;
  onSetTab: (tab: ViewTab) => void;
  onToggleAutoSim: () => void;
  onUndo?: () => void;
}

const TAB_KEYS: Record<string, ViewTab> = {
  "1": "graph",
  "2": "map",
  "3": "log",
  "4": "stats",
  "5": "heroes",
};

export function useKeyboardShortcuts(actions: KeyboardActions) {
  const [showHelp, setShowHelp] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore when typing in input fields
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      // Ctrl/Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        actions.onUndo?.();
        return;
      }

      // Space: advance day
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        actions.onAdvanceDay();
        return;
      }

      // Escape: close help overlay
      if (e.key === "Escape") {
        setShowHelp(false);
        return;
      }

      // ?: show shortcuts overlay
      if (e.key === "?") {
        setShowHelp((prev) => !prev);
        return;
      }

      // a: toggle auto-sim
      if (e.key === "a") {
        actions.onToggleAutoSim();
        return;
      }

      // 1-5: switch tabs
      const tab = TAB_KEYS[e.key];
      if (tab) {
        actions.onSetTab(tab);
        return;
      }
    },
    [actions],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return { showHelp, setShowHelp };
}
