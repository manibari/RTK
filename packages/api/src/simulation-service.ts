import { Engine } from "@rtk/simulation";
import type { IGraphRepository, RelationshipEdge, CharacterGraph, CharacterNode, PlaceNode } from "@rtk/graph-db";
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

export interface AdvanceDayResult {
  tick: number;
  events: StoredEvent[];
  dailySummary: string;
  battleResults: BattleResult[];
  diplomacyEvents: DiplomacyEvent[];
  recruitmentResults: RecruitmentResult[];
  betrayalEvents: BetrayalEvent[];
  pendingCard: PendingEventCard | null;
  gameStatus: GameStatus;
}

export interface DiplomacyEvent {
  tick: number;
  type: "alliance_formed" | "alliance_broken" | "betrayal";
  factionA: string;
  factionB: string;
  description: string;
}

export type GameStatus = "ongoing" | "victory" | "defeat";

export interface GameState {
  status: GameStatus;
  winnerFaction?: string;
  tick: number;
}

export interface PlayerCommand {
  type: "move" | "attack" | "recruit" | "reinforce" | "develop" | "build_improvement";
  characterId: string;
  targetCityId: string;
  targetCharacterId?: string; // for recruit
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

  async advanceDay(): Promise<AdvanceDayResult> {
    // Prevent advancing after game ends
    if (this.gameState.status !== "ongoing") {
      return {
        tick: this.currentTick,
        events: [],
        dailySummary: "",
        battleResults: [],
        diplomacyEvents: [],
        recruitmentResults: [],
        betrayalEvents: [],
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

    // City economy: produce gold
    await this.produceGold();

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

    // Evaluate diplomacy
    const diplomacyEvents = await this.evaluateDiplomacy();

    // Betrayal: disloyal characters may defect
    const betrayalEvents = await this.processBetrayals();

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
      return { tick: this.currentTick, events: updatedEvents, dailySummary, battleResults, diplomacyEvents, recruitmentResults, betrayalEvents, pendingCard, gameStatus };
    }

    return { tick: this.currentTick, events: tickEvents, dailySummary, battleResults, diplomacyEvents, recruitmentResults, betrayalEvents, pendingCard, gameStatus };
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
      // Harbor specialty: travel time = 1 from harbor cities
      const originCity = cities.find((c) => c.id === char.cityId);
      const baseTravelTime = decision.action === "attack" ? 1 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 3);
      const travelTime = originCity?.specialty === "harbor" ? 1 : baseTravelTime;

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

      const char = await this.repo.getCharacter(cmd.characterId);
      if (!char || !char.cityId) continue;
      if (char.cityId === cmd.targetCityId) continue;

      this.commandedThisTick.add(cmd.characterId);
      // Harbor specialty: travel time = 1 from harbor cities
      const originCity = cities.find((c) => c.id === char.cityId);
      const baseTravelTime = cmd.type === "attack" ? 1 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 3);
      const travelTime = originCity?.specialty === "harbor" ? 1 : baseTravelTime;

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
      // Harbor specialty: travel time = 1 from harbor cities
      const originCity = cities.find((c) => c.id === char.cityId);
      const travelTime = originCity?.specialty === "harbor" ? 1 : 1 + Math.floor(Math.random() * 3);

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

  private async processSpecialtyPassives(): Promise<void> {
    const tick = this.currentTick;
    const interval = 5; // every 5 ticks
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
      const siegeDelay = city.specialty === "granary" ? (city.improvement ? 6 : 4) : 2;
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
    for (const city of cities) {
      if (city.status === "dead" || !city.controllerId) continue;
      // Sieged cities produce no gold
      if (city.siegedBy) continue;
      const baseIncome = city.tier === "major" ? 100 : 50;
      let multiplier = 1 + city.development * 0.3;
      // Market specialty: +50% income (doubled with improvement)
      if (city.specialty === "market") {
        multiplier += city.improvement ? 1.0 : 0.5;
      }
      const income = Math.round(baseIncome * multiplier);
      await this.repo.updatePlace(city.id, { gold: city.gold + income });
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
      let garrisonPower = city.garrison;
      // Forge specialty: garrison defense x1.5 (x2 with improvement)
      if (city.specialty === "forge") {
        garrisonPower = Math.round(garrisonPower * (city.improvement ? 2 : 1.5));
      }
      let defensePower = garrisonPower + tierBonus + Math.random() * 2;
      for (const d of defenders) {
        defensePower += d.military + d.intelligence * 0.5 + Math.random() * 2;
      }

      // Each attacking faction battles independently
      for (const [attackFaction, attackerIds] of attackersByFaction) {
        let attackPower = Math.random() * 2;
        const attackChars: CharacterNode[] = [];
        for (const id of attackerIds) {
          const c = await this.repo.getCharacter(id);
          if (c) {
            attackPower += c.military + c.intelligence * 0.5 + Math.random() * 2;
            attackChars.push(c);
          }
        }

        const attackerWins = attackPower > defensePower;
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
              await this.repo.createCharacter({ ...ac, military: ac.military + 1 });
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
        });

        // If captured, defenders can no longer defend against next attacker
        if (attackerWins) break;
      }
    }

    return results;
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
            await this.repo.createCharacter({ ...attacker, charm: attacker.charm + 1 });
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

    this.alliances.add(key);
    return { success: true, reason: `與 ${targetLeader} 結盟成功` };
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
    return { success: true, reason: "Alliance broken" };
  }

  async getFactionStats(): Promise<{ id: string; name: string; color: string; gold: number; cities: number; characters: number; power: number; }[]> {
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
      list.push({ tick: this.currentTick, power: s.power, cities: s.cities, gold: s.gold, characters: s.characters });
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
          tick: this.currentTick,
        };
        return this.gameState.status;
      }
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
  savedAt: string;
}

function deriveType(intimacy: number): "friend" | "rival" | "neutral" {
  if (intimacy >= 60) return "friend";
  if (intimacy <= 30) return "rival";
  return "neutral";
}
