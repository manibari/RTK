import { Engine } from "@rtk/simulation";
import type { IGraphRepository, RelationshipEdge, CharacterGraph, CharacterNode, PlaceNode, SpyMission, SpyMissionType, CharacterSkills, CharacterRole, DistrictType, District, UnitType, UnitComposition } from "@rtk/graph-db";
import type { IEventStore, StoredEvent } from "./event-store/types.js";
import { NarrativeService } from "./narrative/narrative-service.js";
import { evaluateNPCDecisions } from "./ai/npc-ai.js";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { drawEventCard, applyEventCardChoice, type EventCard, type PendingEventCard } from "./event-cards.js";

export interface TimelinePoint {
  tick: number;
  intimacy: number;
}

export interface BetrayalEvent {
  tick: number;
  characterId: string;
  characterName: string;
  oldFaction: string;
  newFaction: string;
}

export interface DeathEvent {
  tick: number;
  characterId: string;
  characterName: string;
  cause: "battle" | "captured" | "old_age";
  factionId: string;
  wasLeader: boolean;
  successorId?: string;
  successorName?: string;
}

export interface TradeRoute {
  id: string;
  cityA: string;
  cityB: string;
  factionId: string;
  establishedTick: number;
}

export type BattleTactic = "aggressive" | "defensive" | "balanced";

const TACTIC_MODIFIERS: Record<BattleTactic, { attack: number; defense: number }> = {
  aggressive: { attack: 0.3, defense: -0.15 },
  defensive: { attack: -0.15, defense: 0.3 },
  balanced: { attack: 0, defense: 0 },
};

// ── Unit counter system ──
const DEFAULT_UNITS: UnitComposition = { infantry: 1, cavalry: 0, archers: 0 };
const UNIT_TRAIN_COST: Record<UnitType, number> = { infantry: 80, cavalry: 150, archers: 120 };

function getUnitComposition(city: PlaceNode): UnitComposition {
  return city.units ?? { ...DEFAULT_UNITS };
}

// Rock-paper-scissors: cavalry > infantry > archers > cavalry
function computeUnitModifier(attackUnits: UnitComposition, defendUnits: UnitComposition): { attackMod: number; defenseMod: number } {
  const aTotal = attackUnits.infantry + attackUnits.cavalry + attackUnits.archers || 1;
  const dTotal = defendUnits.infantry + defendUnits.cavalry + defendUnits.archers || 1;

  // Weighted advantage ratios
  const aAdvantage =
    (attackUnits.cavalry / aTotal) * (defendUnits.infantry / dTotal) * 0.2 +
    (attackUnits.infantry / aTotal) * (defendUnits.archers / dTotal) * 0.2 +
    (attackUnits.archers / aTotal) * (defendUnits.cavalry / dTotal) * 0.2;

  const dAdvantage =
    (defendUnits.cavalry / dTotal) * (attackUnits.infantry / aTotal) * 0.2 +
    (defendUnits.infantry / dTotal) * (attackUnits.archers / aTotal) * 0.2 +
    (defendUnits.archers / dTotal) * (attackUnits.cavalry / aTotal) * 0.2;

  return { attackMod: aAdvantage - dAdvantage, defenseMod: dAdvantage - aAdvantage };
}

export interface AdvanceDayResult {
  tick: number;
  season: Season;
  events: StoredEvent[];
  dailySummary: string;
  battleResults: BattleResult[];
  diplomacyEvents: DiplomacyEvent[];
  recruitmentResults: RecruitmentResult[];
  betrayalEvents: BetrayalEvent[];
  spyReports: SpyReport[];
  deathEvents: DeathEvent[];
  worldEvents: WorldEvent[];
  seasonalEvent: SeasonalEvent | null;
  pendingCard: PendingEventCard | null;
  gameStatus: GameStatus;
}

export interface DiplomacyEvent {
  tick: number;
  type: "alliance_formed" | "alliance_broken" | "betrayal" | "demand_accepted" | "demand_rejected";
  factionA: string;
  factionB: string;
  description: string;
}

// ── World Events ──
export type WorldEventType = "plague" | "drought" | "bandits";

export interface WorldEvent {
  tick: number;
  type: WorldEventType;
  cityId: string;
  cityName: string;
  description: string;
}

const WORLD_EVENT_LABELS: Record<WorldEventType, string> = {
  plague: "瘟疫",
  drought: "旱災",
  bandits: "盜匪",
};

// ── Seasonal major events ──
export interface SeasonalEvent {
  tick: number;
  season: Season;
  title: string;
  description: string;
  effects: string;
}

export type GameStatus = "ongoing" | "victory" | "defeat";

// Season system: every 4 ticks = 1 season
export type Season = "spring" | "summer" | "autumn" | "winter";

export function getSeason(tick: number): Season {
  const phase = Math.floor(tick / 4) % 4;
  return (["spring", "summer", "autumn", "winter"] as const)[phase];
}

export const SEASON_LABELS: Record<Season, string> = {
  spring: "春",
  summer: "夏",
  autumn: "秋",
  winter: "冬",
};

const SEASON_GOLD_MULTIPLIER: Record<Season, number> = {
  spring: 1.0,
  summer: 1.0,
  autumn: 1.2,
  winter: 0.8,
};

const SEASON_DEFENSE_BONUS: Record<Season, number> = {
  spring: 0,
  summer: 0,
  autumn: 0,
  winter: 1,
};

const SEASON_TRAVEL_PENALTY: Record<Season, number> = {
  spring: 0,
  summer: 0,
  autumn: 0,
  winter: 1,
};

export type WinType = "conquest" | "diplomacy" | "economy";

export interface GameState {
  status: GameStatus;
  winnerFaction?: string;
  winType?: WinType;
  tick: number;
}

export interface PlayerCommand {
  type: "move" | "attack" | "recruit" | "reinforce" | "develop" | "build_improvement" | "spy" | "sabotage" | "hire_neutral" | "assign_role" | "start_research" | "establish_trade" | "build_district" | "assign_mentor" | "build_siege" | "demand" | "sow_discord" | "train_unit";
  characterId: string;
  targetCityId: string;
  targetCharacterId?: string; // for recruit / hire_neutral / assign_mentor (apprentice)
  role?: CharacterRole; // for assign_role
  techId?: string; // for start_research
  tactic?: BattleTactic; // for attack
  tradeCityId?: string; // for establish_trade (second city)
  districtType?: DistrictType; // for build_district
  demandType?: "tribute" | "withdraw"; // for demand
  demandAmount?: number; // for tribute demand (gold amount)
  targetFactionId?: string; // for sow_discord
  unitType?: UnitType; // for train_unit
}

// ── District system ──
const DISTRICT_COST = 400;
const MAX_DISTRICTS = 2;
const DISTRICT_LABELS: Record<DistrictType, string> = {
  defense: "防禦區",
  commerce: "商業區",
  agriculture: "農業區",
  recruitment: "招募區",
};

// ── Mentor system ──
export interface MentorPair {
  mentorId: string;
  apprenticeId: string;
  factionId: string;
  startTick: number;
}

// ── Technology system ──
export interface Technology {
  id: string;
  name: string;
  description: string;
  cost: number;
  turns: number;
}

export const TECHNOLOGIES: Technology[] = [
  { id: "iron_working", name: "鍛鐵術", description: "鍛冶場效果+50%", cost: 500, turns: 5 },
  { id: "archery", name: "弓術", description: "全員智力+1", cost: 400, turns: 4 },
  { id: "logistics", name: "兵站學", description: "移動速度+1", cost: 600, turns: 6 },
  { id: "spy_network", name: "諜報網", description: "諜報成功率+20%", cost: 450, turns: 4 },
  { id: "divine_strategy", name: "神算", description: "全員戰術+1", cost: 700, turns: 8 },
];

export interface FactionResearch {
  techId: string;
  startTick: number;
}

export interface FactionTechState {
  completed: string[];
  current: FactionResearch | null;
}

// Neutral characters — IDs not in any faction
const NEUTRAL_IDS = ["xu_shu", "pang_tong", "huang_zhong", "ma_chao", "gan_ning", "xu_huang"];

// Role bonuses
const ROLE_LABELS: Record<CharacterRole, string> = {
  general: "將軍",
  governor: "太守",
  diplomat: "外交官",
  spymaster: "間諜頭子",
};

export interface SpyReport {
  tick: number;
  characterId: string;
  characterName: string;
  targetCityId: string;
  targetCityName: string;
  missionType: SpyMissionType;
  success: boolean;
  caught: boolean;
  intel?: { gold: number; garrison: number; controllerId?: string };
  sabotageEffect?: string;
}

// Specialty effects lookup
const SPECIALTY_LABELS: Record<string, string> = {
  military_academy: "軍校",
  forge: "鍛冶場",
  harbor: "港口",
  library: "書院",
  market: "市場",
  granary: "穀倉",
};

const SPECIALTY_IMPROVEMENT: Record<string, string> = {
  military_academy: "精銳營",
  forge: "名匠坊",
  harbor: "大港",
  library: "大學",
  market: "商會",
  granary: "大穀倉",
};

export interface BattleRound {
  phase: string;
  attackerDelta: number;
  defenderDelta: number;
  note?: string;
}

export interface BattleResult {
  tick: number;
  cityId: string;
  cityName: string;
  attackerId: string;
  attackerName: string;
  defenderId: string | null;
  defenderName: string | null;
  winner: "attacker" | "defender";
  captured: boolean;
  attackPower: number;
  defensePower: number;
  tactic?: BattleTactic;
  rounds?: BattleRound[];
}

export interface RecruitmentResult {
  tick: number;
  recruiterId: string;
  recruiterName: string;
  targetId: string;
  targetName: string;
  success: boolean;
  newFaction?: string;
}

export interface FactionInfo {
  id: string;
  leaderId: string;
  leaderName: string;
  members: string[];
  cities: string[];
  color: string;
}

// Faction definitions (mutable - recruitment can change members)
function createDefaultFactions(): { id: string; leaderId: string; members: string[]; color: string }[] {
  return [
    { id: "shu", leaderId: "liu_bei", members: ["liu_bei", "guan_yu", "zhang_fei", "zhuge_liang", "zhao_yun"], color: "#3b82f6" },
    { id: "wei", leaderId: "cao_cao", members: ["cao_cao"], color: "#ef4444" },
    { id: "wu", leaderId: "sun_quan", members: ["sun_quan", "zhou_yu"], color: "#22c55e" },
    { id: "lu_bu", leaderId: "lu_bu", members: ["lu_bu", "diao_chan"], color: "#a855f7" },
  ];
}

let FACTIONS = createDefaultFactions();

// Trait -> stat mapping for combat ratings
const TRAIT_STATS: Record<string, { military: number; intelligence: number; charm: number }> = {
  brave: { military: 2, intelligence: 0, charm: 0 },
  impulsive: { military: 1, intelligence: -1, charm: 0 },
  loyal: { military: 1, intelligence: 1, charm: 1 },
  wise: { military: 0, intelligence: 2, charm: 0 },
  strategic: { military: 1, intelligence: 2, charm: 0 },
  cautious: { military: 0, intelligence: 1, charm: 0 },
  ambitious: { military: 1, intelligence: 1, charm: 1 },
  charismatic: { military: 0, intelligence: 0, charm: 2 },
  diplomatic: { military: 0, intelligence: 1, charm: 2 },
  cunning: { military: 0, intelligence: 2, charm: 1 },
  benevolent: { military: 0, intelligence: 0, charm: 2 },
  proud: { military: 1, intelligence: 0, charm: -1 },
  humble: { military: 0, intelligence: 0, charm: 1 },
  treacherous: { military: 1, intelligence: 1, charm: -1 },
};

export function getCombatRating(traits: string[]): { military: number; intelligence: number; charm: number } {
  let military = 0, intelligence = 0, charm = 0;
  for (const t of traits) {
    const s = TRAIT_STATS[t];
    if (s) { military += s.military; intelligence += s.intelligence; charm += s.charm; }
  }
  return { military: Math.max(0, military), intelligence: Math.max(0, intelligence), charm: Math.max(0, charm) };
}

export interface FactionHistoryEntry {
  tick: number;
  power: number;
  cities: number;
  gold: number;
  characters: number;
  morale?: number;
}

// ── Morale system ──
const MORALE_INITIAL = 70;
const MORALE_MIN = 0;
const MORALE_MAX = 100;

function clampMorale(v: number): number {
  return Math.max(MORALE_MIN, Math.min(MORALE_MAX, Math.round(v)));
}

// ── Prestige achievements ──
export interface CharacterAchievement {
  id: string;
  label: string;
  description: string;
}

const ACHIEVEMENTS: CharacterAchievement[] = [
  { id: "veteran", label: "百戰老將", description: "參與 5 場戰鬥" },
  { id: "conqueror", label: "攻城略地", description: "攻陷 3 座城" },
  { id: "spymaster_ace", label: "暗影之手", description: "完成 3 次諜報" },
  { id: "diplomat_star", label: "縱橫家", description: "促成 2 次結盟" },
];

const DEFAULT_SKILLS: CharacterSkills = { leadership: 0, tactics: 0, commerce: 0, espionage: 0 };

function getSkills(char: CharacterNode): CharacterSkills {
  return char.skills ?? { ...DEFAULT_SKILLS };
}

function gainSkill(char: CharacterNode, skill: keyof CharacterSkills, amount: number = 1): CharacterSkills {
  const skills = getSkills(char);
  skills[skill] = Math.min(5, skills[skill] + amount);
  return skills;
}

export class SimulationService {
  private engine: Engine;
  private repo: IGraphRepository;
  private eventStore: IEventStore;
  private narrative: NarrativeService | null = null;
  private initialRelationships: RelationshipEdge[] = [];
  private dailySummaries = new Map<number, string>();
  private commandQueue: PlayerCommand[] = [];
  private alliances = new Set<string>(); // "factionA:factionB" sorted
  private gameState: GameState = { status: "ongoing", tick: 0 };
  private factionHistory = new Map<string, FactionHistoryEntry[]>();
  private pendingCard: PendingEventCard | null = null;
  private spyMissions: SpyMission[] = [];
  private spyCounter = 0;
  private factionTech = new Map<string, FactionTechState>();
  private tradeRoutes: TradeRoute[] = [];
  private tradeCounter = 0;
  private deadCharacters = new Set<string>();
  private pendingTactics = new Map<string, BattleTactic>(); // characterId -> tactic for next battle
  private factionMorale = new Map<string, number>(); // factionId -> morale (0-100)
  private characterPrestige = new Map<string, number>(); // characterId -> prestige score
  private characterBattleCount = new Map<string, number>(); // for achievements
  private characterConquerCount = new Map<string, number>();
  private characterSpyCount = new Map<string, number>();
  private characterDiploCount = new Map<string, number>();
  private characterAchievements = new Map<string, string[]>(); // characterId -> achievement ids
  private legacyBonuses = new Map<string, number>(); // factionId -> cumulative legacy bonus from dead prestigious chars
  private characterFavorability = new Map<string, number>(); // characterId -> favorability toward leader (0-100)
  private mentorPairs: MentorPair[] = [];
  private warExhaustion = new Map<string, number>(); // factionId -> 0-100
  private droughtCities = new Map<string, number>(); // cityId -> drought expires at tick
  private factionTrust = new Map<string, number>(); // "fA:fB" sorted key -> trust 0-100
  private diplomaticVictoryTicks = 0; // consecutive ticks with all surviving factions allied
  private economicVictoryTicks = 0;  // consecutive ticks with >80% total gold

  constructor(repo: IGraphRepository, eventStore: IEventStore) {
    this.engine = new Engine();
    this.repo = repo;
    this.eventStore = eventStore;
  }

