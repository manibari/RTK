export interface CharacterSkills {
  leadership: number;  // alliance stability, charm bonus
  tactics: number;     // siege/defense bonus
  commerce: number;    // gold production bonus
  espionage: number;   // spy mission success rate
}

export type CharacterRole = "general" | "governor" | "diplomat" | "spymaster";

export interface CharacterNode {
  id: string;
  name: string;
  biography?: string;
  avatarUrl?: string;
  traits: string[];
  cityId?: string;
  military: number;
  intelligence: number;
  charm: number;
  skills?: CharacterSkills;
  role?: CharacterRole;
  bornTick?: number;
  parentId?: string;
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

export type CitySpecialty = "military_academy" | "forge" | "harbor" | "library" | "market" | "granary";

export type DistrictType = "defense" | "commerce" | "agriculture" | "recruitment";

export interface District {
  type: DistrictType;
  builtTick: number;
}

export type UnitType = "infantry" | "cavalry" | "archers";

export interface UnitComposition {
  infantry: number;
  cavalry: number;
  archers: number;
}

export type CityPath = "fortress" | "trade_hub" | "cultural" | "breadbasket";

export interface PlaceNode {
  id: string;
  name: string;
  description?: string;
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
  specialty?: CitySpecialty;
  improvement?: string;
  districts?: District[];
  food?: number;
  units?: UnitComposition;
  path?: CityPath;
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

export type SpyMissionType = "intel" | "sabotage" | "blockade";
export type SpyMissionStatus = "traveling" | "infiltrated" | "success" | "caught";

export interface SpyMission {
  id: string;
  characterId: string;
  targetCityId: string;
  missionType: SpyMissionType;
  departureTick: number;
  arrivalTick: number;
  status: SpyMissionStatus;
}

export type RoadType = "official" | "mountain" | "waterway";

export interface RoadEdge {
  fromCityId: string;
  toCityId: string;
  type: RoadType;
  travelTime: number; // official=1, waterway=2, mountain=3
}

export interface MapData {
  cities: PlaceNode[];
  characters: (CharacterNode & { cityId: string })[];
  movements: Movement[];
  roads: RoadEdge[];
}
