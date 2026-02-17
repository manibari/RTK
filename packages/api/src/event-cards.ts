import type { CharacterNode, PlaceNode } from "@rtk/graph-db";

export interface EventCardChoice {
  label: string;
  effect: EventCardEffect;
}

export interface EventCardEffect {
  goldDelta?: number; // to a specific city or all allied
  garrisonDelta?: number;
  intimacyDelta?: number;
  militaryDelta?: number;
  intelligenceDelta?: number;
  charmDelta?: number;
  targetCharacterId?: string;
  targetCityId?: string;
  scope?: "one_city" | "all_allied";
}

export interface EventCard {
  id: string;
  title: string;
  description: string;
  choices: EventCardChoice[];
}

export interface PendingEventCard {
  card: EventCard;
  tick: number;
}

// Pool of event cards
const EVENT_CARD_POOL: Omit<EventCard, "id">[] = [
  {
    title: "豐收之年",
    description: "今年風調雨順，各地糧食大豐收。",
    choices: [
      { label: "收入國庫", effect: { goldDelta: 200, scope: "all_allied" } },
      { label: "分發百姓（+守備）", effect: { garrisonDelta: 1, scope: "all_allied" } },
    ],
  },
  {
    title: "流寇來襲",
    description: "一群流寇正在接近你的領地，威脅邊境安全。",
    choices: [
      { label: "出兵鎮壓（-100金）", effect: { goldDelta: -100, garrisonDelta: 1, scope: "all_allied" } },
      { label: "置之不理（-1守備）", effect: { garrisonDelta: -1, scope: "all_allied" } },
    ],
  },
  {
    title: "商隊途經",
    description: "一支遠方商隊途經你的領地，帶來了珍貴的貨物。",
    choices: [
      { label: "徵收關稅（+300金）", effect: { goldDelta: 300, scope: "one_city" } },
      { label: "善待商旅（城市開發+1）", effect: { scope: "one_city" } },
    ],
  },
  {
    title: "天降奇才",
    description: "一名遊歷四方的智者願意為你效力，但要求優厚的待遇。",
    choices: [
      { label: "禮賢下士（-200金，智力+1）", effect: { goldDelta: -200, intelligenceDelta: 1 } },
      { label: "婉拒好意", effect: {} },
    ],
  },
  {
    title: "軍中瘟疫",
    description: "軍營中爆發疾病，士氣低落。",
    choices: [
      { label: "花費醫治（-200金）", effect: { goldDelta: -200 } },
      { label: "忍受損失（-2守備）", effect: { garrisonDelta: -2, scope: "one_city" } },
    ],
  },
  {
    title: "山賊投誠",
    description: "一群山賊願意歸順你的勢力。",
    choices: [
      { label: "收編入伍（+2守備）", effect: { garrisonDelta: 2, scope: "one_city" } },
      { label: "遣散回鄉（+魅力）", effect: { charmDelta: 1 } },
    ],
  },
  {
    title: "古兵書出土",
    description: "部下在古墓中發現了一部失傳的兵法書。",
    choices: [
      { label: "研讀兵法（+武力）", effect: { militaryDelta: 1 } },
      { label: "獻給謀士（+智力）", effect: { intelligenceDelta: 1 } },
    ],
  },
  {
    title: "洪水氾濫",
    description: "連日暴雨導致河水氾濫，農田受損嚴重。",
    choices: [
      { label: "撥款救災（-300金）", effect: { goldDelta: -300, scope: "all_allied" } },
      { label: "徵調民力修堤（-1守備）", effect: { garrisonDelta: -1, goldDelta: 100, scope: "all_allied" } },
    ],
  },
];

let cardCounter = 0;

export function drawEventCard(): EventCard | null {
  // 30% chance per turn
  if (Math.random() > 0.3) return null;

  const template = EVENT_CARD_POOL[Math.floor(Math.random() * EVENT_CARD_POOL.length)];
  cardCounter++;
  return {
    id: `event-${cardCounter}`,
    ...template,
  };
}

export function applyEventCardChoice(
  choice: EventCardChoice,
  leaderId: string,
  alliedCities: PlaceNode[],
  leaderChar: CharacterNode,
): {
  cityUpdates: { cityId: string; updates: Partial<PlaceNode> }[];
  charUpdate: Partial<CharacterNode> | null;
} {
  const effect = choice.effect;
  const cityUpdates: { cityId: string; updates: Partial<PlaceNode> }[] = [];
  let charUpdate: Partial<CharacterNode> | null = null;

  const targetCities = effect.scope === "all_allied"
    ? alliedCities
    : effect.scope === "one_city" && alliedCities.length > 0
      ? [alliedCities[0]] // default to first/capital city
      : [];

  for (const city of targetCities) {
    const updates: Partial<PlaceNode> = {};
    if (effect.goldDelta) updates.gold = Math.max(0, city.gold + effect.goldDelta);
    if (effect.garrisonDelta) updates.garrison = Math.max(0, city.garrison + effect.garrisonDelta);
    if (Object.keys(updates).length > 0) {
      cityUpdates.push({ cityId: city.id, updates });
    }
  }

  // Character stat changes apply to faction leader
  if (effect.militaryDelta || effect.intelligenceDelta || effect.charmDelta) {
    charUpdate = {};
    if (effect.militaryDelta) charUpdate.military = Math.min(10, Math.max(0, leaderChar.military + effect.militaryDelta));
    if (effect.intelligenceDelta) charUpdate.intelligence = Math.min(10, Math.max(0, leaderChar.intelligence + effect.intelligenceDelta));
    if (effect.charmDelta) charUpdate.charm = Math.min(10, Math.max(0, leaderChar.charm + effect.charmDelta));
  }

  return { cityUpdates, charUpdate };
}