  async reset(): Promise<void> {
    // Clear event store
    this.eventStore.clear();

    // Reset repo by disconnecting and reconnecting
    await this.repo.disconnect();
    await this.repo.connect();

    // Re-seed data
    const { seedData } = await import("@rtk/graph-db");
    await seedData(this.repo);

    // Reset internal state
    this.engine = new Engine();
    this.initialRelationships = [];
    this.dailySummaries.clear();
    this.commandQueue = [];
    this.alliances.clear();
    this.gameState = { status: "ongoing", tick: 0 };
    this.commandedThisTick.clear();
    this.factionHistory.clear();
    this.spyMissions = [];
    this.spyCounter = 0;
    this.factionTech.clear();
    this.tradeRoutes = [];
    this.tradeCounter = 0;
    this.deadCharacters.clear();
    this.pendingTactics.clear();
    this.factionMorale.clear();
    this.characterPrestige.clear();
    this.characterBattleCount.clear();
    this.characterConquerCount.clear();
    this.characterSpyCount.clear();
    this.characterDiploCount.clear();
    this.characterAchievements.clear();
    this.legacyBonuses.clear();
    this.characterFavorability.clear();
    this.mentorPairs = [];
    this.warExhaustion.clear();
    this.droughtCities.clear();
    this.factionTrust.clear();
    this.diplomaticVictoryTicks = 0;
    this.economicVictoryTicks = 0;
    FACTIONS = createDefaultFactions();

    // Re-initialize
    await this.init();
  }

  async init(): Promise<void> {
    const characters = await this.repo.getAllCharacters();
    this.engine.loadCharacters(characters);

    const characterMap = new Map(characters.map((c) => [c.id, c]));
    this.narrative = new NarrativeService(characterMap);

    const seenPairs = new Set<string>();
    for (const c of characters) {
      const rels = await this.repo.getRelationshipsOf(c.id);
      for (const r of rels) {
        const key = [r.sourceId, r.targetId].sort().join(":");
        if (seenPairs.has(key)) continue;
        seenPairs.add(key);
        this.engine.loadRelationships([r]);
        this.initialRelationships.push({ ...r });
      }
    }
  }

  get currentTick(): number {
    return this.engine.world.tick;
  }

  get currentSeason(): Season {
    return getSeason(this.currentTick);
  }

  // Player command API
  queueCommand(cmd: PlayerCommand): void {
    this.commandQueue.push(cmd);
  }

  getCommandQueue(): PlayerCommand[] {
    return [...this.commandQueue];
  }

  clearCommandQueue(): void {
    this.commandQueue = [];
  }

  // Faction queries
  async getFactions(): Promise<FactionInfo[]> {
    const characters = await this.repo.getAllCharacters();
    const cities = await this.repo.getAllPlaces();
    const charMap = new Map(characters.map((c) => [c.id, c]));

    return FACTIONS.map((f) => {
      const leader = charMap.get(f.leaderId);
      const controlledCities = cities
        .filter((city) => {
          if (!city.controllerId) return false;
          return f.members.includes(city.controllerId);
        })
        .map((c) => c.id);

      return {
        id: f.id,
        leaderId: f.leaderId,
        leaderName: leader?.name ?? f.leaderId,
        members: f.members,
        cities: controlledCities,
        color: f.color,
      };
    });
  }

  getFactionOf(characterId: string): string | null {
    for (const f of FACTIONS) {
      if (f.members.includes(characterId)) return f.id;
    }
    return null;
  }

  getGameState(): GameState {
    return { ...this.gameState };
  }

  getAlliances(): string[][] {
    return [...this.alliances].map((a) => a.split(":"));
  }

  // ── Neutral character helpers ──
  isNeutral(characterId: string): boolean {
    return !FACTIONS.some((f) => f.members.includes(characterId));
  }

  // ── Technology helpers ──
  private getFactionTech(factionId: string): FactionTechState {
    if (!this.factionTech.has(factionId)) {
      this.factionTech.set(factionId, { completed: [], current: null });
    }
    return this.factionTech.get(factionId)!;
  }

  hasTech(factionId: string, techId: string): boolean {
    return this.getFactionTech(factionId).completed.includes(techId);
  }

  getFactionTechs(): Record<string, FactionTechState> {
    const result: Record<string, FactionTechState> = {};
    for (const f of FACTIONS) {
      result[f.id] = this.getFactionTech(f.id);
    }
    return result;
  }

  // ── Role bonus helpers ──
  private roleAttackBonus(char: CharacterNode): number {
    return char.role === "general" ? 0.2 : 0;
  }

  private roleGoldBonus(chars: CharacterNode[]): number {
    const governor = chars.find((c) => c.role === "governor");
    return governor ? 0.2 : 0;
  }

  private roleSpyBonus(char: CharacterNode): number {
    return char.role === "spymaster" ? 0.2 : 0;
  }

  getTradeRoutes(): TradeRoute[] {
    return [...this.tradeRoutes];
  }

  getDeadCharacters(): string[] {
    return [...this.deadCharacters];
  }

  private removeCharacter(charId: string, factionId: string): void {
    this.deadCharacters.add(charId);
    const faction = FACTIONS.find((f) => f.id === factionId);
    if (!faction) return;
    faction.members = faction.members.filter((m) => m !== charId);

    // If leader died, succession to highest military member
    if (faction.leaderId === charId) {
      const remaining = faction.members.filter((m) => m !== charId);
      if (remaining.length === 0) return;
      // Will be resolved asynchronously — set sync for now
      faction.leaderId = remaining[0]; // placeholder, actual pick done in processDeaths
    }
  }

  private tradeRoutesForCity(cityId: string): TradeRoute[] {
    return this.tradeRoutes.filter((r) => r.cityA === cityId || r.cityB === cityId);
  }

  // ── Morale API ──
  getMorale(factionId: string): number {
    return this.factionMorale.get(factionId) ?? MORALE_INITIAL;
  }

