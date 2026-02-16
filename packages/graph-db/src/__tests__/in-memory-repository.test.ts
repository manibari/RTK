import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryGraphRepository } from "../memory/in-memory-repository.js";
import type { CharacterNode, RelationshipEdge, PlaceNode } from "../types/graph.js";

describe("InMemoryGraphRepository", () => {
  let repo: InMemoryGraphRepository;

  beforeEach(async () => {
    repo = new InMemoryGraphRepository();
    await repo.connect();
  });

  describe("characters", () => {
    it("creates and retrieves a character", async () => {
      await repo.createCharacter({ id: "a", name: "A", traits: ["brave"] });
      const char = await repo.getCharacter("a");
      expect(char).toEqual({ id: "a", name: "A", traits: ["brave"] });
    });

    it("returns null for non-existent character", async () => {
      const char = await repo.getCharacter("nope");
      expect(char).toBeNull();
    });

    it("lists all characters", async () => {
      await repo.createCharacter({ id: "a", name: "A", traits: [] });
      await repo.createCharacter({ id: "b", name: "B", traits: [] });
      const all = await repo.getAllCharacters();
      expect(all).toHaveLength(2);
    });
  });

  describe("relationships", () => {
    it("sets and retrieves a relationship", async () => {
      const edge: RelationshipEdge = {
        sourceId: "a", targetId: "b", intimacy: 70, relationshipType: "friend",
      };
      await repo.setRelationship(edge);
      const rel = await repo.getRelationship("a", "b");
      expect(rel).toEqual(edge);
    });

    it("gets relationships of a character", async () => {
      await repo.setRelationship({ sourceId: "a", targetId: "b", intimacy: 50, relationshipType: "neutral" });
      await repo.setRelationship({ sourceId: "a", targetId: "c", intimacy: 30, relationshipType: "rival" });
      await repo.setRelationship({ sourceId: "d", targetId: "e", intimacy: 80, relationshipType: "friend" });

      const rels = await repo.getRelationshipsOf("a");
      expect(rels).toHaveLength(2);
    });
  });

  describe("graph queries", () => {
    it("builds character graph with BFS", async () => {
      await repo.createCharacter({ id: "center", name: "Center", traits: [] });
      await repo.createCharacter({ id: "n1", name: "N1", traits: [] });
      await repo.createCharacter({ id: "n2", name: "N2", traits: [] });
      await repo.setRelationship({ sourceId: "center", targetId: "n1", intimacy: 60, relationshipType: "friend" });
      await repo.setRelationship({ sourceId: "n1", targetId: "n2", intimacy: 40, relationshipType: "neutral" });

      const graph = await repo.getCharacterGraph("center", 2);
      expect(graph.center.id).toBe("center");
      expect(graph.characters).toHaveLength(2); // n1, n2
      expect(graph.relationships).toHaveLength(2);
    });

    it("respects depth limit", async () => {
      await repo.createCharacter({ id: "a", name: "A", traits: [] });
      await repo.createCharacter({ id: "b", name: "B", traits: [] });
      await repo.createCharacter({ id: "c", name: "C", traits: [] });
      await repo.setRelationship({ sourceId: "a", targetId: "b", intimacy: 50, relationshipType: "neutral" });
      await repo.setRelationship({ sourceId: "b", targetId: "c", intimacy: 50, relationshipType: "neutral" });

      const graph = await repo.getCharacterGraph("a", 1);
      expect(graph.characters).toHaveLength(1); // only b
    });
  });

  describe("places", () => {
    it("creates and retrieves a place", async () => {
      const place: PlaceNode = {
        id: "city1", name: "City", lat: 25, lng: 121,
        status: "allied", tier: "major", controllerId: "a",
      };
      await repo.createPlace(place);
      const got = await repo.getPlace("city1");
      expect(got).toEqual(place);
    });

    it("lists all places", async () => {
      await repo.createPlace({ id: "c1", name: "C1", lat: 25, lng: 121, status: "allied", tier: "major" });
      await repo.createPlace({ id: "c2", name: "C2", lat: 24, lng: 120, status: "hostile", tier: "minor" });
      const all = await repo.getAllPlaces();
      expect(all).toHaveLength(2);
    });

    it("updates a place", async () => {
      await repo.createPlace({ id: "c1", name: "C1", lat: 25, lng: 121, status: "neutral", tier: "major" });
      await repo.updatePlace("c1", { status: "hostile", controllerId: "enemy" });
      const updated = await repo.getPlace("c1");
      expect(updated!.status).toBe("hostile");
      expect(updated!.controllerId).toBe("enemy");
    });
  });

  describe("movements", () => {
    it("adds and queries active movements", async () => {
      await repo.addMovement({
        characterId: "a", originCityId: "c1", destinationCityId: "c2",
        departureTick: 1, arrivalTick: 3,
      });

      expect(await repo.getActiveMovements(0)).toHaveLength(0);
      expect(await repo.getActiveMovements(1)).toHaveLength(1);
      expect(await repo.getActiveMovements(2)).toHaveLength(1);
      expect(await repo.getActiveMovements(3)).toHaveLength(1);
      expect(await repo.getActiveMovements(4)).toHaveLength(0);
    });
  });

  describe("map data", () => {
    it("returns combined map data", async () => {
      await repo.createPlace({ id: "c1", name: "C1", lat: 25, lng: 121, status: "allied", tier: "major" });
      await repo.createCharacter({ id: "a", name: "A", traits: [], cityId: "c1" });
      await repo.addMovement({
        characterId: "a", originCityId: "c1", destinationCityId: "c2",
        departureTick: 1, arrivalTick: 2,
      });

      const data = await repo.getMapData(1);
      expect(data.cities).toHaveLength(1);
      expect(data.characters).toHaveLength(1);
      expect(data.movements).toHaveLength(1);
    });
  });
});
