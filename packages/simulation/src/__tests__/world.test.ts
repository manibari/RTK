import { describe, it, expect } from "vitest";
import { World } from "../ecs/world.js";
import type { CharacterComponent, RelationshipComponent } from "../ecs/types.js";

describe("World", () => {
  it("creates and retrieves entities", () => {
    const world = new World();
    world.createEntity("test_1");
    const entity = world.getEntity("test_1");
    expect(entity).toBeDefined();
    expect(entity!.id).toBe("test_1");
  });

  it("adds and retrieves components", () => {
    const world = new World();
    world.createEntity("char_1");
    world.addComponent<CharacterComponent>("char_1", {
      type: "character",
      name: "Test",
      traits: ["brave", "loyal"],
    });

    const entity = world.getEntity("char_1");
    const comp = entity!.components.get("character") as CharacterComponent;
    expect(comp.name).toBe("Test");
    expect(comp.traits).toEqual(["brave", "loyal"]);
  });

  it("queries entities by component type", () => {
    const world = new World();
    world.createEntity("char_1");
    world.addComponent<CharacterComponent>("char_1", {
      type: "character",
      name: "A",
      traits: [],
    });
    world.createEntity("char_2");
    world.addComponent<CharacterComponent>("char_2", {
      type: "character",
      name: "B",
      traits: [],
    });
    world.createEntity("rel_1");
    world.addComponent<RelationshipComponent>("rel_1", {
      type: "relationship",
      sourceId: "char_1",
      targetId: "char_2",
      intimacy: 50,
      relationshipType: "neutral",
    });

    const characters = world.getAllEntitiesWith("character");
    expect(characters).toHaveLength(2);

    const relationships = world.getAllEntitiesWith("relationship");
    expect(relationships).toHaveLength(1);
  });

  it("advances tick", () => {
    const world = new World();
    expect(world.tick).toBe(0);
    world.advanceTick();
    expect(world.tick).toBe(1);
    world.advanceTick();
    expect(world.tick).toBe(2);
  });
});
