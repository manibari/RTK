export type EntityId = string;

export interface Component {
  readonly type: string;
}

export interface CharacterComponent extends Component {
  readonly type: "character";
  name: string;
  traits: string[];
}

export interface RelationshipComponent extends Component {
  readonly type: "relationship";
  sourceId: EntityId;
  targetId: EntityId;
  intimacy: number;
  relationshipType: "friend" | "rival" | "neutral";
}

export interface Entity {
  id: EntityId;
  components: Map<string, Component>;
}
