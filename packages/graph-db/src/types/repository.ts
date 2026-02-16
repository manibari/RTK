import type { CharacterNode, RelationshipEdge, CharacterGraph } from "./graph.js";

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

  // Graph queries
  getCharacterGraph(centerId: string, depth: number): Promise<CharacterGraph>;

  // Lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}
