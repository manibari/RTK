import type { CharacterNode, RelationshipEdge, CharacterGraph, PlaceNode, Movement, MapData } from "./graph.js";

/**
 * Abstract interface for graph data access.
 * Implementations: Neo4jGraphRepository (dev), EmbeddedGraphRepository (production/packaged).
 */
export interface IGraphRepository {
  // Character operations
  createCharacter(character: CharacterNode): Promise<void>;
  getCharacter(id: string): Promise<CharacterNode | null>;
  getAllCharacters(): Promise<CharacterNode[]>;

  // Relationship operations
  setRelationship(edge: RelationshipEdge): Promise<void>;
  getRelationship(sourceId: string, targetId: string): Promise<RelationshipEdge | null>;
  getRelationshipsOf(characterId: string): Promise<RelationshipEdge[]>;

  // Place operations
  createPlace(place: PlaceNode): Promise<void>;
  getPlace(id: string): Promise<PlaceNode | null>;
  getAllPlaces(): Promise<PlaceNode[]>;
  updatePlace(id: string, updates: Partial<Omit<PlaceNode, "id">>): Promise<void>;

  // Movement operations
  addMovement(movement: Movement): Promise<void>;
  getActiveMovements(tick: number): Promise<Movement[]>;

  // Map queries
  getMapData(tick: number): Promise<MapData>;

  // Graph queries
  getCharacterGraph(centerId: string, depth: number): Promise<CharacterGraph>;

  // Lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}
