import type { Entity, EntityId, Component } from "./types.js";

export class World {
  private entities = new Map<EntityId, Entity>();
  private nextId = 0;
  private _tick = 0;

  get tick(): number {
    return this._tick;
  }

  createEntity(id?: EntityId): Entity {
    const entityId = id ?? `entity_${this.nextId++}`;
    const entity: Entity = { id: entityId, components: new Map() };
    this.entities.set(entityId, entity);
    return entity;
  }

  getEntity(id: EntityId): Entity | undefined {
    return this.entities.get(id);
  }

  addComponent<T extends Component>(entityId: EntityId, component: T): void {
    const entity = this.entities.get(entityId);
    if (!entity) return;
    entity.components.set(component.type, component);
  }

  getComponent<T extends Component>(entityId: EntityId, type: string): T | undefined {
    return this.entities.get(entityId)?.components.get(type) as T | undefined;
  }

  getAllEntitiesWith(...componentTypes: string[]): Entity[] {
    return [...this.entities.values()].filter((entity) =>
      componentTypes.every((type) => entity.components.has(type)),
    );
  }

  advanceTick(): number {
    return ++this._tick;
  }

  setTick(tick: number): void {
    this._tick = tick;
  }
}
