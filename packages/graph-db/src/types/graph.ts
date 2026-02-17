export interface CharacterNode {
  id: string;
  name: string;
  traits: string[];
  cityId?: string;
  military: number;
  intelligence: number;
  charm: number;
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

export type CityStatus = "allied" | "hostile" | "neutral" | "dead";

export interface PlaceNode {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: CityStatus;
  tier: "major" | "minor";
  controllerId?: string;
  gold: number;
  garrison: number;
  development: number;
  siegedBy?: string;
  siegeTick?: number;
}

export interface Movement {
  characterId: string;
  originCityId: string;
  destinationCityId: string;
  departureTick: number;
  arrivalTick: number;
}

export interface CharacterGraph {
  center: CharacterNode;
  characters: CharacterNode[];
  relationships: RelationshipEdge[];
}

export interface MapData {
  cities: PlaceNode[];
  characters: (CharacterNode & { cityId: string })[];
  movements: Movement[];
}