  getAllMorale(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const f of FACTIONS) {
      result[f.id] = this.getMorale(f.id);
    }
    return result;
  }

  private adjustMorale(factionId: string, delta: number): void {
    const current = this.getMorale(factionId);
    this.factionMorale.set(factionId, clampMorale(current + delta));
  }

  private applyMoraleFromBattles(battleResults: BattleResult[]): void {
    for (const b of battleResults) {
      const attackerFaction = this.getFactionOf(b.attackerId);
      const defenderFaction = b.defenderId ? this.getFactionOf(b.defenderId) : null;

      if (b.winner === "attacker") {
        if (attackerFaction) this.adjustMorale(attackerFaction, b.captured ? 8 : 3);
        if (defenderFaction) this.adjustMorale(defenderFaction, b.captured ? -10 : -3);
      } else {
        if (defenderFaction) this.adjustMorale(defenderFaction, 5);
        if (attackerFaction) this.adjustMorale(attackerFaction, -5);
      }
    }
  }

  private applyMoraleFromDeaths(deathEvents: DeathEvent[]): void {
    for (const d of deathEvents) {
      this.adjustMorale(d.factionId, d.wasLeader ? -15 : -5);
    }
  }

  private applyMoraleFromDiplomacy(diplomacyEvents: DiplomacyEvent[]): void {
    for (const d of diplomacyEvents) {
      if (d.type === "alliance_formed") {
        this.adjustMorale(d.factionA, 5);
        this.adjustMorale(d.factionB, 5);
      } else if (d.type === "alliance_broken") {
        this.adjustMorale(d.factionA, -3);
        this.adjustMorale(d.factionB, -3);
      }
    }
  }

  private applyMoraleFromBetrayals(betrayalEvents: BetrayalEvent[]): void {
    for (const b of betrayalEvents) {
      this.adjustMorale(b.oldFaction, -8);
      this.adjustMorale(b.newFaction, 3);
    }
  }

  // Passive morale drift: slowly moves toward 50
  private moraleDrift(): void {
    for (const f of FACTIONS) {
      const current = this.getMorale(f.id);
      if (current > 55) this.adjustMorale(f.id, -1);
      else if (current < 45) this.adjustMorale(f.id, 1);
    }
  }

  // ── Prestige API ──
  getPrestige(characterId: string): number {
    return this.characterPrestige.get(characterId) ?? 0;
  }

  getAllPrestige(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [id, val] of this.characterPrestige) {
      result[id] = val;
    }
    return result;
  }

  getAchievements(characterId: string): string[] {
    return this.characterAchievements.get(characterId) ?? [];
  }

  getLegacyBonus(factionId: string): number {
    return this.legacyBonuses.get(factionId) ?? 0;
  }

  private addPrestige(charId: string, amount: number): void {
    const current = this.characterPrestige.get(charId) ?? 0;
    this.characterPrestige.set(charId, current + amount);
  }

  private trackBattle(charId: string): void {
    const count = (this.characterBattleCount.get(charId) ?? 0) + 1;
    this.characterBattleCount.set(charId, count);
    if (count >= 5) this.grantAchievement(charId, "veteran");
  }

  private trackConquer(charId: string): void {
    const count = (this.characterConquerCount.get(charId) ?? 0) + 1;
    this.characterConquerCount.set(charId, count);
    if (count >= 3) this.grantAchievement(charId, "conqueror");
  }

  private trackSpy(charId: string): void {
    const count = (this.characterSpyCount.get(charId) ?? 0) + 1;
    this.characterSpyCount.set(charId, count);
    if (count >= 3) this.grantAchievement(charId, "spymaster_ace");
  }

  private trackDiplomacy(charId: string): void {
    const count = (this.characterDiploCount.get(charId) ?? 0) + 1;
    this.characterDiploCount.set(charId, count);
    if (count >= 2) this.grantAchievement(charId, "diplomat_star");
  }

  private grantAchievement(charId: string, achievementId: string): void {
    const existing = this.characterAchievements.get(charId) ?? [];
    if (existing.includes(achievementId)) return;
    existing.push(achievementId);
    this.characterAchievements.set(charId, existing);
    this.addPrestige(charId, 10); // achievement grants prestige
  }

  private updatePrestigeFromBattles(battleResults: BattleResult[]): void {
    for (const b of battleResults) {
      this.trackBattle(b.attackerId);
      if (b.defenderId) this.trackBattle(b.defenderId);
      if (b.winner === "attacker") {
        this.addPrestige(b.attackerId, b.captured ? 5 : 2);
        if (b.captured) this.trackConquer(b.attackerId);
      } else if (b.defenderId) {
        this.addPrestige(b.defenderId, 3);
      }
    }
  }

  private updatePrestigeFromSpyReports(spyReports: SpyReport[]): void {
    for (const s of spyReports) {
      if (s.success) {
        this.addPrestige(s.characterId, 2);
        this.trackSpy(s.characterId);
      }
    }
  }

  private applyDeathLegacy(deathEvents: DeathEvent[]): void {
    for (const d of deathEvents) {
      const prestige = this.getPrestige(d.characterId);
      if (prestige >= 10) {
        // Legacy bonus: 1 point per 10 prestige, added to faction
        const bonus = Math.floor(prestige / 10);
        const current = this.legacyBonuses.get(d.factionId) ?? 0;
        this.legacyBonuses.set(d.factionId, current + bonus);
      }
    }
  }

  // ── Supply line system ──
  // Cities are "supplied" if connected to faction capital via trade routes or same city
  async computeSupplyStatus(): Promise<Record<string, boolean>> {
    const cities = await this.repo.getAllPlaces();
    const result: Record<string, boolean> = {};

    for (const f of FACTIONS) {
      // Find capital city (city where leader is stationed)
      const leaderChar = (await this.repo.getAllCharacters()).find((c) => c.id === f.leaderId);
      const capitalCityId = leaderChar?.cityId;
      const factionCityIds = new Set(
        cities
          .filter((c) => c.controllerId && f.members.includes(c.controllerId) && !c.siegedBy)
          .map((c) => c.id),
      );

      if (!capitalCityId || !factionCityIds.has(capitalCityId)) {
        // No capital — all cities unsupplied
        for (const cid of factionCityIds) result[cid] = false;
        continue;
      }

      // BFS from capital through trade routes within faction
      const supplied = new Set<string>([capitalCityId]);
      const queue = [capitalCityId];
      while (queue.length > 0) {
        const current = queue.shift()!;
        for (const route of this.tradeRoutes) {
          if (route.factionId !== f.id) continue;
          let neighbor: string | null = null;
          if (route.cityA === current && factionCityIds.has(route.cityB)) neighbor = route.cityB;
          if (route.cityB === current && factionCityIds.has(route.cityA)) neighbor = route.cityA;
          if (neighbor && !supplied.has(neighbor)) {
            supplied.add(neighbor);
            queue.push(neighbor);
          }
        }
      }

      for (const cid of factionCityIds) {
        result[cid] = supplied.has(cid);
      }
    }

    return result;
  }

  private async applySupplyEffects(): Promise<void> {
    const supplyStatus = await this.computeSupplyStatus();
    const cities = await this.repo.getAllPlaces();

    for (const city of cities) {
      if (supplyStatus[city.id] === false && city.controllerId) {
        // Unsupplied: garrison decays every 3 ticks
        if (this.currentTick % 3 === 0 && city.garrison > 0) {
          await this.repo.createPlace({ ...city, garrison: Math.max(0, city.garrison - 1) });
        }
      }
    }
  }

  // ── Favorability API ──
  getFavorability(charId: string): number {
    return this.characterFavorability.get(charId) ?? 60; // default 60
  }

  getAllFavorability(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [id, val] of this.characterFavorability) {
      result[id] = val;
    }
    return result;
  }

  private adjustFavorability(charId: string, delta: number): void {
    const current = this.getFavorability(charId);
    this.characterFavorability.set(charId, Math.max(0, Math.min(100, Math.round(current + delta))));
  }

  private async updateFavorability(battleResults: BattleResult[], betrayalEvents: BetrayalEvent[]): Promise<void> {
    const rels = this.engine.getRelationships();
    for (const faction of FACTIONS) {
      for (const memberId of faction.members) {
        if (memberId === faction.leaderId) continue;

        // Intimacy with leader boosts favorability
        const rel = rels.find(
          (r) => (r.sourceId === memberId && r.targetId === faction.leaderId) ||
                 (r.sourceId === faction.leaderId && r.targetId === memberId),
        );
        const intimacy = rel?.intimacy ?? 50;
        if (intimacy >= 70) this.adjustFavorability(memberId, 1);
        else if (intimacy <= 30) this.adjustFavorability(memberId, -1);

        // Battle participation boosts favorability
        for (const b of battleResults) {
          if (b.attackerId === memberId || b.defenderId === memberId) {
            this.adjustFavorability(memberId, b.winner === "attacker" && b.attackerId === memberId ? 3 : 1);
          }
        }

        // Faction morale affects favorability
        const morale = this.getMorale(faction.id);
        if (morale < 30) this.adjustFavorability(memberId, -1);
        else if (morale >= 80) this.adjustFavorability(memberId, 1);
      }
    }
  }

  // ── Mentor API ──
  getMentorPairs(): MentorPair[] {
    return [...this.mentorPairs];
  }

  private async processMentorship(): Promise<void> {
    if (this.currentTick % 5 !== 0) return; // every 5 ticks
    const allChars = await this.repo.getAllCharacters();
    const charMap = new Map(allChars.map((c) => [c.id, c]));

    for (const pair of this.mentorPairs) {
      const mentor = charMap.get(pair.mentorId);
      const apprentice = charMap.get(pair.apprenticeId);
      if (!mentor || !apprentice) continue;
      if (this.deadCharacters.has(pair.mentorId) || this.deadCharacters.has(pair.apprenticeId)) continue;

      // Find mentor's highest skill
      const mentorSkills = getSkills(mentor);
      const skillEntries = Object.entries(mentorSkills) as [keyof CharacterSkills, number][];
      const best = skillEntries.reduce((a, b) => b[1] > a[1] ? b : a);
      if (best[1] <= 0) continue;

      // Transfer: apprentice gains +1 to that skill (capped at mentor's level)
      const apprenticeSkills = getSkills(apprentice);
      if (apprenticeSkills[best[0]] >= best[1]) continue; // already at mentor level
      const newSkills = gainSkill(apprentice, best[0]);
      await this.repo.createCharacter({ ...apprentice, skills: newSkills });

      // Mentor gains prestige
      this.addPrestige(pair.mentorId, 1);
    }
  }

  // ── Aging ──
  getAge(charId: string, bornTick?: number): number {
    if (bornTick == null) return 30; // default age
    return Math.floor((this.currentTick - bornTick) / 16);
  }

  private async processAging(): Promise<DeathEvent[]> {
    if (this.currentTick % 16 !== 0) return []; // check every 16 ticks (~1 year)
    const allChars = await this.repo.getAllCharacters();
    const deathEvents: DeathEvent[] = [];

    for (const ch of allChars) {
      if (this.deadCharacters.has(ch.id)) continue;
      if (ch.bornTick == null) continue;

      const age = this.getAge(ch.id, ch.bornTick);

      // Peak period (25-45): small chance to gain +1 to a random stat
      if (age >= 25 && age <= 45 && Math.random() < 0.15) {
        const stat = Math.random() < 0.5 ? "military" : "intelligence";
        const val = Math.min(10, ch[stat] + 1);
        await this.repo.createCharacter({ ...ch, [stat]: val });
      }

      // Old age (55+): stat decay
      if (age >= 55 && Math.random() < 0.2) {
        const mil = Math.max(0, ch.military - 1);
        await this.repo.createCharacter({ ...ch, military: mil });
      }

      // Natural death (60+): increasing chance per year
      if (age >= 60) {
        const deathChance = 0.05 + (age - 60) * 0.03; // 5% at 60, 35% at 70
        if (Math.random() < deathChance) {
          const factionId = this.getFactionOf(ch.id);
          if (factionId) {
            const faction = FACTIONS.find((f) => f.id === factionId);
            const wasLeader = faction?.leaderId === ch.id;
            this.removeCharacter(ch.id, factionId);

            let successorId: string | undefined;
            let successorName: string | undefined;
            if (wasLeader && faction) {
              const successor = allChars.find((c) => c.id === faction.leaderId && c.id !== ch.id);
              successorId = successor?.id;
              successorName = successor?.name;
            }

            deathEvents.push({
              tick: this.currentTick,
              characterId: ch.id,
              characterName: ch.name,
              cause: "old_age",
              factionId,
              wasLeader,
              successorId,
              successorName,
            });
          }
        }
      }
    }
    return deathEvents;
  }

  // ── District helpers ──
  private hasDistrict(city: PlaceNode, type: DistrictType): boolean {
    return (city.districts ?? []).some((d) => d.type === type);
  }

  private cityDistrictCount(city: PlaceNode): number {
    return (city.districts ?? []).length;
  }

  // ── War Exhaustion API ──
  getWarExhaustion(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const f of FACTIONS) {
      result[f.id] = this.warExhaustion.get(f.id) ?? 0;
    }
    return result;
  }

  private adjustExhaustion(factionId: string, delta: number): void {
    const cur = this.warExhaustion.get(factionId) ?? 0;
    this.warExhaustion.set(factionId, Math.max(0, Math.min(100, Math.round(cur + delta))));
  }

  private applyWarExhaustion(battleResults: BattleResult[]): void {
    if (battleResults.length === 0) {
      // Natural recovery: -2 per tick without battles
      for (const f of FACTIONS) this.adjustExhaustion(f.id, -2);
      return;
    }
    for (const b of battleResults) {
      const aFaction = this.getFactionOf(b.attackerId);
      const dFaction = b.defenderId ? this.getFactionOf(b.defenderId) : null;
      if (aFaction) this.adjustExhaustion(aFaction, b.captured ? 8 : 4);
      if (dFaction) this.adjustExhaustion(dFaction, b.captured ? 12 : 3);
    }
  }

  private evaluateCeasefires(): DiplomacyEvent[] {
    const events: DiplomacyEvent[] = [];
    for (const faction of FACTIONS) {
      if (faction.id === "shu") continue;
      if (faction.members.length === 0) continue;
      const exhaustion = this.warExhaustion.get(faction.id) ?? 0;
      const morale = this.getMorale(faction.id);
      if (exhaustion >= 70 && morale < 40 && Math.random() < 0.3) {
        // Propose ceasefire with shu if both sides exhausted
        const allianceKey = ["shu", faction.id].sort().join(":");
        if (this.alliances.has(allianceKey)) continue;
        const shuExhaustion = this.warExhaustion.get("shu") ?? 0;
        if (shuExhaustion >= 40) {
          this.alliances.add(allianceKey);
          this.adjustMorale("shu", 5);
          this.adjustMorale(faction.id, 10);
          this.adjustExhaustion("shu", -20);
          this.adjustExhaustion(faction.id, -20);
          events.push({
            tick: this.currentTick,
            type: "alliance_formed",
            factionA: "shu",
            factionB: faction.id,
            description: `${faction.id} 因戰爭疲乏提議停戰，雙方達成休戰協議`,
          });
        }
      }
    }
    return events;
  }

  private async processDemands(): Promise<DiplomacyEvent[]> {
    const results: DiplomacyEvent[] = [];
    const demandCmds = this.commandQueue.filter((c) => c.type === "demand");

    for (const cmd of demandCmds) {
      const demanderFaction = this.getFactionOf(cmd.characterId);
      if (!demanderFaction) continue;
      const targetCity = await this.repo.getPlace(cmd.targetCityId);
      if (!targetCity?.controllerId) continue;
      const targetFaction = this.getFactionOf(targetCity.controllerId);
      if (!targetFaction || targetFaction === demanderFaction) continue;

      const demanderPrestige = [...this.characterPrestige.values()].reduce((s, v) => s + v, 0);
      const targetExhaustion = this.warExhaustion.get(targetFaction) ?? 0;
      const targetMorale = this.getMorale(targetFaction);

      if (cmd.demandType === "tribute") {
        const amount = cmd.demandAmount ?? 100;
        let acceptChance = 0.1 + (demanderPrestige / 500) + (targetExhaustion > 50 ? 0.2 : 0) - (amount / 1000);
        if (targetMorale < 30) acceptChance += 0.15;
        acceptChance = Math.max(0.05, Math.min(0.85, acceptChance));

        if (Math.random() < acceptChance) {
          const allCities = await this.repo.getAllPlaces();
          const targetCities = allCities.filter((c) => c.controllerId && this.getFactionOf(c.controllerId) === targetFaction);
          const payCity = targetCities.find((c) => c.gold >= amount);
          if (payCity) {
            await this.repo.updatePlace(payCity.id, { gold: payCity.gold - amount });
            const receiveCity = allCities.find((c) => c.controllerId && this.getFactionOf(c.controllerId) === demanderFaction);
            if (receiveCity) await this.repo.updatePlace(receiveCity.id, { gold: receiveCity.gold + amount });
          }
          this.adjustMorale(targetFaction, -5);
          results.push({ tick: this.currentTick, type: "demand_accepted", factionA: demanderFaction, factionB: targetFaction, description: `${demanderFaction} 索求歲幣 ${amount} 金，${targetFaction} 被迫接受` });
        } else {
          this.adjustExhaustion(targetFaction, -5); // Anger fuels resolve
          this.adjustMorale(targetFaction, 3);
          results.push({ tick: this.currentTick, type: "demand_rejected", factionA: demanderFaction, factionB: targetFaction, description: `${targetFaction} 拒絕 ${demanderFaction} 的歲幣要求，關係惡化` });
        }
      } else if (cmd.demandType === "withdraw") {
        // Demand enemy withdraw from a city (break siege or retreat)
        let acceptChance = 0.05 + (targetExhaustion > 60 ? 0.25 : 0);
        if (targetMorale < 30) acceptChance += 0.15;
        acceptChance = Math.max(0.05, Math.min(0.7, acceptChance));

        if (Math.random() < acceptChance && targetCity.siegedBy === targetFaction) {
          await this.repo.updatePlace(targetCity.id, { siegedBy: undefined, siegeTick: undefined });
          results.push({ tick: this.currentTick, type: "demand_accepted", factionA: demanderFaction, factionB: targetFaction, description: `${targetFaction} 接受撤退要求，解除對 ${targetCity.name} 的圍城` });
        } else {
          results.push({ tick: this.currentTick, type: "demand_rejected", factionA: demanderFaction, factionB: targetFaction, description: `${targetFaction} 拒絕從 ${targetCity.name} 撤退` });
        }
      }
    }
    // Remove demand commands from queue (they've been processed)
    this.commandQueue = this.commandQueue.filter((c) => c.type !== "demand");
    return results;
  }

  private async processSowDiscord(): Promise<DiplomacyEvent[]> {
    const results: DiplomacyEvent[] = [];
    const discordCmds = this.commandQueue.filter((c) => c.type === "sow_discord");

    for (const cmd of discordCmds) {
      const agentFaction = this.getFactionOf(cmd.characterId);
      if (!agentFaction) continue;
      const targetFaction = cmd.targetFactionId;
      if (!targetFaction || targetFaction === agentFaction) continue;

      const agent = await this.repo.getCharacter(cmd.characterId);
      if (!agent) continue;

      // Cost: 150 gold
      const cities = await this.repo.getAllPlaces();
      const payCity = cities.find((c) => c.controllerId && this.getFactionOf(c.controllerId) === agentFaction && c.gold >= 150);
      if (!payCity) continue;
      await this.repo.updatePlace(payCity.id, { gold: payCity.gold - 150 });

      // Success rate based on intelligence + espionage skill
      const espionage = (agent.skills?.espionage ?? 0);
      const successChance = 0.2 + (agent.intelligence * 0.05) + (espionage * 0.08);

      // Find all alliances involving the target faction
      const targetAlliances = [...this.alliances].filter((k) => k.includes(targetFaction));
      if (targetAlliances.length === 0) {
        results.push({ tick: this.currentTick, type: "demand_rejected", factionA: agentFaction, factionB: targetFaction, description: `離間計失敗：${targetFaction} 目前無任何盟約` });
        continue;
      }

      if (Math.random() < Math.min(0.75, successChance)) {
        // Break a random alliance of the target
        const allianceKey = targetAlliances[Math.floor(Math.random() * targetAlliances.length)];
        this.alliances.delete(allianceKey);
        const [fA, fB] = allianceKey.split(":");
        const otherFaction = fA === targetFaction ? fB : fA;
        this.adjustTrust(fA, fB, -15);
        this.addPrestige(cmd.characterId, 3);
        results.push({ tick: this.currentTick, type: "alliance_broken", factionA: fA, factionB: fB, description: `${agentFaction} 施展離間計，${fA} 與 ${fB} 同盟瓦解` });
      } else {
        // Failed: target gains trust with allies, agent loses prestige
        this.adjustTrust(agentFaction, targetFaction, -10);
        results.push({ tick: this.currentTick, type: "demand_rejected", factionA: agentFaction, factionB: targetFaction, description: `${agentFaction} 的離間計被識破，信任度下降` });
      }
    }
    this.commandQueue = this.commandQueue.filter((c) => c.type !== "sow_discord");
    return results;
  }

  // ── Food system ──
  private async produceFood(): Promise<void> {
    const cities = await this.repo.getAllPlaces();
    const season = getSeason(this.currentTick);
    for (const city of cities) {
      if (city.status === "dead" || !city.controllerId) continue;
      let foodIncome = city.tier === "major" ? 30 : 15;
      // Granary specialty: +100% (tripled with improvement)
      if (city.specialty === "granary") foodIncome *= city.improvement ? 3 : 2;
      // Agriculture district: +60%
      if (this.hasDistrict(city, "agriculture")) foodIncome = Math.round(foodIncome * 1.6);
      // Winter: -40% food production
      if (season === "winter") foodIncome = Math.round(foodIncome * 0.6);
      // Drought: -50% food production
      const droughtExpiry = this.droughtCities.get(city.id);
      if (droughtExpiry && droughtExpiry > this.currentTick) foodIncome = Math.round(foodIncome * 0.5);
      // Consumption: garrison * 5 per tick, doubled during siege
      const consumption = city.garrison * 5 * (city.siegedBy ? 2 : 1);
      const newFood = Math.max(0, (city.food ?? 100) + foodIncome - consumption);
      await this.repo.updatePlace(city.id, { food: newFood });
      // Starvation: food = 0 → garrison decays
      if (newFood === 0 && city.garrison > 0) {
        await this.repo.updatePlace(city.id, { garrison: Math.max(0, city.garrison - 1) });
      }
    }
  }

  private async processWorldEvents(): Promise<WorldEvent[]> {
    if (Math.random() > 0.20) return [];
    const cities = (await this.repo.getAllPlaces()).filter((c) => c.status !== "dead" && c.controllerId);
    if (cities.length === 0) return [];
    const city = cities[Math.floor(Math.random() * cities.length)];
    const types: WorldEventType[] = ["plague", "drought", "bandits"];
    const type = types[Math.floor(Math.random() * types.length)];
    let description = "";

    if (type === "plague") {
      const garrisonLoss = 2 + Math.floor(Math.random() * 3); // 2-4
      const foodLoss = 30;
      await this.repo.updatePlace(city.id, {
        garrison: Math.max(0, city.garrison - garrisonLoss),
        food: Math.max(0, (city.food ?? 100) - foodLoss),
      });
      description = `${city.name} 爆發瘟疫，守備 -${garrisonLoss}，糧食 -${foodLoss}`;
    } else if (type === "drought") {
      this.droughtCities.set(city.id, this.currentTick + 4);
      description = `${city.name} 遭遇旱災，糧食產量減半持續 4 天`;
    } else {
      // bandits
      const devLoss = Math.min(city.development, 1);
      await this.repo.updatePlace(city.id, {
        development: city.development - devLoss,
        garrison: Math.max(0, city.garrison - 1),
      });
      description = `${city.name} 盜匪猖獗，開發 -${devLoss}，守備 -1`;
    }

    return [{
      tick: this.currentTick,
      type,
      cityId: city.id,
      cityName: city.name,
      description,
    }];
  }

  private async processSeasonalEvent(): Promise<SeasonalEvent | null> {
    // Trigger at the start of each season (tick divisible by 4)
    if (this.currentTick === 0 || this.currentTick % 4 !== 0) return null;

    const season = getSeason(this.currentTick);
    const cities = await this.repo.getAllPlaces();
    const alliedCities = cities.filter((c) => c.controllerId && this.getFactionOf(c.controllerId) === "shu");

    let title = "";
    let description = "";
    let effects = "";

    switch (season) {
      case "spring": {
        // 豐收祭典: all cities gain food +20, morale +3
        title = "豐收祭典";
        for (const c of cities.filter((c) => c.controllerId)) {
          await this.repo.updatePlace(c.id, { food: Math.min(200, (c.food ?? 100) + 20) });
        }
        for (const f of FACTIONS) this.adjustMorale(f.id, 3);
        description = "春暖花開，各地慶祝豐收祭典，民心大振";
        effects = "全城市糧食+20，全勢力士氣+3";
        break;
      }
      case "summer": {
        // 邊境衝突: random border city gains garrison +1, trust between 2 random factions -5
        title = "邊境衝突";
        const borderCities = cities.filter((c) => c.controllerId && c.siegedBy);
        if (borderCities.length > 0) {
          const bc = borderCities[Math.floor(Math.random() * borderCities.length)];
          await this.repo.updatePlace(bc.id, { garrison: bc.garrison + 2 });
          description = `夏日炎炎，${bc.name} 邊境衝突加劇，守備增援`;
          effects = `${bc.name} 守備+2`;
        } else {
          // No sieged city: all factions get exhaustion -5
          for (const f of FACTIONS) this.adjustExhaustion(f.id, -5);
          description = "夏日太平，各國休養生息，戰爭疲乏減輕";
          effects = "全勢力疲乏-5";
        }
        break;
      }
      case "autumn": {
        // 商路開通: allied cities get gold +30 each
        title = "商路開通";
        for (const c of alliedCities) {
          await this.repo.updatePlace(c.id, { gold: c.gold + 30 });
        }
        description = "秋收時節商旅雲集，玩家城市獲得額外金幣收入";
        effects = `我方城市金幣+30（共${alliedCities.length}城）`;
        break;
      }
      case "winter": {
        // 嚴冬寒潮: all cities lose food -15, ungarrisoned cities lose garrison -1
        title = "嚴冬寒潮";
        for (const c of cities.filter((c) => c.controllerId)) {
          const foodLoss = 15;
          const garrisonLoss = c.garrison <= 1 ? 0 : (Math.random() < 0.3 ? 1 : 0);
          await this.repo.updatePlace(c.id, {
            food: Math.max(0, (c.food ?? 100) - foodLoss),
            garrison: Math.max(0, c.garrison - garrisonLoss),
          });
        }
        description = "寒冬降臨，糧草消耗加劇，部分守軍凍傷減員";
        effects = "全城市糧食-15，部分城市守備-1";
        break;
      }
    }

    return { tick: this.currentTick, season, title, description, effects };
  }

  private travelTimeFor(charId: string, originCity: PlaceNode | undefined, baseTravelTime: number): number {
    const faction = this.getFactionOf(charId);
    let time = originCity?.specialty === "harbor" ? 1 : baseTravelTime;
    time += SEASON_TRAVEL_PENALTY[getSeason(this.currentTick)];
    // Logistics tech: -1 travel time (min 1)
    if (faction && this.hasTech(faction, "logistics")) time = Math.max(1, time - 1);
    return time;
  }

  async advanceDay(): Promise<AdvanceDayResult> {
    // Prevent advancing after game ends
    if (this.gameState.status !== "ongoing") {
      return {
        tick: this.currentTick,
        season: getSeason(this.currentTick),
        events: [],
        dailySummary: "",
        battleResults: [],
        diplomacyEvents: [],
        recruitmentResults: [],
        betrayalEvents: [],
        spyReports: [],
        deathEvents: [],
        worldEvents: [],
        seasonalEvent: null,
        pendingCard: null,
        gameStatus: this.gameState.status,
      };
    }

    const simEvents = this.engine.advanceDay();

    const storedEvents: Omit<StoredEvent, "id">[] = simEvents.map((e) => ({
      tick: e.tick,
      timestamp: e.timestamp,
      actorId: e.actorId,
      targetId: e.targetId,
      eventCode: e.eventCode,
      intimacyChange: e.resultDelta.intimacyChange,
      oldIntimacy: e.resultDelta.oldIntimacy,
      newIntimacy: e.resultDelta.newIntimacy,
      relation: e.resultDelta.relation,
      narrative: "",
    }));

    if (storedEvents.length > 0) {
      this.eventStore.append(storedEvents);
    }

    // Sync relationships to graph
    const updatedRels = this.engine.getRelationships();
    for (const rel of updatedRels) {
      await this.repo.setRelationship(rel);
    }

    // City economy: produce gold and food
    await this.produceGold();
    await this.produceFood();

    // Execute player commands
    await this.executeCommands();

    // NPC AI decisions
    await this.runNPCDecisions();

    // NPC factions spend gold (reinforce + develop + improvements)
    await this.npcSpend();

    // Specialty passive effects (military_academy, library)
    await this.processSpecialtyPassives();

    // Process ongoing sieges (garrison attrition)
    await this.processSieges();

    // Generate random movements for remaining idle characters (10%)
    await this.generateMovements();

    // Resolve arrivals and battles (enhanced: garrison combat)
    const battleResults = await this.resolveArrivals();

    // Recruitment: captured characters can be recruited
    const recruitmentResults = await this.processRecruitments(battleResults);

    // Resolve spy missions
    const spyReports = await this.processSpyMissions();

    // Evaluate diplomacy
    const diplomacyEvents = await this.evaluateDiplomacy();

    // Process diplomatic demands from player
    const demandEvents = await this.processDemands();
    diplomacyEvents.push(...demandEvents);

    // Process sow discord commands
    const discordEvents = await this.processSowDiscord();
    diplomacyEvents.push(...discordEvents);

    // Alliance trust naturally recovers +1 per tick for allied factions
    for (const key of this.alliances) {
      const [fA, fB] = key.split(":");
      this.adjustTrust(fA, fB, 1);
    }

    // Betrayal: disloyal characters may defect
    const betrayalEvents = await this.processBetrayals();

    // Process technology research
    await this.processResearch();

    // NPC hire neutral characters
    await this.npcHireNeutrals();

    // World events (plague, drought, bandits)
    const worldEvents = await this.processWorldEvents();

    // Seasonal major event (every 4 ticks)
    const seasonalEvent = await this.processSeasonalEvent();

    // Character deaths from recent battles
    const deathEvents = await this.processDeaths(battleResults);

    // Clean up invalid trade routes and NPC establish new ones
    await this.cleanupTradeRoutes();
    await this.npcEstablishTrades();

    // Supply line effects (unsupplied cities decay)
    await this.applySupplyEffects();

    // Update morale from this turn's events
    this.applyMoraleFromBattles(battleResults);
    this.applyMoraleFromDeaths(deathEvents);
    this.applyMoraleFromDiplomacy(diplomacyEvents);
    this.applyMoraleFromBetrayals(betrayalEvents);
    this.moraleDrift();

    // War exhaustion
    this.applyWarExhaustion(battleResults);
    const ceasefireEvents = this.evaluateCeasefires();
    diplomacyEvents.push(...ceasefireEvents);

    // Update prestige from this turn's events
    this.updatePrestigeFromBattles(battleResults);
    this.updatePrestigeFromSpyReports(spyReports);
    this.applyDeathLegacy(deathEvents);

    // Update favorability
    await this.updateFavorability(battleResults, betrayalEvents);

    // Process mentor-apprentice skill transfer
    await this.processMentorship();

    // Process aging: stat changes and natural death
    const agingDeaths = await this.processAging();
    deathEvents.push(...agingDeaths);

    // Draw event card (30% chance)
    const drawnCard = drawEventCard();
    const pendingCard: PendingEventCard | null = drawnCard ? { card: drawnCard, tick: this.currentTick } : null;
    this.pendingCard = pendingCard;

    // Eliminate factions that lost all cities
    await this.processEliminatedFactions();

    // Check win/defeat conditions
    const gameStatus = await this.checkGameOver();

    // Record faction history
    await this.recordFactionHistory();

    // Fetch events with IDs
    const tickEvents = this.eventStore.getByTickRange(this.currentTick, this.currentTick);

    // Generate narratives (async, LLM or template)
    let dailySummary = "";
    if (this.narrative && tickEvents.length > 0) {
      const [narratives, summary] = await Promise.all([
        this.narrative.generateNarratives(tickEvents),
        this.narrative.generateDailySummary(this.currentTick, tickEvents),
      ]);

      // Update event store with narratives
      this.eventStore.updateNarratives(
        narratives.map((n) => ({ id: n.eventId, narrative: n.narrative })),
      );
      dailySummary = summary;
      this.dailySummaries.set(this.currentTick, summary);

      // Re-read events with narratives
      const updatedEvents = this.eventStore.getByTickRange(this.currentTick, this.currentTick);
      const season = getSeason(this.currentTick);
      return { tick: this.currentTick, season, events: updatedEvents, dailySummary, battleResults, diplomacyEvents, recruitmentResults, betrayalEvents, spyReports, deathEvents, worldEvents, seasonalEvent, pendingCard, gameStatus };
    }

    const season = getSeason(this.currentTick);
    return { tick: this.currentTick, season, events: tickEvents, dailySummary, battleResults, diplomacyEvents, recruitmentResults, betrayalEvents, spyReports, deathEvents, worldEvents, seasonalEvent, pendingCard, gameStatus };
  }

  getDailySummary(tick: number): string {
    return this.dailySummaries.get(tick) ?? "";
  }

  async getGraphAtTick(centerId: string, depth: number, tick: number): Promise<CharacterGraph> {
    if (tick >= this.currentTick) {
      return this.repo.getCharacterGraph(centerId, depth);
    }

    const snapshotRels = this.computeRelationshipsAtTick(tick);
    const liveGraph = await this.repo.getCharacterGraph(centerId, depth);

    const relMap = new Map(
      snapshotRels.map((r) => {
        const key = [r.sourceId, r.targetId].sort().join(":");
        return [key, r];
      }),
    );

    const snappedRelationships = liveGraph.relationships.map((r) => {
      const key = [r.sourceId, r.targetId].sort().join(":");
      const snap = relMap.get(key);
      if (snap) {
        return { ...r, intimacy: snap.intimacy, relationshipType: snap.relationshipType };
      }
      return r;
    });

    return {
      center: liveGraph.center,
      characters: liveGraph.characters,
      relationships: snappedRelationships,
    };
  }

  getIntimacyTimeline(actorId: string, targetId: string): TimelinePoint[] {
    const events = this.eventStore.getByPair(actorId, targetId);

    const initial = this.initialRelationships.find(
      (r) =>
        (r.sourceId === actorId && r.targetId === targetId) ||
        (r.sourceId === targetId && r.targetId === actorId),
    );
    const initialIntimacy = initial?.intimacy ?? 50;

    const points: TimelinePoint[] = [{ tick: 0, intimacy: initialIntimacy }];

    for (const evt of events) {
      points.push({ tick: evt.tick, intimacy: evt.newIntimacy });
    }

    return points;
  }

  private computeRelationshipsAtTick(tick: number): RelationshipEdge[] {
    const relMap = new Map<string, RelationshipEdge>();
    for (const r of this.initialRelationships) {
      const key = [r.sourceId, r.targetId].sort().join(":");
      relMap.set(key, { ...r });
    }

    const events = this.eventStore.getByTickRange(1, tick);
    for (const evt of events) {
      const key = [evt.actorId, evt.targetId].sort().join(":");
      const rel = relMap.get(key);
      if (rel) {
        rel.intimacy = evt.newIntimacy;
        rel.relationshipType = deriveType(evt.newIntimacy);
      }
    }

    return [...relMap.values()];
  }

  getEventLog(characterId?: string, fromTick?: number, toTick?: number): StoredEvent[] {
    if (characterId) {
      return this.eventStore.getByCharacter(characterId, fromTick, toTick);
    }
    if (fromTick !== undefined && toTick !== undefined) {
      return this.eventStore.getByTickRange(fromTick, toTick);
    }
    return this.eventStore.getAll();
  }

  getPairEvents(actorId: string, targetId: string): StoredEvent[] {
    return this.eventStore.getByPair(actorId, targetId);
  }

  private commandedThisTick = new Set<string>();

  private async runNPCDecisions(): Promise<void> {
    const characters = await this.repo.getAllCharacters();
    const cities = await this.repo.getAllPlaces();

    const rels = this.engine.getRelationships() as import("@rtk/graph-db").RelationshipEdge[];
    const decisions = evaluateNPCDecisions(FACTIONS, characters, cities, "shu", this.alliances, rels);

    for (const decision of decisions) {
      if (decision.action === "stay" || !decision.targetCityId) continue;
      if (this.commandedThisTick.has(decision.characterId)) continue;

      const char = await this.repo.getCharacter(decision.characterId);
      if (!char?.cityId || char.cityId === decision.targetCityId) continue;

      this.commandedThisTick.add(decision.characterId);
      const originCity = cities.find((c) => c.id === char.cityId);
      const baseTravelTime = decision.action === "attack" ? 1 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 3);
      const travelTime = this.travelTimeFor(decision.characterId, originCity, baseTravelTime);

      await this.repo.addMovement({
        characterId: decision.characterId,
        originCityId: char.cityId,
        destinationCityId: decision.targetCityId,
        departureTick: this.currentTick,
        arrivalTick: this.currentTick + travelTime,
      });

      await this.repo.createCharacter({ ...char, cityId: decision.targetCityId });
    }
  }

  private async executeCommands(): Promise<void> {
    this.commandedThisTick.clear();
    const commands = [...this.commandQueue];
    this.commandQueue = [];
    const cities = await this.repo.getAllPlaces();

    for (const cmd of commands) {
      // Reinforce: spend gold to increase garrison
      if (cmd.type === "reinforce") {
        const city = await this.repo.getPlace(cmd.targetCityId);
        if (!city || city.gold < 100) continue;
        await this.repo.updatePlace(city.id, {
          gold: city.gold - 100,
          garrison: city.garrison + 1,
        });
        continue;
      }

      // Develop: spend gold to increase city development
      if (cmd.type === "develop") {
        const city = await this.repo.getPlace(cmd.targetCityId);
        if (!city || city.gold < 300 || city.development >= 5) continue;
        await this.repo.updatePlace(city.id, {
          gold: city.gold - 300,
          development: city.development + 1,
        });
        continue;
      }

      // Build improvement: spend 500 gold, requires dev Lv.3+, must have specialty
      if (cmd.type === "build_improvement") {
        const city = await this.repo.getPlace(cmd.targetCityId);
        if (!city || city.gold < 500 || city.development < 3 || !city.specialty || city.improvement) continue;
        await this.repo.updatePlace(city.id, {
          gold: city.gold - 500,
          improvement: SPECIALTY_IMPROVEMENT[city.specialty] ?? city.specialty,
        });
        continue;
      }

      // Hire neutral character: costs 200 gold (100 with recruitment district)
      if (cmd.type === "hire_neutral" && cmd.targetCharacterId) {
        const target = await this.repo.getCharacter(cmd.targetCharacterId);
        if (!target || !this.isNeutral(cmd.targetCharacterId)) continue;
        const city = await this.repo.getPlace(cmd.targetCityId);
        const hireCost = this.hasDistrict(city!, "recruitment") ? 100 : 200;
        if (!city || city.gold < hireCost) continue;
        // Recruiter is the faction leader
        const recruiter = await this.repo.getCharacter(cmd.characterId);
        if (!recruiter) continue;
        const faction = this.getFactionOf(cmd.characterId);
        if (!faction) continue;
        // Success chance: 50% + charm*5% + leadership*5% (+25% with recruitment district)
        let chance = Math.min(0.95, 0.5 + recruiter.charm * 0.05 + getSkills(recruiter).leadership * 0.05);
        if (this.hasDistrict(city, "recruitment")) chance = Math.min(0.95, chance + 0.25);
        const success = Math.random() < chance;
        await this.repo.updatePlace(city.id, { gold: city.gold - hireCost });
        if (success) {
          const factionObj = FACTIONS.find((f) => f.id === faction);
          if (factionObj) factionObj.members.push(cmd.targetCharacterId);
        }
        continue;
      }

      // Assign role to character
      if (cmd.type === "assign_role" && cmd.role) {
        const char = await this.repo.getCharacter(cmd.characterId);
        if (!char) continue;
        await this.repo.createCharacter({ ...char, role: cmd.role });
        continue;
      }

      // Establish trade route between two allied cities
      if (cmd.type === "establish_trade" && cmd.tradeCityId) {
        const cityA = await this.repo.getPlace(cmd.targetCityId);
        const cityB = await this.repo.getPlace(cmd.tradeCityId);
        if (!cityA || !cityB) continue;
        if (cityA.gold < 200) continue;
        // Both cities must be allied
        if (cityA.status !== "allied" || cityB.status !== "allied") continue;
        // Max 3 routes per city
        if (this.tradeRoutesForCity(cityA.id).length >= 3) continue;
        if (this.tradeRoutesForCity(cityB.id).length >= 3) continue;
        // No duplicate route
        const dup = this.tradeRoutes.find(
          (r) => (r.cityA === cityA.id && r.cityB === cityB.id) || (r.cityA === cityB.id && r.cityB === cityA.id),
        );
        if (dup) continue;
        await this.repo.updatePlace(cityA.id, { gold: cityA.gold - 200 });
        this.tradeCounter++;
        this.tradeRoutes.push({
          id: `trade-${this.tradeCounter}`,
          cityA: cityA.id,
          cityB: cityB.id,
          factionId: "shu",
          establishedTick: this.currentTick,
        });
        continue;
      }

      // Build district in a city
      if (cmd.type === "build_district" && cmd.districtType) {
        const city = await this.repo.getPlace(cmd.targetCityId);
        if (!city || city.gold < DISTRICT_COST || city.development < 2) continue;
        if (this.cityDistrictCount(city) >= MAX_DISTRICTS) continue;
        if (this.hasDistrict(city, cmd.districtType)) continue;
        const districts = [...(city.districts ?? []), { type: cmd.districtType, builtTick: this.currentTick }];
        await this.repo.updatePlace(city.id, { gold: city.gold - DISTRICT_COST, districts } as Partial<PlaceNode>);
        continue;
      }

      // Assign mentor-apprentice pair
      if (cmd.type === "assign_mentor" && cmd.targetCharacterId) {
        const mentor = await this.repo.getCharacter(cmd.characterId);
        const apprentice = await this.repo.getCharacter(cmd.targetCharacterId);
        if (!mentor || !apprentice) continue;
        // Both must be in same faction
        const mentorFaction = this.getFactionOf(cmd.characterId);
        const apprenticeFaction = this.getFactionOf(cmd.targetCharacterId);
        if (!mentorFaction || mentorFaction !== apprenticeFaction) continue;
        // No duplicate: mentor already has an apprentice, or apprentice already has a mentor
        const existing = this.mentorPairs.find(
          (p) => p.mentorId === cmd.characterId || p.apprenticeId === cmd.targetCharacterId,
        );
        if (existing) continue;
        this.mentorPairs.push({
          mentorId: cmd.characterId,
          apprenticeId: cmd.targetCharacterId,
          factionId: mentorFaction,
          startTick: this.currentTick,
        });
        continue;
      }

      // Build siege engine: costs 300 gold, requires tactics >= 2, city must be under siege by character's faction
      if (cmd.type === "build_siege") {
        const city = await this.repo.getPlace(cmd.targetCityId);
        const char = await this.repo.getCharacter(cmd.characterId);
        if (!city || !char || !city.siegedBy) continue;
        const faction = this.getFactionOf(char.id);
        if (!faction || city.siegedBy !== char.id) continue;
        const skills = getSkills(char);
        if (skills.tactics < 2) continue;
        // Find a faction city to pay from
        const allCities = await this.repo.getAllPlaces();
        const payCity = allCities.find((c) => c.controllerId && this.getFactionOf(c.controllerId) === faction && c.gold >= 300);
        if (!payCity) continue;
        const garrisonHit = skills.tactics >= 4 ? 3 : 2;
        const foodHit = skills.tactics >= 4 ? 30 : 20;
        await this.repo.updatePlace(payCity.id, { gold: payCity.gold - 300 });
        await this.repo.updatePlace(city.id, {
          garrison: Math.max(0, city.garrison - garrisonHit),
          food: Math.max(0, (city.food ?? 100) - foodHit),
        });
        this.addPrestige(char.id, 2);
        continue;
      }

      // Train unit at allied city
      if (cmd.type === "train_unit" && cmd.unitType) {
        const city = await this.repo.getPlace(cmd.targetCityId);
        if (!city || !city.controllerId) continue;
        const faction = this.getFactionOf(cmd.characterId);
        if (!faction || this.getFactionOf(city.controllerId) !== faction) continue;
        const cost = UNIT_TRAIN_COST[cmd.unitType];
        if (city.gold < cost) continue;
        const units = getUnitComposition(city);
        units[cmd.unitType] += 1;
        await this.repo.updatePlace(city.id, { gold: city.gold - cost, units });
        continue;
      }

      // Store tactic for attack commands
      if (cmd.type === "attack" && cmd.tactic) {
        this.pendingTactics.set(cmd.characterId, cmd.tactic);
      }

      // Start research for player faction
      if (cmd.type === "start_research" && cmd.techId) {
        const tech = TECHNOLOGIES.find((t) => t.id === cmd.techId);
        if (!tech) continue;
        const factionId = "shu";
        const state = this.getFactionTech(factionId);
        if (state.current || state.completed.includes(tech.id)) continue;
        // Deduct cost from richest allied city
        const allCities = await this.repo.getAllPlaces();
        const shuFaction = FACTIONS.find((f) => f.id === factionId);
        if (!shuFaction) continue;
        const alliedCities = allCities
          .filter((c) => c.controllerId && shuFaction.members.includes(c.controllerId))
          .sort((a, b) => b.gold - a.gold);
        if (alliedCities.length === 0 || alliedCities[0].gold < tech.cost) continue;
        await this.repo.updatePlace(alliedCities[0].id, { gold: alliedCities[0].gold - tech.cost });
        state.current = { techId: tech.id, startTick: this.currentTick };
        continue;
      }

      // Spy/Sabotage: send spy on covert mission (costs 100 gold from any allied city)
      if (cmd.type === "spy" || cmd.type === "sabotage") {
        const spyChar = await this.repo.getCharacter(cmd.characterId);
        if (!spyChar) continue;
        // Deduct 100 gold from spy's current city
        const spyCity = spyChar.cityId ? await this.repo.getPlace(spyChar.cityId) : null;
        if (!spyCity || spyCity.gold < 100) continue;
        await this.repo.updatePlace(spyCity.id, { gold: spyCity.gold - 100 });
        this.spyCounter++;
        this.spyMissions.push({
          id: `spy-${this.spyCounter}`,
          characterId: cmd.characterId,
          targetCityId: cmd.targetCityId,
          missionType: cmd.type === "spy" ? "intel" : "sabotage",
          departureTick: this.currentTick,
          arrivalTick: this.currentTick + 2,
          status: "traveling",
        });
        this.commandedThisTick.add(cmd.characterId);
        continue;
      }

      const char = await this.repo.getCharacter(cmd.characterId);
      if (!char || !char.cityId) continue;
      if (char.cityId === cmd.targetCityId) continue;

      this.commandedThisTick.add(cmd.characterId);
      const originCity = cities.find((c) => c.id === char.cityId);
      const baseTravelTime = cmd.type === "attack" ? 1 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 3);
      const travelTime = this.travelTimeFor(cmd.characterId, originCity, baseTravelTime);

      await this.repo.addMovement({
        characterId: cmd.characterId,
        originCityId: char.cityId,
        destinationCityId: cmd.targetCityId,
        departureTick: this.currentTick,
        arrivalTick: this.currentTick + travelTime,
      });

      await this.repo.createCharacter({ ...char, cityId: cmd.targetCityId });
    }
  }

  private async generateMovements(): Promise<void> {
    const characters = await this.repo.getAllCharacters();
    const cities = await this.repo.getAllPlaces();
    if (cities.length < 2) return;

    const activeCityIds = cities.filter((c) => c.status !== "dead").map((c) => c.id);
    if (activeCityIds.length < 2) return;

    for (const char of characters) {
      if (!char.cityId || Math.random() > 0.1) continue;
      if (this.commandedThisTick.has(char.id)) continue;

      const destinations = activeCityIds.filter((id) => id !== char.cityId);
      if (destinations.length === 0) continue;

      const destId = destinations[Math.floor(Math.random() * destinations.length)];
      const originCity = cities.find((c) => c.id === char.cityId);
      const travelTime = this.travelTimeFor(char.id, originCity, 1 + Math.floor(Math.random() * 3));

      await this.repo.addMovement({
        characterId: char.id,
        originCityId: char.cityId,
        destinationCityId: destId,
        departureTick: this.currentTick,
        arrivalTick: this.currentTick + travelTime,
      });

      await this.repo.createCharacter({ ...char, cityId: destId });
    }
  }

  private async npcSpend(): Promise<void> {
    const cities = await this.repo.getAllPlaces();
    for (const faction of FACTIONS) {
      if (faction.id === "shu") continue; // Player controls shu spending
      const factionCities = cities.filter(
        (c) => c.controllerId && faction.members.includes(c.controllerId),
      );

      // First: reinforce weakest garrison if any city has enough gold
      const weakest = factionCities
        .filter((c) => c.gold >= 100)
        .sort((a, b) => a.garrison - b.garrison)[0];
      if (weakest && weakest.garrison < 4) {
        await this.repo.updatePlace(weakest.id, {
          gold: weakest.gold - 100,
          garrison: weakest.garrison + 1,
        });
      }

      // Then: develop richest city if affordable and low development
      const devTarget = factionCities
        .filter((c) => c.gold >= 300 && c.development < 3)
        .sort((a, b) => b.gold - a.gold)[0];
      if (devTarget) {
        await this.repo.updatePlace(devTarget.id, {
          gold: devTarget.gold - 300,
          development: devTarget.development + 1,
        });
      }

      // Build improvement if dev >= 3, has specialty, no improvement yet, and can afford
      const improvable = factionCities
        .filter((c) => c.gold >= 500 && c.development >= 3 && c.specialty && !c.improvement)
        .sort((a, b) => b.gold - a.gold)[0];
      if (improvable && improvable.specialty) {
        await this.repo.updatePlace(improvable.id, {
          gold: improvable.gold - 500,
          improvement: SPECIALTY_IMPROVEMENT[improvable.specialty] ?? improvable.specialty,
        });
      }
    }
  }

  private async processResearch(): Promise<void> {
    for (const faction of FACTIONS) {
      const state = this.getFactionTech(faction.id);
      if (!state.current) continue;
      const tech = TECHNOLOGIES.find((t) => t.id === state.current!.techId);
      if (!tech) continue;
      const elapsed = this.currentTick - state.current.startTick;
      if (elapsed < tech.turns) continue;

      // Research complete
      state.completed.push(tech.id);
      state.current = null;

      // Apply one-time tech effects
      if (tech.id === "archery") {
        // +1 intelligence to all faction characters
        const allChars = await this.repo.getAllCharacters();
        for (const ch of allChars) {
          if (faction.members.includes(ch.id) && ch.intelligence < 10) {
            await this.repo.createCharacter({ ...ch, intelligence: ch.intelligence + 1 });
          }
        }
      }
      if (tech.id === "divine_strategy") {
        // +1 tactics skill to all faction characters
        const allChars = await this.repo.getAllCharacters();
        for (const ch of allChars) {
          if (faction.members.includes(ch.id)) {
            await this.repo.createCharacter({ ...ch, skills: gainSkill(ch, "tactics") });
          }
        }
      }
    }

    // NPC factions auto-research
    for (const faction of FACTIONS) {
      if (faction.id === "shu") continue;
      const state = this.getFactionTech(faction.id);
      if (state.current) continue;

      // Pick first available tech not yet completed
      const nextTech = TECHNOLOGIES.find((t) => !state.completed.includes(t.id));
      if (!nextTech) continue;

      // Check if faction can afford
      const cities = await this.repo.getAllPlaces();
      const factionCities = cities
        .filter((c) => c.controllerId && faction.members.includes(c.controllerId))
        .sort((a, b) => b.gold - a.gold);
      if (factionCities.length === 0 || factionCities[0].gold < nextTech.cost) continue;

      await this.repo.updatePlace(factionCities[0].id, { gold: factionCities[0].gold - nextTech.cost });
      state.current = { techId: nextTech.id, startTick: this.currentTick };
    }
  }

  private async npcHireNeutrals(): Promise<void> {
    const allChars = await this.repo.getAllCharacters();
    const cities = await this.repo.getAllPlaces();

    for (const faction of FACTIONS) {
      if (faction.id === "shu") continue; // Player hires manually
      if (Math.random() > 0.1) continue; // 10% chance per turn

      const leader = allChars.find((c) => c.id === faction.leaderId);
      if (!leader) continue;

      // Find neutral characters in cities controlled by this faction
      const factionCities = cities.filter(
        (c) => c.controllerId && faction.members.includes(c.controllerId),
      );

      for (const city of factionCities) {
        if (city.gold < 200) continue;
        const neutralsHere = allChars.filter(
          (c) => c.cityId === city.id && this.isNeutral(c.id),
        );
        if (neutralsHere.length === 0) continue;

        const target = neutralsHere[0];
        const chance = Math.min(0.9, 0.5 + leader.charm * 0.05 + getSkills(leader).leadership * 0.05);
        if (Math.random() >= chance) continue;

        await this.repo.updatePlace(city.id, { gold: city.gold - 200 });
        faction.members.push(target.id);
        break; // One hire per turn max
      }
    }
  }

  private async processSpyMissions(): Promise<SpyReport[]> {
    const reports: SpyReport[] = [];
    const remaining: SpyMission[] = [];

    for (const mission of this.spyMissions) {
      // Still traveling
      if (mission.status === "traveling" && this.currentTick < mission.arrivalTick) {
        remaining.push(mission);
        continue;
      }

      // Just arrived — resolve mission
      const spy = await this.repo.getCharacter(mission.characterId);
      const targetCity = await this.repo.getPlace(mission.targetCityId);
      if (!spy || !targetCity) continue;

      // Base success rate: 40% for intel, 30% for sabotage
      // Intelligence bonus: +5% per point, espionage skill: +8% per level
      const spySkill = getSkills(spy).espionage;
      const spyFaction = this.getFactionOf(spy.id);
      const baseRate = mission.missionType === "intel" ? 0.4 : 0.3;
      let successRate = baseRate + spy.intelligence * 0.05 + spySkill * 0.08;
      // Spymaster role: +20% success
      successRate += this.roleSpyBonus(spy);
      // Spy network tech: +20% success
      if (spyFaction && this.hasTech(spyFaction, "spy_network")) successRate += 0.2;
      successRate = Math.min(0.95, successRate);
      const success = Math.random() < successRate;

      // Caught chance: 50% base, -5% per intelligence, -8% per espionage skill
      let caughtRate = 0.5 - spy.intelligence * 0.05 - spySkill * 0.08;
      if (spy.role === "spymaster") caughtRate -= 0.1;
      caughtRate = Math.max(0.05, caughtRate);
      const caught = !success && Math.random() < caughtRate;

      const report: SpyReport = {
        tick: this.currentTick,
        characterId: spy.id,
        characterName: spy.name,
        targetCityId: targetCity.id,
        targetCityName: targetCity.name,
        missionType: mission.missionType,
        success,
        caught,
      };

      if (success && mission.missionType === "intel") {
        report.intel = {
          gold: targetCity.gold,
          garrison: targetCity.garrison,
          controllerId: targetCity.controllerId,
        };
      }

      if (success && mission.missionType === "sabotage") {
        // Sabotage effects: reduce garrison by 1-2 and gold by 50-150
        const garrisonLoss = 1 + Math.floor(Math.random() * 2);
        const goldLoss = 50 + Math.floor(Math.random() * 100);
        await this.repo.updatePlace(targetCity.id, {
          garrison: Math.max(0, targetCity.garrison - garrisonLoss),
          gold: Math.max(0, targetCity.gold - goldLoss),
        });
        report.sabotageEffect = `守備-${garrisonLoss}、金幣-${goldLoss}`;
      }

      if (success) {
        // Espionage skill gain on success
        await this.repo.createCharacter({ ...spy, skills: gainSkill(spy, "espionage") });
      } else if (caught) {
        // Spy is captured — imprisoned (remove from city, stays in faction but unusable)
        await this.repo.createCharacter({ ...spy, cityId: undefined });
      }

      reports.push(report);
      // Mission complete — don't keep it
    }

    this.spyMissions = remaining;
    return reports;
  }

  getSpyMissions(): SpyMission[] {
    return [...this.spyMissions];
  }

  private async processSpecialtyPassives(): Promise<void> {
    const tick = this.currentTick;
    // Spring: passives trigger every 4 ticks; otherwise every 5
    const season = getSeason(tick);
    const interval = season === "spring" ? 4 : 5;
    if (tick % interval !== 0 || tick === 0) return;

    const cities = await this.repo.getAllPlaces();
    const characters = await this.repo.getAllCharacters();

    for (const city of cities) {
      if (city.status === "dead" || !city.controllerId) continue;

      const charsHere = characters.filter((c) => c.cityId === city.id);
      if (charsHere.length === 0) continue;

      // Military academy: +1 military to characters here (cap 10)
      if (city.specialty === "military_academy") {
        const gain = city.improvement ? 2 : 1;
        for (const ch of charsHere) {
          if (ch.military < 10) {
            await this.repo.createCharacter({ ...ch, military: Math.min(10, ch.military + gain) });
          }
        }
      }

      // Library: +1 intelligence to characters here (cap 10)
      if (city.specialty === "library") {
        const gain = city.improvement ? 2 : 1;
        for (const ch of charsHere) {
          if (ch.intelligence < 10) {
            await this.repo.createCharacter({ ...ch, intelligence: Math.min(10, ch.intelligence + gain) });
          }
        }
      }
    }
  }

  private async processSieges(): Promise<void> {
    const cities = await this.repo.getAllPlaces();
    for (const city of cities) {
      if (!city.siegedBy || city.siegeTick == null) continue;
      const duration = this.currentTick - city.siegeTick;

      // Granary specialty: siege attrition delayed to 4 ticks (6 with improvement)
      // Agriculture district: +3 ticks additional delay
      let siegeDelay = city.specialty === "granary" ? (city.improvement ? 6 : 4) : 2;
      if (this.hasDistrict(city, "agriculture")) siegeDelay += 3;
      if (duration < siegeDelay) continue;

      // Check if besieging faction still has characters nearby
      const allChars = await this.repo.getAllCharacters();
      const besiegers = allChars.filter(
        (c) => c.cityId === city.id && this.getFactionOf(c.id) === city.siegedBy,
      );

      if (besiegers.length === 0) {
        // Siege broken: no besiegers remain
        await this.repo.updatePlace(city.id, { siegedBy: undefined, siegeTick: undefined });
        continue;
      }

      // Sally forth: defenders attempt to break siege
      if (city.garrison >= 4 && duration >= 3 && Math.random() < 0.25) {
        const defenders = allChars.filter(
          (c) => c.cityId === city.id && c.id !== city.siegedBy && this.getFactionOf(c.id) !== city.siegedBy,
        );
        const defenderPower = city.garrison + defenders.reduce((s, d) => s + d.military, 0) + Math.random() * 2;
        const besiegerPower = besiegers.reduce((s, b) => s + b.military + getSkills(b).tactics, 0) + Math.random() * 2;
        if (defenderPower > besiegerPower) {
          // Sally succeeds: siege broken, garrison loses 1
          await this.repo.updatePlace(city.id, {
            siegedBy: undefined,
            siegeTick: undefined,
            garrison: Math.max(0, city.garrison - 1),
          });
          continue;
        } else {
          // Sally fails: garrison loses 2
          await this.repo.updatePlace(city.id, { garrison: Math.max(0, city.garrison - 2) });
          if (city.garrison - 2 <= 0) {
            const leadBesieger = besiegers[0];
            await this.repo.updatePlace(city.id, {
              controllerId: leadBesieger.id,
              status: this.factionToStatus(city.siegedBy),
              siegedBy: undefined,
              siegeTick: undefined,
              garrison: 0,
            });
            continue;
          }
        }
      }

      // Garrison attrition: -1 per tick while sieged
      const newGarrison = Math.max(0, city.garrison - 1);
      await this.repo.updatePlace(city.id, { garrison: newGarrison });

      // If garrison reaches 0, city falls to besiegers
      if (newGarrison === 0) {
        const leadBesieger = besiegers[0];
        await this.repo.updatePlace(city.id, {
          controllerId: leadBesieger.id,
          status: this.factionToStatus(city.siegedBy),
          siegedBy: undefined,
          siegeTick: undefined,
        });
      }
    }
  }

  private async produceGold(): Promise<void> {
    const cities = await this.repo.getAllPlaces();
    const characters = await this.repo.getAllCharacters();
    const season = getSeason(this.currentTick);
    const seasonMult = SEASON_GOLD_MULTIPLIER[season];
    const supplyStatus = await this.computeSupplyStatus();
    for (const city of cities) {
      if (city.status === "dead" || !city.controllerId) continue;
      // Sieged cities produce no gold
      if (city.siegedBy) continue;
      const baseIncome = city.tier === "major" ? 100 : 50;
      let multiplier = 1 + city.development * 0.3;
      // Unsupplied cities: -30% gold production
      if (supplyStatus[city.id] === false) multiplier *= 0.7;
      // Market specialty: +50% income (doubled with improvement)
      if (city.specialty === "market") {
        multiplier += city.improvement ? 1.0 : 0.5;
      }
      // Commerce skill bonus: best commerce character in city adds +10% per level
      const charsHere = characters.filter((c) => c.cityId === city.id);
      const bestCommerce = Math.max(0, ...charsHere.map((c) => getSkills(c).commerce));
      multiplier += bestCommerce * 0.1;
      // Governor role bonus: +20% income
      multiplier += this.roleGoldBonus(charsHere);
      // Commerce district: +80% income
      if (this.hasDistrict(city, "commerce")) multiplier += 0.8;
      // War exhaustion >50: -20% income
      const factionId = this.getFactionOf(city.controllerId);
      if (factionId && (this.warExhaustion.get(factionId) ?? 0) > 50) multiplier *= 0.8;
      const income = Math.round(baseIncome * multiplier * seasonMult);
      // Trade route bonus: +10 gold per active route
      const tradeBonus = this.tradeRoutesForCity(city.id).length * 10;
      await this.repo.updatePlace(city.id, { gold: city.gold + income + tradeBonus });
    }
  }

  private async resolveArrivals(): Promise<BattleResult[]> {
    const results: BattleResult[] = [];
    const movements = await this.repo.getActiveMovements(this.currentTick);
    const arrivals = movements.filter((m) => m.arrivalTick === this.currentTick);

    // Group arrivals by destination city
    const arrivalsByCity = new Map<string, typeof arrivals>();
    for (const a of arrivals) {
      const list = arrivalsByCity.get(a.destinationCityId) ?? [];
      list.push(a);
      arrivalsByCity.set(a.destinationCityId, list);
    }

    for (const [cityId, cityArrivals] of arrivalsByCity) {
      const city = await this.repo.getPlace(cityId);
      if (!city) continue;

      // Group arriving characters by faction
      const attackersByFaction = new Map<string, string[]>();
      for (const a of cityArrivals) {
        const faction = this.getFactionOf(a.characterId);
        if (!faction) continue;
        const controllerFaction = city.controllerId ? this.getFactionOf(city.controllerId) : null;
        // Skip if same faction or allied
        if (faction === controllerFaction) continue;
        if (controllerFaction && this.areAllied(faction, controllerFaction)) continue;
        const list = attackersByFaction.get(faction) ?? [];
        list.push(a.characterId);
        attackersByFaction.set(faction, list);
      }

      if (attackersByFaction.size === 0) continue;

      // Get all defenders in the city
      const allChars = await this.repo.getAllCharacters();
      const defenders = allChars.filter(
        (c) => c.cityId === cityId && city.controllerId && this.getFactionOf(c.id) === this.getFactionOf(city.controllerId),
      );

      // Defense power: sum of defender military stats + garrison bonus + city tier bonus
      const tierBonus = city.tier === "major" ? 3 : 1;
      const seasonDefBonus = SEASON_DEFENSE_BONUS[getSeason(this.currentTick)];
      let garrisonPower = city.garrison;
      // Forge specialty: garrison defense x1.5 (x2 with improvement)
      if (city.specialty === "forge") {
        let forgeMult = city.improvement ? 2 : 1.5;
        // Iron working tech: +50% forge effect
        const defenderFaction = city.controllerId ? this.getFactionOf(city.controllerId) : null;
        if (defenderFaction && this.hasTech(defenderFaction, "iron_working")) forgeMult *= 1.5;
        garrisonPower = Math.round(garrisonPower * forgeMult);
      }
      // Defense district: +2 garrison bonus
      if (this.hasDistrict(city, "defense")) garrisonPower += 2;
      let defensePower = garrisonPower + tierBonus + seasonDefBonus + Math.random() * 2;
      for (const d of defenders) {
        defensePower += d.military + d.intelligence * 0.5 + getSkills(d).tactics * 0.5 + Math.random() * 2;
      }

      // Each attacking faction battles independently
      for (const [attackFaction, attackerIds] of attackersByFaction) {
        let attackPower = Math.random() * 2;
        const attackChars: CharacterNode[] = [];
        // Determine tactic (player or NPC picks)
        const leadTactic = this.pendingTactics.get(attackerIds[0]) ?? (attackFaction !== "shu" ? this.npcPickTactic() : "balanced");
        const tacticMod = TACTIC_MODIFIERS[leadTactic];
        for (const id of attackerIds) {
          this.pendingTactics.delete(id);
          const c = await this.repo.getCharacter(id);
          if (c) {
            const base = c.military + c.intelligence * 0.5 + getSkills(c).tactics * 0.5 + Math.random() * 2;
            attackPower += base * (1 + this.roleAttackBonus(c));
            attackChars.push(c);
          }
        }
        // Apply tactic modifiers: attack bonus/penalty directly, defense modifier reduces effective enemy defense
        attackPower *= (1 + tacticMod.attack);
        const effectiveDefense = defensePower * (1 - tacticMod.defense);
        // Logistics tech bonus
        if (this.hasTech(attackFaction, "logistics")) {
          attackPower += 1;
        }
        // Morale bonus/penalty: high morale (80+) = +10% attack, low (<30) = -10%
        const attackerMorale = attackFaction ? this.getMorale(attackFaction) : 50;
        if (attackerMorale >= 80) attackPower *= 1.10;
        else if (attackerMorale < 30) attackPower *= 0.90;
        // Legacy bonus from prestigious dead characters
        const attackerLegacy = attackFaction ? this.getLegacyBonus(attackFaction) : 0;
        if (attackerLegacy > 0) attackPower += Math.min(attackerLegacy, 5);

        // Unit type counter modifier
        const attackerOriginCity = await this.repo.getPlace(cityArrivals[0]?.originCityId ?? "");
        const attackUnits = attackerOriginCity ? getUnitComposition(attackerOriginCity) : { ...DEFAULT_UNITS };
        const defendUnits = getUnitComposition(city);
        const unitMod = computeUnitModifier(attackUnits, defendUnits);
        attackPower *= (1 + unitMod.attackMod);
        const effectiveDefenseWithUnits = effectiveDefense * (1 + unitMod.defenseMod);

        const attackerWins = attackPower > effectiveDefenseWithUnits;
        const leadAttacker = attackChars[0];
        if (!leadAttacker) continue;

        if (attackerWins) {
          const newStatus = this.factionToStatus(attackFaction);
          await this.repo.updatePlace(city.id, {
            controllerId: leadAttacker.id,
            status: newStatus,
            garrison: Math.max(0, city.garrison - 1),
            siegedBy: undefined, siegeTick: undefined, // Clear siege on capture
          });
          // Growth: winner's military +1 (cap 10)
          for (const ac of attackChars) {
            if (ac.military < 10) {
              await this.repo.createCharacter({ ...ac, military: ac.military + 1, skills: gainSkill(ac, "tactics") });
            }
          }
        } else {
          // Failed attack: start or strengthen siege
          if (city.garrison > 0) {
            if (!city.siegedBy) {
              // Begin siege
              await this.repo.updatePlace(city.id, { siegedBy: attackFaction, siegeTick: this.currentTick });
            }
          }
        }

        const leadDefender = defenders[0] ?? (city.controllerId ? await this.repo.getCharacter(city.controllerId) : null);

        // Generate battle rounds for detailed report
        const rounds: BattleRound[] = [];
        const leadMil = Math.max(...attackChars.map((c) => c.military), 0);
        const leadTac = Math.max(...attackChars.map((c) => getSkills(c).tactics), 0);
        const leadInt = Math.max(...attackChars.map((c) => c.intelligence), 0);
        const defMil = defenders.length > 0 ? Math.max(...defenders.map((c) => c.military)) : 0;
        rounds.push({
          phase: "先鋒衝鋒",
          attackerDelta: Math.round(leadMil * 0.3 * 10) / 10,
          defenderDelta: Math.round(defMil * 0.2 * 10) / 10,
          note: leadAttacker ? `${leadAttacker.name} 率先衝鋒` : undefined,
        });
        rounds.push({
          phase: "戰術對決",
          attackerDelta: Math.round(leadTac * 0.5 * 10) / 10,
          defenderDelta: Math.round(garrisonPower * 0.3 * 10) / 10,
          note: leadTactic !== "balanced" ? `${leadTactic === "aggressive" ? "猛攻" : "堅守"}陣型` : undefined,
        });
        rounds.push({
          phase: "智謀交鋒",
          attackerDelta: Math.round(leadInt * 0.2 * 10) / 10,
          defenderDelta: Math.round((defenders[0]?.intelligence ?? 0) * 0.2 * 10) / 10,
          note: leadInt >= 4 ? `${attackChars.find((c) => c.intelligence === leadInt)?.name ?? ""}妙計退敵` : undefined,
        });

        results.push({
          tick: this.currentTick,
          cityId: city.id,
          cityName: city.name,
          attackerId: leadAttacker.id,
          attackerName: leadAttacker.name,
          defenderId: leadDefender?.id ?? null,
          defenderName: leadDefender?.name ?? null,
          winner: attackerWins ? "attacker" : "defender",
          captured: attackerWins,
          attackPower: Math.round(attackPower * 10) / 10,
          defensePower: Math.round(defensePower * 10) / 10,
          tactic: leadTactic,
          rounds,
        });

        // If captured, defenders can no longer defend against next attacker
        if (attackerWins) break;
      }
    }

    return results;
  }

  private npcPickTactic(): BattleTactic {
    const r = Math.random();
    if (r < 0.3) return "aggressive";
    if (r < 0.6) return "defensive";
    return "balanced";
  }

  private async processDeaths(battleResults: BattleResult[]): Promise<DeathEvent[]> {
    const events: DeathEvent[] = [];

    for (const battle of battleResults) {
      // Losing side characters have 15% death chance (aggressive tactic: 25%)
      const loserId = battle.winner === "attacker" ? battle.defenderId : battle.attackerId;
      if (!loserId) continue;
      if (this.deadCharacters.has(loserId)) continue;

      const tactic = battle.tactic ?? "balanced";
      const deathChance = tactic === "aggressive" && battle.winner === "defender" ? 0.25 : 0.15;
      if (Math.random() >= deathChance) continue;

      const loser = await this.repo.getCharacter(loserId);
      if (!loser) continue;

      const factionId = this.getFactionOf(loserId);
      if (!factionId) continue;
      const faction = FACTIONS.find((f) => f.id === factionId);
      if (!faction) continue;

      const wasLeader = faction.leaderId === loserId;

      // Remove from faction
      faction.members = faction.members.filter((m) => m !== loserId);

      // Remove from map
      await this.repo.createCharacter({ ...loser, cityId: undefined });
      this.deadCharacters.add(loserId);

      let successorId: string | undefined;
      let successorName: string | undefined;

      // Succession: pick highest military member
      if (wasLeader && faction.members.length > 0) {
        const allChars = await this.repo.getAllCharacters();
        const best = faction.members
          .map((id) => allChars.find((c) => c.id === id))
          .filter(Boolean)
          .sort((a, b) => (b!.military + b!.intelligence) - (a!.military + a!.intelligence))[0];
        if (best) {
          faction.leaderId = best.id;
          successorId = best.id;
          successorName = best.name;
        }
      }

      events.push({
        tick: this.currentTick,
        characterId: loserId,
        characterName: loser.name,
        cause: "battle",
        factionId,
        wasLeader,
        successorId,
        successorName,
      });
    }

    return events;
  }

  private breakTradeRoutesForSiegedCities(): void {
    const toRemove: string[] = [];
    for (const route of this.tradeRoutes) {
      // We'll check siege status lazily — just remove routes where faction lost control
      // This is called after battles resolve, so we check updated city status
    }
    // For simplicity, we clean up in advanceDay after siege processing
  }

  private async cleanupTradeRoutes(): Promise<void> {
    const cities = await this.repo.getAllPlaces();
    const cityMap = new Map(cities.map((c) => [c.id, c]));
    this.tradeRoutes = this.tradeRoutes.filter((r) => {
      const a = cityMap.get(r.cityA);
      const b = cityMap.get(r.cityB);
      // Remove if either city is sieged, or not controlled by the faction
      if (!a || !b) return false;
      if (a.siegedBy || b.siegedBy) return false;
      const factionMembers = FACTIONS.find((f) => f.id === r.factionId)?.members ?? [];
      if (!a.controllerId || !factionMembers.includes(a.controllerId)) return false;
      if (!b.controllerId || !factionMembers.includes(b.controllerId)) return false;
      return true;
    });
  }

  private async npcEstablishTrades(): Promise<void> {
    const cities = await this.repo.getAllPlaces();
    for (const faction of FACTIONS) {
      if (faction.id === "shu") continue;
      if (Math.random() > 0.15) continue; // 15% chance per turn

      const factionCities = cities.filter(
        (c) => c.controllerId && faction.members.includes(c.controllerId) && !c.siegedBy,
      );
      if (factionCities.length < 2) continue;

      // Pick two cities that don't already have a route between them
      for (let i = 0; i < factionCities.length; i++) {
        const a = factionCities[i];
        if (a.gold < 200 || this.tradeRoutesForCity(a.id).length >= 3) continue;
        for (let j = i + 1; j < factionCities.length; j++) {
          const b = factionCities[j];
          if (this.tradeRoutesForCity(b.id).length >= 3) continue;
          const dup = this.tradeRoutes.find(
            (r) => (r.cityA === a.id && r.cityB === b.id) || (r.cityA === b.id && r.cityB === a.id),
          );
          if (dup) continue;
          await this.repo.updatePlace(a.id, { gold: a.gold - 200 });
          this.tradeCounter++;
          this.tradeRoutes.push({
            id: `trade-${this.tradeCounter}`,
            cityA: a.id,
            cityB: b.id,
            factionId: faction.id,
            establishedTick: this.currentTick,
          });
          return; // One per turn per faction
        }
      }
    }
  }

  private async processRecruitments(battleResults: BattleResult[]): Promise<RecruitmentResult[]> {
    const results: RecruitmentResult[] = [];
    const allChars = await this.repo.getAllCharacters();

    for (const battle of battleResults) {
      if (!battle.captured) continue;

      const attacker = await this.repo.getCharacter(battle.attackerId);
      if (!attacker) continue;
      const attackerFaction = this.getFactionOf(battle.attackerId);
      if (!attackerFaction) continue;

      // Find enemy characters still in the captured city
      const capturedChars = allChars.filter((c) => {
        if (c.cityId !== battle.cityId) return false;
        const cFaction = this.getFactionOf(c.id);
        return cFaction && cFaction !== attackerFaction;
      });

      for (const captured of capturedChars) {
        // Cannot recruit faction leaders
        const capturedFaction = FACTIONS.find((f) => f.members.includes(captured.id));
        if (capturedFaction?.leaderId === captured.id) continue;

        // Check intimacy between attacker and captured
        const rels = this.engine.getRelationships();
        const rel = rels.find(
          (r) =>
            (r.sourceId === attacker.id && r.targetId === captured.id) ||
            (r.sourceId === captured.id && r.targetId === attacker.id),
        );
        const intimacy = rel?.intimacy ?? 30;

        // Base recruitment chance: 15% + intimacy/300 + charm bonus
        let chance = 0.15 + intimacy / 300 + attacker.charm * 0.03;

        // Trait modifiers
        if (captured.traits.includes("loyal")) chance -= 0.2;
        if (captured.traits.includes("treacherous")) chance += 0.2;

        chance = Math.max(0.05, Math.min(0.8, chance));
        const success = Math.random() < chance;

        if (success) {
          // Move character to attacker's faction
          if (capturedFaction) {
            capturedFaction.members = capturedFaction.members.filter((m) => m !== captured.id);
          }
          const newFaction = FACTIONS.find((f) => f.id === attackerFaction);
          if (newFaction) {
            newFaction.members.push(captured.id);
          }
          // Growth: recruiter's charm +1 (cap 10)
          if (attacker.charm < 10) {
            await this.repo.createCharacter({ ...attacker, charm: attacker.charm + 1, skills: gainSkill(attacker, "leadership") });
          }
        }

        results.push({
          tick: this.currentTick,
          recruiterId: attacker.id,
          recruiterName: attacker.name,
          targetId: captured.id,
          targetName: captured.name,
          success,
          newFaction: success ? attackerFaction : undefined,
        });
      }
    }

    return results;
  }

  private allianceKey(a: string, b: string): string {
    return [a, b].sort().join(":");
  }

  // ── Trust system ──
  private getTrust(fA: string, fB: string): number {
    return this.factionTrust.get(this.allianceKey(fA, fB)) ?? 50;
  }

  private adjustTrust(fA: string, fB: string, delta: number): void {
    const key = this.allianceKey(fA, fB);
    const cur = this.factionTrust.get(key) ?? 50;
    this.factionTrust.set(key, Math.max(0, Math.min(100, cur + delta)));
  }

  getFactionTrust(): Record<string, number> {
    const result: Record<string, number> = {};
    for (let i = 0; i < FACTIONS.length; i++) {
      for (let j = i + 1; j < FACTIONS.length; j++) {
        const key = this.allianceKey(FACTIONS[i].id, FACTIONS[j].id);
        result[key] = this.factionTrust.get(key) ?? 50;
      }
    }
    return result;
  }

  private async evaluateDiplomacy(): Promise<DiplomacyEvent[]> {
    const events: DiplomacyEvent[] = [];
    const rels = this.engine.getRelationships();

    // Check leader-to-leader relationships for alliance triggers
    for (let i = 0; i < FACTIONS.length; i++) {
      for (let j = i + 1; j < FACTIONS.length; j++) {
        const fA = FACTIONS[i];
        const fB = FACTIONS[j];
        const key = this.allianceKey(fA.id, fB.id);

        // Find relationship between leaders
        const rel = rels.find(
          (r) =>
            (r.sourceId === fA.leaderId && r.targetId === fB.leaderId) ||
            (r.sourceId === fB.leaderId && r.targetId === fA.leaderId),
        );
        if (!rel) continue;

        const isAllied = this.alliances.has(key);

        if (!isAllied && rel.intimacy >= 65) {
          // Form alliance
          this.alliances.add(key);
          events.push({
            tick: this.currentTick,
            type: "alliance_formed",
            factionA: fA.id,
            factionB: fB.id,
            description: `${fA.leaderId} 與 ${fB.leaderId} 結盟`,
          });
        } else if (isAllied && rel.intimacy <= 25) {
          // Break alliance
          this.alliances.delete(key);
          events.push({
            tick: this.currentTick,
            type: "alliance_broken",
            factionA: fA.id,
            factionB: fB.id,
            description: `${fA.leaderId} 與 ${fB.leaderId} 的同盟破裂`,
          });
        }
      }
    }

    return events;
  }

  private async processBetrayals(): Promise<BetrayalEvent[]> {
    const events: BetrayalEvent[] = [];
    const characters = await this.repo.getAllCharacters();
    const cities = await this.repo.getAllPlaces();
    const rels = this.engine.getRelationships();

    for (const faction of FACTIONS) {
      // Only non-leader members can betray
      for (const memberId of [...faction.members]) {
        if (memberId === faction.leaderId) continue;

        const char = characters.find((c) => c.id === memberId);
        if (!char) continue;

        // "loyal" trait: immune to betrayal
        if (char.traits.includes("loyal")) continue;

        // Base chance: 5%
        let chance = 0.05;

        // "treacherous" trait: double chance
        if (char.traits.includes("treacherous")) chance *= 2;

        // Low morale increases betrayal chance
        const morale = this.getMorale(faction.id);
        if (morale < 30) chance += 0.08;
        else if (morale < 50) chance += 0.03;

        // Low favorability increases betrayal chance
        const favorability = this.getFavorability(memberId);
        if (favorability < 25) chance += 0.10;
        else if (favorability < 40) chance += 0.04;

        // Faction at disadvantage (fewer cities) increases chance
        const factionCities = cities.filter(
          (c) => c.controllerId && faction.members.includes(c.controllerId),
        ).length;
        if (factionCities <= 1) chance += 0.05;

        // Check if character has high intimacy with rival faction leader
        let bestRivalFaction: string | null = null;
        let bestIntimacy = 0;
        for (const rival of FACTIONS) {
          if (rival.id === faction.id) continue;
          const rel = rels.find(
            (r) =>
              (r.sourceId === memberId && r.targetId === rival.leaderId) ||
              (r.sourceId === rival.leaderId && r.targetId === memberId),
          );
          if (rel && rel.intimacy > bestIntimacy) {
            bestIntimacy = rel.intimacy;
            bestRivalFaction = rival.id;
          }
        }

        // High intimacy with rival leader increases chance
        if (bestIntimacy >= 60) chance += 0.05;
        // Low intimacy with own leader increases chance
        const leaderRel = rels.find(
          (r) =>
            (r.sourceId === memberId && r.targetId === faction.leaderId) ||
            (r.sourceId === faction.leaderId && r.targetId === memberId),
        );
        if (leaderRel && leaderRel.intimacy <= 25) chance += 0.05;

        if (Math.random() >= chance || !bestRivalFaction) continue;

        // Betray: move to rival faction
        faction.members = faction.members.filter((m) => m !== memberId);
        const targetFaction = FACTIONS.find((f) => f.id === bestRivalFaction);
        if (targetFaction) {
          targetFaction.members.push(memberId);
        }

        events.push({
          tick: this.currentTick,
          characterId: memberId,
          characterName: char.name,
          oldFaction: faction.id,
          newFaction: bestRivalFaction,
        });
      }
    }

    return events;
  }

  areAllied(factionA: string, factionB: string): boolean {
    return this.alliances.has(this.allianceKey(factionA, factionB));
  }

  async proposeAlliance(factionId: string): Promise<{ success: boolean; reason: string }> {
    const playerFaction = "shu";
    if (factionId === playerFaction) return { success: false, reason: "Cannot ally with yourself" };
    const key = this.allianceKey(playerFaction, factionId);
    if (this.alliances.has(key)) return { success: false, reason: "Already allied" };

    // Check leader intimacy
    const playerLeader = FACTIONS.find((f) => f.id === playerFaction)?.leaderId;
    const targetLeader = FACTIONS.find((f) => f.id === factionId)?.leaderId;
    if (!playerLeader || !targetLeader) return { success: false, reason: "Faction not found" };

    const rels = this.engine.getRelationships();
    const rel = rels.find(
      (r) =>
        (r.sourceId === playerLeader && r.targetId === targetLeader) ||
        (r.sourceId === targetLeader && r.targetId === playerLeader),
    );
    const intimacy = rel?.intimacy ?? 0;

    if (intimacy < 40) return { success: false, reason: `親密度不足（${intimacy}/40）` };

    // Trust affects success rate: trust < 20 → impossible, trust 20-80 → scaled chance
    const trust = this.getTrust(playerFaction, factionId);
    if (trust < 20) return { success: false, reason: `信任度過低（${trust}/20）` };
    const trustBonus = (trust - 50) / 100; // -0.3 to +0.5
    const successChance = 0.5 + trustBonus + (intimacy - 40) / 200;
    if (Math.random() > Math.min(0.95, Math.max(0.1, successChance))) {
      return { success: false, reason: `${factionId} 拒絕結盟（信任度：${trust}）` };
    }

    this.alliances.add(key);
    this.adjustTrust(playerFaction, factionId, 10);
    // Track diplomacy achievement for player leader
    this.trackDiplomacy(playerLeader);
    this.addPrestige(playerLeader, 3);
    return { success: true, reason: `與 ${targetLeader} 結盟成功（信任度：${trust}→${this.getTrust(playerFaction, factionId)}）` };
  }

  async resolveEventCard(choiceIndex: number): Promise<{ success: boolean; description: string }> {
    if (!this.pendingCard) return { success: false, description: "No pending event card" };

    const card = this.pendingCard.card;
    const choice = card.choices[choiceIndex];
    if (!choice) return { success: false, description: "Invalid choice" };

    const playerFaction = FACTIONS.find((f) => f.id === "shu");
    if (!playerFaction) return { success: false, description: "Player faction not found" };

    const leader = await this.repo.getCharacter(playerFaction.leaderId);
    if (!leader) return { success: false, description: "Leader not found" };

    const cities = await this.repo.getAllPlaces();
    const alliedCities = cities.filter(
      (c) => c.controllerId && playerFaction.members.includes(c.controllerId),
    );

    const { cityUpdates, charUpdate } = applyEventCardChoice(choice, playerFaction.leaderId, alliedCities, leader);

    for (const { cityId, updates } of cityUpdates) {
      await this.repo.updatePlace(cityId, updates);
    }

    if (charUpdate) {
      await this.repo.createCharacter({ ...leader, ...charUpdate });
    }

    this.pendingCard = null;
    return { success: true, description: `${card.title}：${choice.label}` };
  }

  breakAlliance(factionId: string): { success: boolean; reason: string } {
    const playerFaction = "shu";
    const key = this.allianceKey(playerFaction, factionId);
    if (!this.alliances.has(key)) return { success: false, reason: "No alliance exists" };
    this.alliances.delete(key);
    this.adjustTrust(playerFaction, factionId, -20);
    return { success: true, reason: `Alliance broken（信任度 -20 → ${this.getTrust(playerFaction, factionId)}）` };
  }

  async getFactionStats(): Promise<{ id: string; name: string; color: string; gold: number; cities: number; characters: number; power: number; morale: number; legacy: number; exhaustion: number }[]> {
    const characters = await this.repo.getAllCharacters();
    const cities = await this.repo.getAllPlaces();
    const charMap = new Map(characters.map((c) => [c.id, c]));

    return FACTIONS.map((f) => {
      const leader = charMap.get(f.leaderId);
      const factionCities = cities.filter((c) => c.controllerId && f.members.includes(c.controllerId));
      const totalGold = factionCities.reduce((sum, c) => sum + c.gold, 0);
      const totalPower = f.members.reduce((sum, mId) => {
        const ch = charMap.get(mId);
        return sum + (ch ? ch.traits.length * 2 : 0);
      }, 0) + factionCities.reduce((sum, c) => sum + c.garrison, 0);

      return {
        id: f.id,
        name: leader?.name ?? f.leaderId,
        color: f.color,
        gold: totalGold,
        cities: factionCities.length,
        characters: f.members.length,
        power: totalPower,
        morale: this.getMorale(f.id),
        legacy: this.getLegacyBonus(f.id),
        exhaustion: this.warExhaustion.get(f.id) ?? 0,
      };
    });
  }

  async predictBattle(attackerIds: string[], cityId: string): Promise<{ winRate: number; attackPower: number; defensePower: number }> {
    const city = await this.repo.getPlace(cityId);
    if (!city) return { winRate: 0, attackPower: 0, defensePower: 0 };

    const allChars = await this.repo.getAllCharacters();
    const attackChars = attackerIds.map((id) => allChars.find((c) => c.id === id)).filter(Boolean) as CharacterNode[];
    const defenders = allChars.filter(
      (c) => c.cityId === cityId && city.controllerId && this.getFactionOf(c.id) === this.getFactionOf(city.controllerId),
    );

    const tierBonus = city.tier === "major" ? 3 : 1;

    // Simulate 100 times
    let wins = 0;
    let totalAtk = 0;
    let totalDef = 0;
    for (let i = 0; i < 100; i++) {
      let atkPower = Math.random() * 2;
      for (const c of attackChars) atkPower += c.military + c.intelligence * 0.5 + Math.random() * 2;

      let defPower = city.garrison + tierBonus + Math.random() * 2;
      for (const d of defenders) defPower += d.military + d.intelligence * 0.5 + Math.random() * 2;

      if (atkPower > defPower) wins++;
      totalAtk += atkPower;
      totalDef += defPower;
    }

    return {
      winRate: Math.round(wins),
      attackPower: Math.round((totalAtk / 100) * 10) / 10,
      defensePower: Math.round((totalDef / 100) * 10) / 10,
    };
  }

  async getVictoryStats(): Promise<{
    winType: WinType;
    tick: number;
    topCharacters: { id: string; name: string; prestige: number; achievements: string[] }[];
    factionStats: { id: string; cities: number; gold: number; characters: number }[];
  }> {
    const stats = await this.getFactionStats();
    // Top 3 characters by prestige
    const allPrestige = [...this.characterPrestige.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const allChars = await this.repo.getAllCharacters();
    const charMap = new Map(allChars.map((c) => [c.id, c]));
    const topCharacters = allPrestige.map(([id, prestige]) => ({
      id,
      name: charMap.get(id)?.name ?? id,
      prestige,
      achievements: this.characterAchievements.get(id) ?? [],
    }));
    return {
      winType: this.gameState.winType ?? "conquest",
      tick: this.currentTick,
      topCharacters,
      factionStats: stats.map((s) => ({ id: s.id, cities: s.cities, gold: s.gold, characters: s.characters })),
    };
  }

  getFactionHistory(): Record<string, FactionHistoryEntry[]> {
    const result: Record<string, FactionHistoryEntry[]> = {};
    for (const [id, entries] of this.factionHistory) {
      result[id] = [...entries];
    }
    return result;
  }

  private async recordFactionHistory(): Promise<void> {
    const stats = await this.getFactionStats();
    for (const s of stats) {
      const list = this.factionHistory.get(s.id) ?? [];
      list.push({ tick: this.currentTick, power: s.power, cities: s.cities, gold: s.gold, characters: s.characters, morale: s.morale });
      this.factionHistory.set(s.id, list);
    }
  }

  // ── Save / Load ──────────────────────────────────────────────────
  private savesDir(): string {
    return join(process.cwd(), "saves");
  }

  async saveGame(slot: number): Promise<{ slot: number; tick: number; savedAt: string }> {
    const dir = this.savesDir();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const characters = await this.repo.getAllCharacters();
    const places = await this.repo.getAllPlaces();
    const relationships = this.engine.getRelationships() as RelationshipEdge[];
    const allEvents = this.eventStore.getAll();
    const movements = await this.repo.getActiveMovements(this.currentTick);

    const data: SaveData = {
      version: 1,
      tick: this.currentTick,
      gameState: { ...this.gameState },
      factions: FACTIONS.map((f) => ({ ...f, members: [...f.members] })),
      alliances: [...this.alliances],
      characters,
      places,
      relationships,
      movements,
      events: allEvents.map(({ id: _id, ...rest }) => rest),
      dailySummaries: [...this.dailySummaries.entries()],
      factionHistory: [...this.factionHistory.entries()].map(([k, v]) => [k, [...v]]),
      initialRelationships: this.initialRelationships.map((r) => ({ ...r })),
      factionTech: [...this.factionTech.entries()].map(([k, v]) => [k, { ...v, completed: [...v.completed] }]),
      tradeRoutes: [...this.tradeRoutes],
      deadCharacters: [...this.deadCharacters],
      factionMorale: [...this.factionMorale.entries()],
      characterPrestige: [...this.characterPrestige.entries()],
      characterBattleCount: [...this.characterBattleCount.entries()],
      characterConquerCount: [...this.characterConquerCount.entries()],
      characterSpyCount: [...this.characterSpyCount.entries()],
      characterDiploCount: [...this.characterDiploCount.entries()],
      characterAchievements: [...this.characterAchievements.entries()],
      legacyBonuses: [...this.legacyBonuses.entries()],
      characterFavorability: [...this.characterFavorability.entries()],
      mentorPairs: [...this.mentorPairs],
      warExhaustion: [...this.warExhaustion.entries()],
      droughtCities: [...this.droughtCities.entries()],
      factionTrust: [...this.factionTrust.entries()],
      diplomaticVictoryTicks: this.diplomaticVictoryTicks,
      economicVictoryTicks: this.economicVictoryTicks,
      savedAt: new Date().toISOString(),
    };

    writeFileSync(join(dir, `slot-${slot}.json`), JSON.stringify(data), "utf-8");
    return { slot, tick: this.currentTick, savedAt: data.savedAt };
  }

  async loadGame(slot: number): Promise<{ tick: number; gameStatus: GameStatus }> {
    const filePath = join(this.savesDir(), `slot-${slot}.json`);
    if (!existsSync(filePath)) throw new Error(`Save slot ${slot} not found`);

    const data: SaveData = JSON.parse(readFileSync(filePath, "utf-8"));

    // Clear current state
    this.eventStore.clear();
    await this.repo.disconnect();
    await this.repo.connect();

    // Restore characters
    for (const c of data.characters) {
      await this.repo.createCharacter(c);
    }

    // Restore places
    for (const p of data.places) {
      await this.repo.createPlace(p);
    }

    // Restore movements
    for (const m of data.movements) {
      await this.repo.addMovement(m);
    }

    // Restore events
    if (data.events.length > 0) {
      this.eventStore.append(data.events);
    }

    // Rebuild engine
    this.engine = new Engine();
    this.engine.loadCharacters(data.characters);
    for (const r of data.relationships) {
      this.engine.loadRelationships([r]);
    }
    this.engine.world.setTick(data.tick);

    // Restore graph relationships
    for (const r of data.relationships) {
      await this.repo.setRelationship(r);
    }

    // Restore service state
    FACTIONS = data.factions.map((f) => ({ ...f, members: [...f.members] }));
    this.alliances = new Set(data.alliances);
    this.gameState = { ...data.gameState };
    this.dailySummaries = new Map(data.dailySummaries);
    this.factionHistory = new Map(data.factionHistory.map(([k, v]) => [k, [...v]]));
    this.initialRelationships = data.initialRelationships.map((r) => ({ ...r }));
    this.commandQueue = [];
    this.commandedThisTick.clear();
    this.factionTech = new Map((data.factionTech ?? []).map(([k, v]) => [k, { ...v, completed: [...v.completed] }]));
    this.tradeRoutes = data.tradeRoutes ?? [];
    this.deadCharacters = new Set(data.deadCharacters ?? []);
    this.pendingTactics.clear();
    this.factionMorale = new Map(data.factionMorale ?? []);
    this.characterPrestige = new Map(data.characterPrestige ?? []);
    this.characterBattleCount = new Map(data.characterBattleCount ?? []);
    this.characterConquerCount = new Map(data.characterConquerCount ?? []);
    this.characterSpyCount = new Map(data.characterSpyCount ?? []);
    this.characterDiploCount = new Map(data.characterDiploCount ?? []);
    this.characterAchievements = new Map((data.characterAchievements ?? []).map(([k, v]) => [k, [...v]]));
    this.legacyBonuses = new Map(data.legacyBonuses ?? []);
    this.characterFavorability = new Map(data.characterFavorability ?? []);
    this.mentorPairs = data.mentorPairs ?? [];
    this.warExhaustion = new Map(data.warExhaustion ?? []);
    this.droughtCities = new Map(data.droughtCities ?? []);
    this.factionTrust = new Map(data.factionTrust ?? []);
    this.diplomaticVictoryTicks = data.diplomaticVictoryTicks ?? 0;
    this.economicVictoryTicks = data.economicVictoryTicks ?? 0;

    // Re-init narrative service
    const characters = await this.repo.getAllCharacters();
    const characterMap = new Map(characters.map((c) => [c.id, c]));
    this.narrative = new NarrativeService(characterMap);

    return { tick: data.tick, gameStatus: data.gameState.status };
  }

  listSaves(): { slot: number; tick: number; savedAt: string }[] {
    const dir = this.savesDir();
    if (!existsSync(dir)) return [];
    const results: { slot: number; tick: number; savedAt: string }[] = [];
    for (let slot = 1; slot <= 3; slot++) {
      const filePath = join(dir, `slot-${slot}.json`);
      if (!existsSync(filePath)) continue;
      try {
        const data: SaveData = JSON.parse(readFileSync(filePath, "utf-8"));
        results.push({ slot, tick: data.tick, savedAt: data.savedAt });
      } catch {
        // Corrupted save, skip
      }
    }
    return results;
  }

  private async processEliminatedFactions(): Promise<void> {
    const cities = await this.repo.getAllPlaces();

    for (const faction of FACTIONS) {
      if (faction.id === "shu") continue; // Player elimination handled by checkGameOver
      if (faction.members.length === 0) continue; // Already eliminated

      const factionCities = cities.filter(
        (c) => c.controllerId && faction.members.includes(c.controllerId),
      );

      if (factionCities.length > 0) continue; // Still has cities, not eliminated

      // Faction has no cities — scatter members to the strongest rival
      const survivingFactions = FACTIONS.filter(
        (f) => f.id !== faction.id && f.members.length > 0,
      );
      if (survivingFactions.length === 0) continue;

      // Find strongest rival by city count
      const strongest = survivingFactions.reduce((best, f) => {
        const count = cities.filter(
          (c) => c.controllerId && f.members.includes(c.controllerId),
        ).length;
        const bestCount = cities.filter(
          (c) => c.controllerId && best.members.includes(c.controllerId),
        ).length;
        return count > bestCount ? f : best;
      });

      // Move all non-leader members to strongest faction
      const scattered = [...faction.members].filter((m) => m !== faction.leaderId);
      for (const memberId of scattered) {
        faction.members = faction.members.filter((m) => m !== memberId);
        strongest.members.push(memberId);
      }

      // Leader is also absorbed
      faction.members = faction.members.filter((m) => m !== faction.leaderId);
      strongest.members.push(faction.leaderId);

      // Clear any alliances involving this faction
      for (const key of [...this.alliances]) {
        if (key.includes(faction.id)) {
          this.alliances.delete(key);
        }
      }
    }
  }

  private async checkGameOver(): Promise<GameStatus> {
    const cities = await this.repo.getAllPlaces();
    const majorCities = cities.filter((c) => c.tier === "major");

    // Count major cities per faction
    const factionMajors = new Map<string, number>();
    for (const city of majorCities) {
      if (!city.controllerId) continue;
      const faction = this.getFactionOf(city.controllerId);
      if (faction) {
        factionMajors.set(faction, (factionMajors.get(faction) ?? 0) + 1);
      }
    }

    // Victory: one faction controls all major cities
    for (const [factionId, count] of factionMajors) {
      if (count >= majorCities.length) {
        this.gameState = {
          status: factionId === "shu" ? "victory" : "defeat",
          winnerFaction: factionId,
          winType: "conquest",
          tick: this.currentTick,
        };
        return this.gameState.status;
      }
    }

    // Diplomatic victory: shu allied with ALL surviving factions for 10 consecutive ticks
    const survivingFactions = FACTIONS.filter((f) => f.id !== "shu" && f.members.length > 0);
    const allAllied = survivingFactions.length > 0 && survivingFactions.every((f) => {
      const key = ["shu", f.id].sort().join(":");
      return this.alliances.has(key);
    });
    if (allAllied) {
      this.diplomaticVictoryTicks++;
      if (this.diplomaticVictoryTicks >= 10) {
        this.gameState = { status: "victory", winnerFaction: "shu", tick: this.currentTick, winType: "diplomacy" };
        return "victory";
      }
    } else {
      this.diplomaticVictoryTicks = 0;
    }

    // Economic victory: shu's total gold > 80% of all factions' combined gold for 5 ticks
    const allCities = cities;
    let shuGold = 0;
    let totalGold = 0;
    for (const city of allCities) {
      if (!city.controllerId) continue;
      totalGold += city.gold;
      if (FACTIONS[0].members.includes(city.controllerId)) shuGold += city.gold;
    }
    if (totalGold > 0 && shuGold / totalGold >= 0.8) {
      this.economicVictoryTicks++;
      if (this.economicVictoryTicks >= 5) {
        this.gameState = { status: "victory", winnerFaction: "shu", tick: this.currentTick, winType: "economy" };
        return "victory";
      }
    } else {
      this.economicVictoryTicks = 0;
    }

    // Defeat: player faction has no cities at all
    const playerCities = cities.filter(
      (c) => c.controllerId && FACTIONS[0].members.includes(c.controllerId),
    );
    if (playerCities.length === 0 && this.currentTick > 0) {
      this.gameState = { status: "defeat", tick: this.currentTick };
      return "defeat";
    }

    return "ongoing";
  }

  private factionToStatus(factionId: string | null): "allied" | "hostile" | "neutral" {
    if (factionId === "shu") return "allied";
    if (factionId === "wei" || factionId === "lu_bu") return "hostile";
    return "neutral";
  }
}

