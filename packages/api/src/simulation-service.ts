import { Engine } from "@rtk/simulation";
import type { IGraphRepository, RelationshipEdge, CharacterGraph, CharacterNode, PlaceNode } from "@rtk/graph-db";
import type { IEventStore, StoredEvent } from "./event-store/types.js";
import { NarrativeService } from "./narrative/narrative-service.js";
import { evaluateNPCDecisions } from "./ai/npc-ai.js";

export interface TimelinePoint {
  tick: number;
  intimacy: number;
}

export interface AdvanceDayResult {
  tick: number;
  events: StoredEvent[];
  dailySummary: string;
  battleResults: BattleResult[];
  diplomacyEvents: DiplomacyEvent[];
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
  type: "move" | "attack";
  characterId: string;
  targetCityId: string;
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
}

export interface FactionInfo {
  id: string;
  leaderId: string;
  leaderName: string;
  members: string[];
  cities: string[];
  color: string;
}

// Faction definitions
const FACTIONS: { id: string; leaderId: string; members: string[]; color: string }[] = [
  { id: "shu", leaderId: "liu_bei", members: ["liu_bei", "guan_yu", "zhang_fei", "zhuge_liang", "zhao_yun"], color: "#3b82f6" },
  { id: "wei", leaderId: "cao_cao", members: ["cao_cao"], color: "#ef4444" },
  { id: "wu", leaderId: "sun_quan", members: ["sun_quan", "zhou_yu"], color: "#22c55e" },
  { id: "lu_bu", leaderId: "lu_bu", members: ["lu_bu", "diao_chan"], color: "#a855f7" },
];

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

  constructor(repo: IGraphRepository, eventStore: IEventStore) {
    this.engine = new Engine();
    this.repo = repo;
    this.eventStore = eventStore;
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

    // Execute player commands
    await this.executeCommands();

    // NPC AI decisions
    await this.runNPCDecisions();

    // Generate random movements for remaining idle characters (10%)
    await this.generateMovements();

    // Resolve arrivals and battles
    const battleResults = await this.resolveArrivals();

    // Evaluate diplomacy
    const diplomacyEvents = await this.evaluateDiplomacy();

    // Check win/defeat conditions
    const gameStatus = await this.checkGameOver();

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
      return { tick: this.currentTick, events: updatedEvents, dailySummary, battleResults, diplomacyEvents, gameStatus };
    }

    return { tick: this.currentTick, events: tickEvents, dailySummary, battleResults, diplomacyEvents, gameStatus };
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

    const decisions = evaluateNPCDecisions(FACTIONS, characters, cities, "shu");

    for (const decision of decisions) {
      if (decision.action === "stay" || !decision.targetCityId) continue;
      if (this.commandedThisTick.has(decision.characterId)) continue;

      const char = await this.repo.getCharacter(decision.characterId);
      if (!char?.cityId || char.cityId === decision.targetCityId) continue;

      this.commandedThisTick.add(decision.characterId);
      const travelTime = decision.action === "attack" ? 1 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 3);

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

    for (const cmd of commands) {
      const char = await this.repo.getCharacter(cmd.characterId);
      if (!char || !char.cityId) continue;
      if (char.cityId === cmd.targetCityId) continue;

      this.commandedThisTick.add(cmd.characterId);
      const travelTime = cmd.type === "attack" ? 1 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 3);

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
      const travelTime = 1 + Math.floor(Math.random() * 3);

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

  private async resolveArrivals(): Promise<BattleResult[]> {
    const results: BattleResult[] = [];
    const movements = await this.repo.getActiveMovements(this.currentTick);

    // Find movements that arrive this tick
    const arrivals = movements.filter((m) => m.arrivalTick === this.currentTick);

    for (const arrival of arrivals) {
      const city = await this.repo.getPlace(arrival.destinationCityId);
      if (!city) continue;

      const arriverFaction = this.getFactionOf(arrival.characterId);
      const controllerFaction = city.controllerId ? this.getFactionOf(city.controllerId) : null;

      // No battle if same faction, uncontrolled, or allied
      if (!city.controllerId || arriverFaction === controllerFaction) continue;
      if (arriverFaction && controllerFaction && this.areAllied(arriverFaction, controllerFaction)) continue;

      const attacker = await this.repo.getCharacter(arrival.characterId);
      const defender = city.controllerId ? await this.repo.getCharacter(city.controllerId) : null;
      if (!attacker) continue;

      // Battle resolution: compare trait counts + random factor
      const attackPower = attacker.traits.length + Math.random() * 3;
      const defensePower = defender ? defender.traits.length + Math.random() * 3 : Math.random() * 2;

      const attackerWins = attackPower > defensePower;

      if (attackerWins) {
        // Attacker captures city
        const newStatus = this.factionToStatus(arriverFaction);
        await this.repo.updatePlace(city.id, {
          controllerId: attacker.id,
          status: newStatus,
        });
      }

      results.push({
        tick: this.currentTick,
        cityId: city.id,
        cityName: city.name,
        attackerId: attacker.id,
        attackerName: attacker.name,
        defenderId: defender?.id ?? null,
        defenderName: defender?.name ?? null,
        winner: attackerWins ? "attacker" : "defender",
        captured: attackerWins,
      });
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

  areAllied(factionA: string, factionB: string): boolean {
    return this.alliances.has(this.allianceKey(factionA, factionB));
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

function deriveType(intimacy: number): "friend" | "rival" | "neutral" {
  if (intimacy >= 60) return "friend";
  if (intimacy <= 30) return "rival";
  return "neutral";
}
