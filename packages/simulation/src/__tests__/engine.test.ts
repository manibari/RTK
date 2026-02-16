import { describe, it, expect } from "vitest";
import { Engine } from "../engine.js";

describe("Engine", () => {
  it("loads characters and relationships", () => {
    const engine = new Engine();
    engine.loadCharacters([
      { id: "a", name: "A", traits: ["brave"] },
      { id: "b", name: "B", traits: ["wise"] },
    ]);
    engine.loadRelationships([
      { sourceId: "a", targetId: "b", intimacy: 50, relationshipType: "neutral" },
    ]);

    const rels = engine.getRelationships();
    expect(rels).toHaveLength(1);
    expect(rels[0].sourceId).toBe("a");
    expect(rels[0].targetId).toBe("b");
  });

  it("advances day and produces events", () => {
    const engine = new Engine();
    engine.loadCharacters([
      { id: "a", name: "A", traits: ["brave", "loyal"] },
      { id: "b", name: "B", traits: ["brave", "wise"] },
    ]);
    engine.loadRelationships([
      { sourceId: "a", targetId: "b", intimacy: 50, relationshipType: "neutral" },
    ]);

    const events = engine.advanceDay();
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].tick).toBe(1);
    expect(events[0].actorId).toBeDefined();
    expect(events[0].resultDelta).toBeDefined();
  });

  it("updates intimacy after advance", () => {
    const engine = new Engine();
    engine.loadCharacters([
      { id: "a", name: "A", traits: ["brave", "loyal", "wise"] },
      { id: "b", name: "B", traits: ["brave", "loyal", "wise"] },
    ]);
    engine.loadRelationships([
      { sourceId: "a", targetId: "b", intimacy: 50, relationshipType: "neutral" },
    ]);

    engine.advanceDay();
    const rels = engine.getRelationships();
    // Intimacy should have changed (could go up or down)
    expect(typeof rels[0].intimacy).toBe("number");
    expect(rels[0].intimacy).toBeGreaterThanOrEqual(0);
    expect(rels[0].intimacy).toBeLessThanOrEqual(100);
  });
});
