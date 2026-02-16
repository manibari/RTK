import { Engine, type SimulationEvent } from "@rtk/simulation";
import type { IGraphRepository, RelationshipEdge, CharacterGraph } from "@rtk/graph-db";
import type { IEventStore, StoredEvent } from "./event-store/types.js";

export interface TimelinePoint {
  tick: number;
  intimacy: number;
}

export class SimulationService {
  private engine: Engine;
  private repo: IGraphRepository;
  private eventStore: IEventStore;
  private initialRelationships: RelationshipEdge[] = [];

  constructor(repo: IGraphRepository, eventStore: IEventStore) {
    this.engine = new Engine();
    this.repo = repo;
    this.eventStore = eventStore;
  }

  async init(): Promise<void> {
    const characters = await this.repo.getAllCharacters();
    this.engine.loadCharacters(characters);

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

  async advanceDay(): Promise<StoredEvent[]> {
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
    }));

    if (storedEvents.length > 0) {
      this.eventStore.append(storedEvents);
    }

    const updatedRels = this.engine.getRelationships();
    for (const rel of updatedRels) {
      await this.repo.setRelationship(rel);
    }

    return this.eventStore.getByTickRange(this.currentTick, this.currentTick);
  }

  /**
   * Compute the relationship graph at a specific past tick by replaying events.
   */
  async getGraphAtTick(centerId: string, depth: number, tick: number): Promise<CharacterGraph> {
    // If tick >= currentTick, return live state
    if (tick >= this.currentTick) {
      return this.repo.getCharacterGraph(centerId, depth);
    }

    // Start from initial relationships and replay events up to the requested tick
    const snapshotRels = this.computeRelationshipsAtTick(tick);

    // Get full live graph for structure (characters + connectivity)
    const liveGraph = await this.repo.getCharacterGraph(centerId, depth);

    // Replace intimacy/type values with snapshot values
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

  /**
   * Get intimacy timeline for a pair of characters.
   * Returns one data point per tick from tick 0 (initial) through currentTick.
   */
  getIntimacyTimeline(actorId: string, targetId: string): TimelinePoint[] {
    const events = this.eventStore.getByPair(actorId, targetId);

    // Find initial intimacy for this pair
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
    // Clone initial state
    const relMap = new Map<string, RelationshipEdge>();
    for (const r of this.initialRelationships) {
      const key = [r.sourceId, r.targetId].sort().join(":");
      relMap.set(key, { ...r });
    }

    // Replay events up to the target tick
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
}

function deriveType(intimacy: number): "friend" | "rival" | "neutral" {
  if (intimacy >= 60) return "friend";
  if (intimacy <= 30) return "rival";
  return "neutral";
}
