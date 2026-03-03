import { theme } from "../lib/theme";

interface ShortcutsHelpProps {
  onClose: () => void;
}

const SHORTCUTS = [
  { key: "Space", desc: "推進一月" },
  { key: "A", desc: "切換自動模擬" },
  { key: "1-5", desc: "切換分頁（關係圖/地圖/日誌/勢力/英雄堂）" },
  { key: "Ctrl+Z", desc: "撤銷上一步" },
  { key: "?", desc: "顯示/隱藏快捷鍵" },
  { key: "Esc", desc: "關閉此面板" },
];

export function ShortcutsHelp({ onClose }: ShortcutsHelpProps) {
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <h3 style={styles.title}>快捷鍵</h3>
        <div style={styles.list}>
          {SHORTCUTS.map((s) => (
            <div key={s.key} style={styles.row}>
              <kbd style={styles.kbd}>{s.key}</kbd>
              <span style={styles.desc}>{s.desc}</span>
            </div>
          ))}
        </div>
        <button style={styles.closeBtn} onClick={onClose}>
          關閉
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3000,
  },
  panel: {
    width: 340,
    backgroundColor: theme.bg2,
    borderRadius: 12,
    padding: 24,
    border: `2px solid ${theme.accent}`,
    color: theme.textPrimary,
  },
  title: {
    margin: "0 0 16px",
    fontSize: 18,
    fontWeight: 700,
    color: theme.accent,
    textAlign: "center",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  kbd: {
    display: "inline-block",
    minWidth: 60,
    padding: "4px 10px",
    borderRadius: 6,
    backgroundColor: theme.bg1,
    border: `1px solid ${theme.bg3}`,
    color: theme.accent,
    fontSize: 13,
    fontWeight: 700,
    fontFamily: "monospace",
    textAlign: "center",
  },
  desc: {
    fontSize: 14,
    color: theme.textBody,
  },
  closeBtn: {
    marginTop: 20,
    width: "100%",
    padding: "8px 0",
    borderRadius: 8,
    border: `1px solid ${theme.bg3}`,
    backgroundColor: theme.bg1,
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
};
