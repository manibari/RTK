export interface CharacterNode {
  id: string;
  name: string;
  traits: string[];
}

export interface RelationshipEdge {
  sourceId: string;
  targetId: string;
  intimacy: number;
  relationshipType: "friend" | "rival" | "neutral";
}

export interface EventNode {
  id: string;
  type: string;
  tick: number;
  timestamp: number;
}

export interface PlaceNode {
  id: string;
  name: string;
}

export interface CharacterGraph {
  center: CharacterNode;
  characters: CharacterNode[];
  relationships: RelationshipEdge[];
}
