export { World } from "./ecs/world.js";
export type {
  EntityId,
  Component,
  CharacterComponent,
  RelationshipComponent,
  Entity,
} from "./ecs/types.js";
export { runRelationshipSystem } from "./systems/relationship-system.js";
export { Engine } from "./engine.js";
export type { SimulationEvent } from "./types.js";
