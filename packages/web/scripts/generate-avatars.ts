/**
 * Generate enhanced SVG avatars for all characters.
 * Usage: npx tsx scripts/generate-avatars.ts
 *
 * Each avatar features:
 * - Faction-colored gradient background with per-character hue shift
 * - Background pattern based on primary trait
 * - Role icon based on highest stat
 * - Border weight scaled by total stats
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

interface CharData {
  id: string;
  name: string;
  traits: string[];
  military: number;
  intelligence: number;
  charm: number;
  skills: { leadership: number; tactics: number; commerce: number; espionage: number };
}

// Inline character data from seed to avoid import issues
const FACTION_COLORS: Record<string, string> = {
  shu: "#3b82f6",
  wei: "#ef4444",
  wu: "#22c55e",
  lu_bu: "#a855f7",
  yuan_shao: "#d4a017",
  liu_biao: "#0d9488",
  gongsun_zan: "#94a3b8",
  ma_chao: "#ea580c",
};

const FACTION_MEMBERS: Record<string, string[]> = {
  shu: ["liu_bei", "guan_yu", "zhang_fei", "zhuge_liang", "zhao_yun", "wei_yan", "jiang_wei", "fa_zheng"],
  wei: ["cao_cao", "xu_huang", "xiahou_dun", "xiahou_yuan", "dian_wei", "xun_yu", "guo_jia", "zhang_liao"],
  wu: ["sun_quan", "zhou_yu", "gan_ning", "lu_su", "huang_gai", "taishi_ci", "lv_meng"],
  lu_bu: ["lu_bu", "diao_chan"],
  yuan_shao: ["yuan_shao", "yan_liang", "wen_chou", "sima_yi", "zhang_he"],
  liu_biao: ["liu_biao", "huang_zhong", "xu_shu"],
  gongsun_zan: ["gongsun_zan", "lu_zhi", "tao_qian"],
  ma_chao: ["ma_chao"],
};

const CHARACTERS: CharData[] = [
  { id: "liu_bei", name: "劉備", traits: ["benevolent", "ambitious", "charismatic"], military: 15, intelligence: 20, charm: 92, skills: { leadership: 75, tactics: 5, commerce: 15, espionage: 5 } },
  { id: "guan_yu", name: "關羽", traits: ["loyal", "brave", "proud"], military: 95, intelligence: 25, charm: 15, skills: { leadership: 10, tactics: 55, commerce: 0, espionage: 0 } },
  { id: "zhang_fei", name: "張飛", traits: ["brave", "impulsive", "loyal"], military: 90, intelligence: 10, charm: 30, skills: { leadership: 0, tactics: 35, commerce: 0, espionage: 0 } },
  { id: "zhuge_liang", name: "諸葛亮", traits: ["wise", "cautious", "strategic"], military: 15, intelligence: 98, charm: 20, skills: { leadership: 10, tactics: 15, commerce: 30, espionage: 55 } },
  { id: "zhao_yun", name: "趙雲", traits: ["loyal", "brave", "humble"], military: 88, intelligence: 30, charm: 55, skills: { leadership: 0, tactics: 55, commerce: 0, espionage: 0 } },
  { id: "wei_yan", name: "魏延", traits: ["brave", "ambitious", "impulsive"], military: 90, intelligence: 25, charm: 10, skills: { leadership: 0, tactics: 50, commerce: 0, espionage: 0 } },
  { id: "jiang_wei", name: "姜維", traits: ["loyal", "strategic", "ambitious"], military: 82, intelligence: 78, charm: 30, skills: { leadership: 25, tactics: 50, commerce: 0, espionage: 0 } },
  { id: "fa_zheng", name: "法正", traits: ["cunning", "strategic", "ambitious"], military: 10, intelligence: 90, charm: 25, skills: { leadership: 0, tactics: 0, commerce: 30, espionage: 50 } },
  { id: "cao_cao", name: "曹操", traits: ["ambitious", "cunning", "charismatic"], military: 30, intelligence: 85, charm: 80, skills: { leadership: 60, tactics: 0, commerce: 35, espionage: 0 } },
  { id: "xu_huang", name: "徐晃", traits: ["loyal", "brave", "cautious"], military: 85, intelligence: 40, charm: 25, skills: { leadership: 0, tactics: 50, commerce: 0, espionage: 0 } },
  { id: "xiahou_dun", name: "夏侯惇", traits: ["brave", "loyal", "proud"], military: 92, intelligence: 25, charm: 30, skills: { leadership: 25, tactics: 50, commerce: 0, espionage: 0 } },
  { id: "xiahou_yuan", name: "夏侯淵", traits: ["brave", "impulsive", "ambitious"], military: 90, intelligence: 25, charm: 10, skills: { leadership: 0, tactics: 50, commerce: 0, espionage: 0 } },
  { id: "dian_wei", name: "典韋", traits: ["brave", "loyal", "impulsive"], military: 97, intelligence: 5, charm: 5, skills: { leadership: 0, tactics: 25, commerce: 0, espionage: 0 } },
  { id: "xun_yu", name: "荀彧", traits: ["wise", "loyal", "cautious"], military: 10, intelligence: 95, charm: 60, skills: { leadership: 30, tactics: 0, commerce: 55, espionage: 0 } },
  { id: "guo_jia", name: "郭嘉", traits: ["wise", "cunning", "strategic"], military: 5, intelligence: 97, charm: 40, skills: { leadership: 0, tactics: 30, commerce: 0, espionage: 55 } },
  { id: "zhang_liao", name: "張遼", traits: ["brave", "strategic", "loyal"], military: 92, intelligence: 50, charm: 30, skills: { leadership: 0, tactics: 70, commerce: 0, espionage: 0 } },
  { id: "sun_quan", name: "孫權", traits: ["cautious", "diplomatic", "ambitious"], military: 25, intelligence: 78, charm: 82, skills: { leadership: 30, tactics: 0, commerce: 55, espionage: 0 } },
  { id: "zhou_yu", name: "周瑜", traits: ["strategic", "proud", "ambitious"], military: 60, intelligence: 88, charm: 20, skills: { leadership: 0, tactics: 55, commerce: 0, espionage: 25 } },
  { id: "gan_ning", name: "甘寧", traits: ["brave", "impulsive", "charismatic"], military: 85, intelligence: 20, charm: 50, skills: { leadership: 0, tactics: 25, commerce: 20, espionage: 0 } },
  { id: "lu_su", name: "魯肅", traits: ["wise", "diplomatic", "loyal"], military: 10, intelligence: 88, charm: 75, skills: { leadership: 55, tactics: 0, commerce: 30, espionage: 0 } },
  { id: "huang_gai", name: "黃蓋", traits: ["loyal", "brave", "cunning"], military: 80, intelligence: 45, charm: 25, skills: { leadership: 0, tactics: 30, commerce: 0, espionage: 25 } },
  { id: "taishi_ci", name: "太史慈", traits: ["brave", "loyal", "proud"], military: 90, intelligence: 20, charm: 30, skills: { leadership: 0, tactics: 50, commerce: 0, espionage: 0 } },
  { id: "lv_meng", name: "呂蒙", traits: ["strategic", "cunning", "ambitious"], military: 60, intelligence: 82, charm: 25, skills: { leadership: 0, tactics: 50, commerce: 0, espionage: 25 } },
  { id: "lu_bu", name: "呂布", traits: ["brave", "treacherous", "impulsive"], military: 99, intelligence: 8, charm: 5, skills: { leadership: 5, tactics: 80, commerce: 0, espionage: 0 } },
  { id: "diao_chan", name: "貂蟬", traits: ["charismatic", "cunning", "diplomatic"], military: 5, intelligence: 75, charm: 98, skills: { leadership: 20, tactics: 0, commerce: 0, espionage: 55 } },
  { id: "yuan_shao", name: "袁紹", traits: ["ambitious", "proud", "diplomatic"], military: 25, intelligence: 55, charm: 72, skills: { leadership: 50, tactics: 0, commerce: 25, espionage: 0 } },
  { id: "yan_liang", name: "顏良", traits: ["brave", "proud", "loyal"], military: 90, intelligence: 10, charm: 20, skills: { leadership: 0, tactics: 45, commerce: 0, espionage: 0 } },
  { id: "wen_chou", name: "文醜", traits: ["brave", "impulsive", "proud"], military: 88, intelligence: 8, charm: 10, skills: { leadership: 0, tactics: 25, commerce: 0, espionage: 0 } },
  { id: "sima_yi", name: "司馬懿", traits: ["cunning", "cautious", "ambitious"], military: 20, intelligence: 98, charm: 50, skills: { leadership: 25, tactics: 0, commerce: 0, espionage: 70 } },
  { id: "zhang_he", name: "張郃", traits: ["strategic", "brave", "cautious"], military: 85, intelligence: 50, charm: 25, skills: { leadership: 25, tactics: 55, commerce: 0, espionage: 0 } },
  { id: "liu_biao", name: "劉表", traits: ["cautious", "diplomatic", "wise"], military: 10, intelligence: 72, charm: 75, skills: { leadership: 25, tactics: 0, commerce: 50, espionage: 0 } },
  { id: "huang_zhong", name: "黃忠", traits: ["brave", "loyal", "proud"], military: 96, intelligence: 10, charm: 30, skills: { leadership: 0, tactics: 65, commerce: 0, espionage: 0 } },
  { id: "xu_shu", name: "徐庶", traits: ["wise", "loyal", "humble"], military: 25, intelligence: 88, charm: 45, skills: { leadership: 0, tactics: 30, commerce: 0, espionage: 25 } },
  { id: "gongsun_zan", name: "公孫瓚", traits: ["brave", "ambitious", "proud"], military: 82, intelligence: 20, charm: 45, skills: { leadership: 45, tactics: 25, commerce: 0, espionage: 0 } },
  { id: "lu_zhi", name: "盧植", traits: ["wise", "loyal", "humble"], military: 45, intelligence: 78, charm: 55, skills: { leadership: 25, tactics: 30, commerce: 0, espionage: 0 } },
  { id: "tao_qian", name: "陶謙", traits: ["humble", "diplomatic", "cautious"], military: 10, intelligence: 50, charm: 70, skills: { leadership: 25, tactics: 0, commerce: 50, espionage: 0 } },
  { id: "ma_chao", name: "馬超", traits: ["brave", "impulsive", "ambitious"], military: 93, intelligence: 20, charm: 45, skills: { leadership: 25, tactics: 45, commerce: 0, espionage: 0 } },
  // Neutral characters
  { id: "pang_tong", name: "龐統", traits: ["wise", "strategic", "cunning"], military: 10, intelligence: 96, charm: 25, skills: { leadership: 0, tactics: 55, commerce: 25, espionage: 0 } },
  { id: "zhang_jiao", name: "張角", traits: ["charismatic", "cunning", "ambitious"], military: 20, intelligence: 75, charm: 90, skills: { leadership: 50, tactics: 0, commerce: 0, espionage: 30 } },
  { id: "hua_tuo", name: "華佗", traits: ["wise", "humble", "cautious"], military: 5, intelligence: 92, charm: 70, skills: { leadership: 0, tactics: 0, commerce: 45, espionage: 0 } },
  { id: "lu_xun", name: "陸遜", traits: ["strategic", "cautious", "wise"], military: 55, intelligence: 92, charm: 50, skills: { leadership: 45, tactics: 55, commerce: 0, espionage: 0 } },
  { id: "cao_ren", name: "曹仁", traits: ["brave", "loyal", "cautious"], military: 85, intelligence: 45, charm: 25, skills: { leadership: 45, tactics: 50, commerce: 0, espionage: 0 } },
  { id: "xu_chu", name: "許褚", traits: ["brave", "loyal", "impulsive"], military: 96, intelligence: 5, charm: 5, skills: { leadership: 0, tactics: 25, commerce: 0, espionage: 0 } },
  { id: "sun_ce", name: "孫策", traits: ["brave", "ambitious", "charismatic"], military: 88, intelligence: 50, charm: 78, skills: { leadership: 50, tactics: 30, commerce: 0, espionage: 0 } },
  { id: "meng_huo", name: "孟獲", traits: ["brave", "proud", "impulsive"], military: 82, intelligence: 8, charm: 45, skills: { leadership: 0, tactics: 25, commerce: 0, espionage: 0 } },
  { id: "zhu_rong", name: "祝融", traits: ["brave", "loyal", "impulsive"], military: 78, intelligence: 20, charm: 50, skills: { leadership: 0, tactics: 30, commerce: 0, espionage: 0 } },
  { id: "cheng_yu", name: "程昱", traits: ["cunning", "strategic", "ambitious"], military: 10, intelligence: 90, charm: 25, skills: { leadership: 0, tactics: 30, commerce: 0, espionage: 55 } },
];

function getFactionColor(charId: string): string {
  for (const [factionId, members] of Object.entries(FACTION_MEMBERS)) {
    if (members.includes(charId)) return FACTION_COLORS[factionId];
  }
  return "#6b7280"; // neutral gray
}

function getFactionId(charId: string): string {
  for (const [factionId, members] of Object.entries(FACTION_MEMBERS)) {
    if (members.includes(charId)) return factionId;
  }
  return "neutral";
}

// Parse hex color to HSL, shift hue, return new hex
function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function shiftHue(hex: string, degrees: number): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h + degrees, s, l);
}

function darken(hex: string, amount: number): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, s, Math.max(0, l - amount));
}

// Role icon based on stats
function getRoleIcon(char: CharData): string {
  if (char.military >= 80) return "⚔"; // sword
  if (char.intelligence >= 80) return "📜"; // scroll
  if (char.skills.leadership >= 50) return "👑"; // crown
  if (char.charm >= 70) return "🔱"; // seal/trident
  return "⚔";
}

// Background pattern based on primary trait
function getPattern(char: CharData): string {
  const primary = char.traits[0];
  if (["brave", "impulsive"].includes(primary)) {
    // Diagonal lines
    return `<pattern id="pat_${char.id}" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
    </pattern>`;
  }
  if (["wise", "strategic", "cautious"].includes(primary)) {
    // Waves
    return `<pattern id="pat_${char.id}" patternUnits="userSpaceOnUse" width="20" height="10">
      <path d="M0 5 Q5 0 10 5 Q15 10 20 5" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1.5"/>
    </pattern>`;
  }
  if (["cunning", "ambitious"].includes(primary)) {
    // Dots
    return `<pattern id="pat_${char.id}" patternUnits="userSpaceOnUse" width="12" height="12">
      <circle cx="6" cy="6" r="1.5" fill="rgba(255,255,255,0.08)"/>
    </pattern>`;
  }
  if (["loyal", "benevolent", "humble"].includes(primary)) {
    // Diamonds
    return `<pattern id="pat_${char.id}" patternUnits="userSpaceOnUse" width="16" height="16">
      <path d="M8 0 L16 8 L8 16 L0 8 Z" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    </pattern>`;
  }
  // Default: no pattern
  return `<pattern id="pat_${char.id}" patternUnits="userSpaceOnUse" width="1" height="1">
    <rect width="1" height="1" fill="transparent"/>
  </pattern>`;
}

function generateSVG(char: CharData, index: number): string {
  const baseColor = getFactionColor(char.id);
  const hueShift = (index % 8 - 4) * 4; // ±16° spread
  const color1 = shiftHue(baseColor, hueShift);
  const color2 = darken(color1, 15);

  const totalStats = char.military + char.intelligence + char.charm;
  const borderWidth = Math.max(2, Math.min(5, Math.round(totalStats / 60)));

  const pattern = getPattern(char);
  const icon = getRoleIcon(char);

  // Determine display name (max 2 chars for clean look, 3 for 3-char names)
  const displayName = char.name.length <= 3 ? char.name : char.name.slice(0, 2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    <radialGradient id="bg_${char.id}" cx="50%" cy="35%" r="65%">
      <stop offset="0%" stop-color="${color1}"/>
      <stop offset="100%" stop-color="${color2}"/>
    </radialGradient>
    <radialGradient id="sh_${char.id}" cx="50%" cy="50%" r="50%">
      <stop offset="70%" stop-color="transparent"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.25)"/>
    </radialGradient>
    ${pattern}
  </defs>
  <circle cx="64" cy="64" r="62" fill="url(#bg_${char.id})"/>
  <circle cx="64" cy="64" r="62" fill="url(#pat_${char.id})"/>
  <circle cx="64" cy="64" r="62" fill="url(#sh_${char.id})"/>
  <circle cx="64" cy="64" r="${63 - borderWidth / 2}" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="${borderWidth}"/>
  <text x="64" y="70" text-anchor="middle" fill="white" font-size="34" font-family="serif" font-weight="bold" opacity="0.95">${displayName}</text>
  <text x="100" y="30" text-anchor="middle" fill="white" font-size="18" opacity="0.7">${icon}</text>
</svg>`;
}

// Main
const outDir = join(import.meta.dirname ?? ".", "..", "public", "avatars");
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

let count = 0;
for (const char of CHARACTERS) {
  const factionId = getFactionId(char.id);
  const factionMembers = FACTION_MEMBERS[factionId] ?? [];
  const indexInFaction = factionMembers.indexOf(char.id);
  const svg = generateSVG(char, indexInFaction >= 0 ? indexInFaction : count);
  writeFileSync(join(outDir, `${char.id}.svg`), svg);
  count++;
}

console.log(`Generated ${count} avatar SVGs in ${outDir}`);
