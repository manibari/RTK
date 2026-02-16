import { World } from "./ecs/world.js";
import type { CharacterComponent, RelationshipComponent } from "./ecs/types.js";
import type { SimulationEvent } from "./types.js";
import { runRelationshipSystem } from "./systems/relationship-system.js";

interface CharacterData {
  id: string;
  name: string;
  traits: string[];
}

interface RelationshipData {
  sourceId: string;
  targetId: string;
  intimacy: number;
  relationshipType: "friend" | "rival" | "neutral";
}

export class Engine {
  readonly world: World;

  constructor() {
    this.world = new World();
  }

  loadCharacters(characters: CharacterData[]): void {
    for (const c of characters) {
      this.world.createEntity(c.id);
      this.world.addComponent(c.id, {
        type: "character" as const,
        name: c.name,
        traits: [...c.traits],
      } satisfies CharacterComponent);
    }
  }

  loadRelationships(relationships: RelationshipData[]): void {
    for (const r of relationships) {
      const relId = `rel_${r.sourceId}_${r.targetId}`;
      this.world.createEntity(relId);
      this.world.addComponent(relId, {
        type: "relationship" as const,
        sourceId: r.sourceId,
        targetId: r.targetId,
        intimacy: r.intimacy,
        relationshipType: r.relationshipType,
      } satisfies RelationshipComponent);
    }
  }

  advanceDay(): SimulationEvent[] {
    this.world.advanceTick();
    return runRelationshipSystem(this.world);
  }

  getRelationships(): RelationshipData[] {
    return this.world
      .getAllEntitiesWith("relationship")
      .map((e) => {
        const rel = e.components.get("relationship") as RelationshipComponent;
        return {
          sourceId: rel.sourceId,
          targetId: rel.targetId,
          intimacy: rel.intimacy,
          relationshipType: rel.relationshipType,
        };
      });
  }
}