interface SaveData {
  version: 1;
  tick: number;
  gameState: GameState;
  factions: { id: string; leaderId: string; members: string[]; color: string }[];
  alliances: string[];
  characters: CharacterNode[];
  places: PlaceNode[];
  relationships: RelationshipEdge[];
  movements: { characterId: string; originCityId: string; destinationCityId: string; departureTick: number; arrivalTick: number }[];
  events: Omit<StoredEvent, "id">[];
  dailySummaries: [number, string][];
  factionHistory: [string, FactionHistoryEntry[]][];
  initialRelationships: RelationshipEdge[];
  factionTech: [string, FactionTechState][];
  tradeRoutes: TradeRoute[];
  deadCharacters: string[];
  factionMorale: [string, number][];
  characterPrestige: [string, number][];
  characterBattleCount: [string, number][];
  characterConquerCount: [string, number][];
  characterSpyCount: [string, number][];
  characterDiploCount: [string, number][];
  characterAchievements: [string, string[]][];
  legacyBonuses: [string, number][];
  characterFavorability: [string, number][];
  mentorPairs: MentorPair[];
  warExhaustion: [string, number][];
  droughtCities: [string, number][];
  factionTrust: [string, number][];
  diplomaticVictoryTicks: number;
  economicVictoryTicks: number;
  savedAt: string;
}

function deriveType(intimacy: number): "friend" | "rival" | "neutral" {
  if (intimacy >= 60) return "friend";
  if (intimacy <= 30) return "rival";
  return "neutral";
}
