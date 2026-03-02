import { describe, it, expect } from "vitest";
import {
  evaluateStrategicIntent,
  evaluateNPCDecisions,
  evaluateFactionPower,
  wouldCreateExclave,
  type DiplomacyContext,
} from "../ai/npc-ai.js";
import type { CharacterNode, PlaceNode, RoadEdge } from "@rtk/graph-db";
import { buildAdjacencyMap } from "../roads.js";

function makeCity(overrides: Partial<PlaceNode> & { id: string }): PlaceNode {
  return {
    name: overrides.id,
    description: "",
    lat: 0,
    lng: 0,
    status: "allied",
    tier: "minor",
    gold: 50,
    garrison: 3,
    development: 0,
    specialty: "market",
    food: 100,
    ...overrides,
  };
}

function makeChar(overrides: Partial<CharacterNode> & { id: string }): CharacterNode {
  return {
    name: overrides.id,
    traits: ["brave"],
    military: 50,
    intelligence: 30,
    charm: 20,
    skills: { leadership: 0, tactics: 0, commerce: 0, espionage: 0 },
    ...overrides,
  };
}

describe("evaluateStrategicIntent", () => {
  it("returns defend when faction has no cities", () => {
    const intent = evaluateStrategicIntent(
      { id: "f1", leaderId: "c1", members: ["c1"] },
      [],
      [makeCity({ id: "e1", controllerId: "enemy" })],
      new Map(),
    );
    expect(intent).toBe("defend");
  });

  it("returns expand when faction has strength advantage", () => {
    const cities = [
      makeCity({ id: "a", garrison: 5, controllerId: "c1" }),
      makeCity({ id: "b", garrison: 4, controllerId: "c1" }),
    ];
    const enemy = [makeCity({ id: "e1", garrison: 2, controllerId: "enemy" })];
    const defenders = new Map([["a", ["c1", "c2"]], ["b", ["c3"]]]);
    const intent = evaluateStrategicIntent(
      { id: "f1", leaderId: "c1", members: ["c1", "c2", "c3"] },
      cities,
      enemy,
      defenders,
    );
    expect(intent).toBe("expand");
  });

  it("returns defend when under threat with few members", () => {
    const cities = [makeCity({ id: "a", garrison: 0, controllerId: "c1" })];
    const enemy = [makeCity({ id: "e1", controllerId: "enemy" })];
    const defenders = new Map<string, string[]>();
    const intent = evaluateStrategicIntent(
      { id: "f1", leaderId: "c1", members: ["c1"] },
      cities,
      enemy,
      defenders,
    );
    expect(intent).toBe("defend");
  });
});

describe("evaluateFactionPower", () => {
  it("calculates power from garrison + members + gold", () => {
    const cities = [
      makeCity({ id: "a", garrison: 5, gold: 100, controllerId: "c1" }),
      makeCity({ id: "b", garrison: 3, gold: 50, controllerId: "c2" }),
    ];
    const power = evaluateFactionPower(
      { id: "f1", leaderId: "c1", members: ["c1", "c2"] },
      cities,
    );
    // garrison: 8, members: 2*3=6, gold: 150/50=3 → total 17
    expect(power).toBe(17);
  });

  it("returns member contribution only when no cities", () => {
    const power = evaluateFactionPower(
      { id: "f1", leaderId: "c1", members: ["c1", "c2", "c3"] },
      [],
    );
    // 0 garrison + 3*3 + 0 gold = 9
    expect(power).toBe(9);
  });
});

describe("wouldCreateExclave", () => {
  const roads: RoadEdge[] = [
    { fromCityId: "a", toCityId: "b", type: "official", travelTime: 1 },
    { fromCityId: "b", toCityId: "c", type: "official", travelTime: 1 },
    { fromCityId: "d", toCityId: "e", type: "official", travelTime: 1 },
  ];
  const adjacency = buildAdjacencyMap(roads);

  it("returns false when target is adjacent to faction territory", () => {
    expect(wouldCreateExclave("c", ["a", "b"], adjacency)).toBe(false);
  });

  it("returns true when target is not adjacent to any faction city", () => {
    expect(wouldCreateExclave("d", ["a", "b"], adjacency)).toBe(true);
  });

  it("returns true when faction has no cities at all", () => {
    expect(wouldCreateExclave("a", [], adjacency)).toBe(true);
  });
});

