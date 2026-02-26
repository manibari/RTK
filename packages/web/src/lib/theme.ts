// Centralized color tokens for warm ancient Chinese theme

export const theme = {
  // Background hierarchy (warm parchment-dark)
  bg1: "#352a1e",       // root background
  bg2: "#483c2e",       // card / panel background
  bg3: "#6b5a46",       // border / divider
  bg1a: "rgba(53,42,30,0.88)",  // overlay with transparency
  bg2a: "rgba(72,60,46,0.92)",  // sidebar overlay
  bg1t: "rgba(53,42,30,0.6)",   // subtle bg (list items)

  // Text hierarchy
  textPrimary: "#f0e6d6",
  textBody: "#ddd0b8",
  textSecondary: "#c4b494",
  textMuted: "#9c8868",

  // Semantic colors
  accent: "#e0b860",
  success: "#6daf7d",
  danger: "#d4554a",
  info: "#5a9f9f",
  special: "#b080b0",
  indigo: "#7070a0",
  warning: "#d49448",

  // Faction colors
  factionShu: "#6da0d0",
  factionWei: "#d45550",
  factionWu: "#6daf7d",
  factionLuBu: "#b080b0",

  // Season colors
  seasonSpring: "#6daf7d",
  seasonSummer: "#d4554a",
  seasonAutumn: "#e0b860",
  seasonWinter: "#5a9f9f",

  // Functional aliases
  accentDark: "#352a1e",   // text on accent bg
  btnDanger: "#d4554a",
  btnSuccess: "#6daf7d",
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
