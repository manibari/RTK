import type { World } from "../ecs/world.js";
import type { RelationshipComponent, CharacterComponent } from "../ecs/types.js";
import type { SimulationEvent } from "../types.js";

export function runRelationshipSystem(world: World): SimulationEvent[] {
  const events: SimulationEvent[] = [];
  const relationshipEntities = world.getAllEntitiesWith("relationship");

  for (const entity of relationshipEntities) {
    const rel = entity.components.get("relationship") as RelationshipComponent;

    const sourceEntity = world.getEntity(rel.sourceId);
    const targetEntity = world.getEntity(rel.targetId);
    if (!sourceEntity || !targetEntity) continue;

    const sourceChar = sourceEntity.components.get("character") as CharacterComponent | undefined;
    const targetChar = targetEntity.components.get("character") as CharacterComponent | undefined;
    if (!sourceChar || !targetChar) continue;

    const delta = calculateDelta(sourceChar, targetChar);
    if (delta === 0) continue;

    const oldIntimacy = rel.intimacy;
    rel.intimacy = Math.max(0, Math.min(100, rel.intimacy + delta));
    rel.relationshipType = deriveType(rel.intimacy);

    events.push({
      tick: world.tick,
      timestamp: Date.now(),
      actorId: rel.sourceId,
      targetId: rel.targetId,
      eventCode: delta > 0 ? "POSITIVE_INTERACTION" : "NEGATIVE_INTERACTION",
      resultDelta: {
        relation: rel.relationshipType,
        intimacyChange: delta,
        oldIntimacy,
        newIntimacy: rel.intimacy,
      },
    });
  }

  return events;
}

function calculateDelta(actor: CharacterComponent, target: CharacterComponent): number {
  const sharedTraits = actor.traits.filter((t) => target.traits.includes(t)).length;
  const base = sharedTraits > 0 ? sharedTraits * 2 : -1;
  const noise = Math.floor(Math.random() * 5) - 2; // -2 to +2
  return base + noise;
}

function deriveType(intimacy: number): "friend" | "rival" | "neutral" {
  if (intimacy >= 60) return "friend";
  if (intimacy <= 30) return "rival";
  return "neutral";
}