describe("evaluateNPCDecisions", () => {
  it("skips player faction", () => {
    const factions = [
      { id: "player", leaderId: "p1", members: ["p1"] },
      { id: "npc", leaderId: "n1", members: ["n1"] },
    ];
    const chars = [
      makeChar({ id: "p1", cityId: "city_p" }),
      makeChar({ id: "n1", cityId: "city_n" }),
    ];
    const cities = [
      makeCity({ id: "city_p", controllerId: "p1" }),
      makeCity({ id: "city_n", controllerId: "n1" }),
    ];
    const decisions = evaluateNPCDecisions(factions, chars, cities, "player");
    // Should only have decisions for NPC faction
    expect(decisions.every((d) => d.characterId !== "p1")).toBe(true);
    expect(decisions.some((d) => d.characterId === "n1")).toBe(true);
  });

  it("respects truces in diplomacy context", () => {
    const factions = [
      { id: "player", leaderId: "p1", members: ["p1"] },
      { id: "npc1", leaderId: "n1", members: ["n1"] },
      { id: "npc2", leaderId: "n2", members: ["n2"] },
    ];
    const chars = [
      makeChar({ id: "p1", cityId: "city_p" }),
      makeChar({ id: "n1", cityId: "city_n1", military: 90 }),
      makeChar({ id: "n2", cityId: "city_n2" }),
    ];
    const cities = [
      makeCity({ id: "city_p", controllerId: "p1" }),
      makeCity({ id: "city_n1", controllerId: "n1", garrison: 5 }),
      makeCity({ id: "city_n2", controllerId: "n2", garrison: 1 }),
    ];

    // Set truce between npc1 and npc2
    const truces = new Map([["npc1:npc2", 100]]);
    const diplomacy: DiplomacyContext = {
      truces,
      currentTick: 50,
      warExhaustion: new Map(),
    };

    const decisions = evaluateNPCDecisions(
      factions, chars, cities, "player",
      new Set(), [], undefined, undefined, 1.0, diplomacy,
    );

    // npc1 should not attack npc2 due to truce
    const npc1Attack = decisions.find(
      (d) => d.characterId === "n1" && d.action === "attack" && d.targetCityId === "city_n2",
    );
    expect(npc1Attack).toBeUndefined();
  });

  it("AI respects war exhaustion threshold for defensive posture", () => {
    const factions = [
      { id: "player", leaderId: "p1", members: ["p1"] },
      { id: "npc1", leaderId: "n1", members: ["n1", "n2", "n3"] },
    ];
    const chars = [
      makeChar({ id: "p1", cityId: "city_p" }),
      makeChar({ id: "n1", cityId: "city_n1", military: 90 }),
      makeChar({ id: "n2", cityId: "city_n1", military: 80 }),
      makeChar({ id: "n3", cityId: "city_n1", military: 70 }),
    ];
    const cities = [
      makeCity({ id: "city_p", controllerId: "p1", garrison: 1 }),
      makeCity({ id: "city_n1", controllerId: "n1", garrison: 8 }),
    ];

    // Very high war exhaustion
    const diplomacy: DiplomacyContext = {
      warExhaustion: new Map([["npc1", 80]]),
      warExhaustionDefendThreshold: 70,
      currentTick: 50,
    };

    const decisions = evaluateNPCDecisions(
      factions, chars, cities, "player",
      new Set(), [], undefined, undefined, 1.0, diplomacy,
    );

    // All decisions should be stay or move (defend), not attack
    const attacks = decisions.filter((d) => d.action === "attack");
    expect(attacks.length).toBe(0);
  });
});
