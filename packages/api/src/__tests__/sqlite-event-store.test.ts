import { describe, it, expect, beforeEach } from "vitest";
import { SqliteEventStore } from "../event-store/sqlite-event-store.js";
import type { StoredEvent } from "../event-store/types.js";

function makeEvent(overrides: Partial<Omit<StoredEvent, "id">> = {}): Omit<StoredEvent, "id"> {
  return {
    tick: 1,
    timestamp: Date.now(),
    actorId: "a",
    targetId: "b",
    eventCode: "interact",
    intimacyChange: 5,
    oldIntimacy: 50,
    newIntimacy: 55,
    relation: "neutral",
    narrative: "",
    ...overrides,
  };
}

describe("SqliteEventStore", () => {
  let store: SqliteEventStore;

  beforeEach(() => {
    store = new SqliteEventStore(); // in-memory
  });

  it("appends and retrieves events", () => {
    store.append([makeEvent(), makeEvent({ actorId: "c", targetId: "d" })]);
    const all = store.getAll();
    expect(all).toHaveLength(2);
    expect(all[0].id).toBe(1);
    expect(all[1].id).toBe(2);
  });

  it("queries by tick range", () => {
    store.append([
      makeEvent({ tick: 1 }),
      makeEvent({ tick: 2 }),
      makeEvent({ tick: 3 }),
    ]);
    const events = store.getByTickRange(1, 2);
    expect(events).toHaveLength(2);
  });

  it("queries by character", () => {
    store.append([
      makeEvent({ actorId: "a", targetId: "b" }),
      makeEvent({ actorId: "c", targetId: "a" }),
      makeEvent({ actorId: "d", targetId: "e" }),
    ]);
    const events = store.getByCharacter("a");
    expect(events).toHaveLength(2);
  });

  it("queries by pair (both directions)", () => {
    store.append([
      makeEvent({ actorId: "a", targetId: "b" }),
      makeEvent({ actorId: "b", targetId: "a" }),
      makeEvent({ actorId: "a", targetId: "c" }),
    ]);
    const events = store.getByPair("a", "b");
    expect(events).toHaveLength(2);
  });

  it("updates narratives", () => {
    store.append([makeEvent()]);
    const before = store.getAll();
    expect(before[0].narrative).toBe("");

    store.updateNarratives([{ id: 1, narrative: "A dramatic encounter" }]);
    const after = store.getAll();
    expect(after[0].narrative).toBe("A dramatic encounter");
  });
});
