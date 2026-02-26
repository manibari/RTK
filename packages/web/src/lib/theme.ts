// Centralized color tokens for warm ancient Chinese theme

export const theme = {
  // Background hierarchy
  bg1: "#1a1410",       // root background
  bg2: "#2a2218",       // card / panel background
  bg3: "#3d3226",       // border / divider
  bg1a: "rgba(26,20,16,0.85)",  // overlay with transparency
  bg2a: "rgba(42,34,24,0.92)",  // sidebar overlay
  bg1t: "rgba(26,20,16,0.6)",   // subtle bg (list items)

  // Text hierarchy
  textPrimary: "#e8dcc8",
  textBody: "#d4c8b0",
  textSecondary: "#b8a88a",
  textMuted: "#8b7355",

  // Semantic colors
  accent: "#d4a853",
  success: "#5d9b6b",
  danger: "#c4443a",
  info: "#4a8b8b",
  special: "#9b6b9b",
  indigo: "#5b5b8b",
  warning: "#c4843a",

  // Faction colors
  factionShu: "#5b8bb8",
  factionWei: "#c4443a",
  factionWu: "#5d9b6b",
  factionLuBu: "#9b6b9b",

  // Season colors
  seasonSpring: "#5d9b6b",
  seasonSummer: "#c4443a",
  seasonAutumn: "#d4a853",
  seasonWinter: "#4a8b8b",

  // Functional aliases
  accentDark: "#1a1410",   // text on accent bg
  btnDanger: "#c4443a",
  btnSuccess: "#5d9b6b",
} as const;

// Faction color map for components
export const FACTION_COLORS: Record<string, string> = {
  shu: theme.factionShu,
  wei: theme.factionWei,
  wu: theme.factionWu,
  lu_bu: theme.factionLuBu,
};

// Territory colors used in strategic map
export const FACTION_TERRITORY_COLORS: Record<string, string> = {
  liu_bei: theme.factionShu,
  cao_cao: theme.factionWei,
  sun_quan: theme.factionWu,
  lu_bu: theme.factionLuBu,
};

// Season info
export const SEASON_INFO: Record<string, { label: string; color: string }> = {
  spring: { label: "春", color: theme.seasonSpring },
  summer: { label: "夏", color: theme.seasonSummer },
  autumn: { label: "秋", color: theme.seasonAutumn },
  winter: { label: "冬", color: theme.seasonWinter },
};

// Relationship type colors
export const REL_COLORS = {
  friend: "#7db88a",
  rival: "#c47171",
  neutral: "#9c9c9c",
} as const;
