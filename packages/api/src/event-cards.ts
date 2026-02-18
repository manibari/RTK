import type { CharacterNode, PlaceNode } from "@rtk/graph-db";

export interface EventCardChoice {
  label: string;
  effect: EventCardEffect;
}

export interface EventCardEffect {
  goldDelta?: number; // to a specific city or all allied
  garrisonDelta?: number;
  developmentDelta?: number;
  foodDelta?: number;
  intimacyDelta?: number;
  militaryDelta?: number;
  intelligenceDelta?: number;
  charmDelta?: number;
  moraleDelta?: number;
  loyaltyDelta?: number;
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

// Pool of event cards (20 cards across multiple themes)
const EVENT_CARD_POOL: Omit<EventCard, "id">[] = [
  // ── Original 8 (with fixes) ──
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
      { label: "善待商旅（城市開發+1）", effect: { developmentDelta: 1, scope: "one_city" } },
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
  // ── New: Diplomacy cards ──
  {
    title: "使節來訪",
    description: "敵方派來使節，表達和談意願，並帶來豐厚禮品。",
    choices: [
      { label: "收下禮品（+400金）", effect: { goldDelta: 400 } },
      { label: "以禮相待（+魅力，士氣+5）", effect: { charmDelta: 1, moraleDelta: 5 } },
    ],
  },
  {
    title: "盟友求援",
    description: "盟友城池遭受圍攻，緊急請求你派遣援軍。",
    choices: [
      { label: "出兵救援（-2守備，士氣+10）", effect: { garrisonDelta: -2, scope: "one_city", moraleDelta: 10 } },
      { label: "見死不救", effect: { moraleDelta: -5 } },
    ],
  },
  {
    title: "間諜被捕",
    description: "你的衛兵在城中抓到一名可疑人物，疑為敵方間諜。",
    choices: [
      { label: "嚴刑拷問（+智力）", effect: { intelligenceDelta: 1 } },
      { label: "禮遇釋放（+魅力，忠誠+5）", effect: { charmDelta: 1, loyaltyDelta: 5 } },
    ],
  },
  // ── New: Economy cards ──
  {
    title: "礦脈發現",
    description: "探子在山中發現了一處未開採的鐵礦。",
    choices: [
      { label: "開採鐵礦（+500金）", effect: { goldDelta: 500, scope: "one_city" } },
      { label: "建立兵工坊（+守備）", effect: { garrisonDelta: 2, scope: "one_city" } },
    ],
  },
  {
    title: "豪商獻金",
    description: "一名富商願意捐獻大量財富換取官職。",
    choices: [
      { label: "接受捐獻（+600金，忠誠-5）", effect: { goldDelta: 600, loyaltyDelta: -5 } },
      { label: "婉拒獻金（忠誠+10）", effect: { loyaltyDelta: 10 } },
    ],
  },
  {
    title: "糧倉失火",
    description: "一場大火焚毀了部分糧倉，存糧損失慘重。",
    choices: [
      { label: "緊急搶救（-200金，糧食-30）", effect: { goldDelta: -200, foodDelta: -30, scope: "one_city" } },
      { label: "開倉放糧安民（糧食-60，忠誠+10）", effect: { foodDelta: -60, scope: "one_city", loyaltyDelta: 10 } },
    ],
  },
  // ── New: Military cards ──
  {
    title: "老兵請戰",
    description: "一群退役老兵自願重新入伍，為國效力。",
    choices: [
      { label: "接納入伍（+3守備，-200金）", effect: { garrisonDelta: 3, goldDelta: -200, scope: "one_city" } },
      { label: "封賞告老（+魅力，-100金）", effect: { charmDelta: 1, goldDelta: -100 } },
    ],
  },
  {
    title: "兵器失竊",
    description: "軍械庫遭盜，大批武器不翼而飛。",
    choices: [
      { label: "徹查到底（-100金，守備不變）", effect: { goldDelta: -100 } },
      { label: "不追究（-1守備）", effect: { garrisonDelta: -1, scope: "one_city" } },
    ],
  },
  // ── New: Culture/Morale cards ──
  {
    title: "民間祭典",
    description: "百姓正準備舉辦盛大的祭典，邀請主公參加。",
    choices: [
      { label: "撥款贊助（-150金，士氣+15）", effect: { goldDelta: -150, moraleDelta: 15 } },
      { label: "御駕親臨（+魅力，忠誠+5）", effect: { charmDelta: 1, loyaltyDelta: 5 } },
    ],
  },
  {
    title: "流民湧入",
    description: "戰亂中大量流民湧入你的領地，亟需安置。",
    choices: [
      { label: "開倉安置（-200金，+糧食，忠誠+10）", effect: { goldDelta: -200, foodDelta: 50, scope: "one_city", loyaltyDelta: 10 } },
      { label: "驅趕出境（士氣-5）", effect: { moraleDelta: -5 } },
    ],
  },
  // ── New: Weather cards ──
  {
    title: "暴風雪",
    description: "突如其來的暴風雪封鎖了所有道路，補給線中斷。",
    choices: [
      { label: "開倉暖民（-300金，忠誠+10）", effect: { goldDelta: -300, scope: "all_allied", loyaltyDelta: 10 } },
      { label: "堅守不出（-1守備）", effect: { garrisonDelta: -1, scope: "all_allied" } },
    ],
  },
  {
    title: "天降甘霖",
    description: "久旱逢甘霖，農田重獲生機，百姓歡呼。",
    choices: [
      { label: "趁機屯糧（+糧食100）", effect: { foodDelta: 100, scope: "all_allied" } },
      { label: "開放慶祝（士氣+10，忠誠+5）", effect: { moraleDelta: 10, loyaltyDelta: 5 } },
    ],
  },
];

let cardCounter = 0;
// Track recently drawn cards to avoid repeats
const recentCardTitles: string[] = [];
const DEDUP_WINDOW = 5; // don't repeat within last 5 draws

export function drawEventCard(eventCardChance: number = 0.3, goldScale: number = 1.0): EventCard | null {
  if (Math.random() > eventCardChance) return null;

  // Filter out recently drawn cards
  const eligible = EVENT_CARD_POOL.filter((c) => !recentCardTitles.includes(c.title));
  const pool = eligible.length > 0 ? eligible : EVENT_CARD_POOL;

  const template = pool[Math.floor(Math.random() * pool.length)];
  cardCounter++;

  // Track for dedup
  recentCardTitles.push(template.title);
  if (recentCardTitles.length > DEDUP_WINDOW) recentCardTitles.shift();

  // Scale gold deltas by goldScale factor
  const scaledChoices = goldScale === 1.0
    ? template.choices
    : template.choices.map((c) => ({
        ...c,
        effect: {
          ...c.effect,
          ...(c.effect.goldDelta != null ? { goldDelta: Math.round(c.effect.goldDelta * goldScale) } : {}),
        },
      }));

  return {
    id: `event-${cardCounter}`,
    title: template.title,
    description: template.description,
    choices: scaledChoices,
  };
}

export interface EventCardResult {
  cityUpdates: { cityId: string; updates: Partial<PlaceNode> }[];
  charUpdate: Partial<CharacterNode> | null;
  moraleDelta: number;
  loyaltyDelta: number;
}

export function applyEventCardChoice(
  choice: EventCardChoice,
  leaderId: string,
  alliedCities: PlaceNode[],
  leaderChar: CharacterNode,
): EventCardResult {
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
    if (effect.developmentDelta) updates.development = Math.min(5, Math.max(0, city.development + effect.developmentDelta));
    if (effect.foodDelta) updates.food = Math.max(0, (city.food ?? 100) + effect.foodDelta);
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

  return {
    cityUpdates,
    charUpdate,
    moraleDelta: effect.moraleDelta ?? 0,
    loyaltyDelta: effect.loyaltyDelta ?? 0,
  };
}
