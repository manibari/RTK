import type { IGraphRepository } from "../types/repository.js";
import type { CharacterNode, RelationshipEdge, CharacterGraph, PlaceNode, Movement, MapData } from "../types/graph.js";

export class InMemoryGraphRepository implements IGraphRepository {
  private characters = new Map<string, CharacterNode>();
  private relationships = new Map<string, RelationshipEdge>(); // key: "sourceId->targetId"
  private places = new Map<string, PlaceNode>();
  private movements: Movement[] = [];

  private edgeKey(sourceId: string, targetId: string): string {
    return `${sourceId}->${targetId}`;
  }

  async connect(): Promise<void> {
    // no-op for in-memory
  }

  async disconnect(): Promise<void> {
    this.characters.clear();
    this.relationships.clear();
    this.places.clear();
    this.movements = [];
  }

  async createCharacter(character: CharacterNode): Promise<void> {
    this.characters.set(character.id, { ...character });
  }

  async getCharacter(id: string): Promise<CharacterNode | null> {
    return this.characters.get(id) ?? null;
  }

  async getAllCharacters(): Promise<CharacterNode[]> {
    return [...this.characters.values()];
  }

  async setRelationship(edge: RelationshipEdge): Promise<void> {
    this.relationships.set(this.edgeKey(edge.sourceId, edge.targetId), { ...edge });
  }

  async getRelationship(sourceId: string, targetId: string): Promise<RelationshipEdge | null> {
    return this.relationships.get(this.edgeKey(sourceId, targetId)) ?? null;
  }

  async getRelationshipsOf(characterId: string): Promise<RelationshipEdge[]> {
    return [...this.relationships.values()].filter(
      (r) => r.sourceId === characterId || r.targetId === characterId,
    );
  }

  // Place operations
  async createPlace(place: PlaceNode): Promise<void> {
    this.places.set(place.id, { ...place });
  }

  async getPlace(id: string): Promise<PlaceNode | null> {
    return this.places.get(id) ?? null;
  }

  async getAllPlaces(): Promise<PlaceNode[]> {
    return [...this.places.values()];
  }

  async updatePlace(id: string, updates: Partial<Omit<PlaceNode, "id">>): Promise<void> {
    const place = this.places.get(id);
    if (place) {
      this.places.set(id, { ...place, ...updates });
    }
  }

  // Movement operations
  async addMovement(movement: Movement): Promise<void> {
    this.movements.push({ ...movement });
  }

  async getActiveMovements(tick: number): Promise<Movement[]> {
    return this.movements.filter(
      (m) => m.departureTick <= tick && m.arrivalTick >= tick,
    );
  }

  // Map queries
  async getMapData(tick: number): Promise<MapData> {
    const allCities = await this.getAllPlaces();
    const allChars = await this.getAllCharacters();
    const activeMovements = await this.getActiveMovements(tick);

    const charsWithCity = allChars
      .filter((c) => c.cityId)
      .map((c) => ({ ...c, cityId: c.cityId! }));

    return {
      cities: allCities,
      characters: charsWithCity,
      movements: activeMovements,
    };
  }

  async getCharacterGraph(centerId: string, depth: number): Promise<CharacterGraph> {
    const center = this.characters.get(centerId);
    if (!center) {
      return { center: { id: centerId, name: "", traits: [], military: 0, intelligence: 0, charm: 0 }, characters: [], relationships: [] };
    }

    const visited = new Set<string>([centerId]);
    const queue: { id: string; currentDepth: number }[] = [{ id: centerId, currentDepth: 0 }];
    const collectedCharacters: CharacterNode[] = [];
    const collectedRelationships: RelationshipEdge[] = [];

    while (queue.length > 0) {
      const { id, currentDepth } = queue.shift()!;
      if (currentDepth >= depth) continue;

      const edges = await this.getRelationshipsOf(id);
      for (const edge of edges) {
        collectedRelationships.push(edge);

        const neighborId = edge.sourceId === id ? edge.targetId : edge.sourceId;
        if (visited.has(neighborId)) continue;

        visited.add(neighborId);
        const neighbor = this.characters.get(neighborId);
        if (neighbor) {
          collectedCharacters.push(neighbor);
          queue.push({ id: neighborId, currentDepth: currentDepth + 1 });
        }
      }
    }

    // Deduplicate relationships
    const uniqueEdges = new Map<string, RelationshipEdge>();
    for (const r of collectedRelationships) {
      const key = this.edgeKey(r.sourceId, r.targetId);
      uniqueEdges.set(key, r);
    }

    return {
      center,
      characters: collectedCharacters,
      relationships: [...uniqueEdges.values()],
    };
  }
}
