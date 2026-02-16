import type { Driver } from "neo4j-driver";
import type { IGraphRepository } from "../types/repository.js";
import type { CharacterNode, RelationshipEdge, CharacterGraph, PlaceNode, Movement, MapData } from "../types/graph.js";
import { createDriver, type Neo4jConfig } from "./connection.js";

export class Neo4jGraphRepository implements IGraphRepository {
  private driver: Driver | null = null;
  private config: Neo4jConfig;

  constructor(config?: Neo4jConfig) {
    this.config = config ?? {
      uri: "bolt://localhost:7687",
      username: "neo4j",
      password: "neo4j",
    };
  }

  async connect(): Promise<void> {
    this.driver = createDriver(this.config);
    await this.driver.verifyConnectivity();
  }

  async disconnect(): Promise<void> {
    await this.driver?.close();
    this.driver = null;
  }

  private getDriver(): Driver {
    if (!this.driver) throw new Error("Not connected. Call connect() first.");
    return this.driver;
  }

  async createCharacter(character: CharacterNode): Promise<void> {
    const session = this.getDriver().session();
    try {
      await session.run(
        `MERGE (c:Character {id: $id})
         SET c.name = $name, c.traits = $traits, c.cityId = $cityId`,
        { id: character.id, name: character.name, traits: character.traits, cityId: character.cityId ?? null },
      );
    } finally {
      await session.close();
    }
  }

  async getCharacter(id: string): Promise<CharacterNode | null> {
    const session = this.getDriver().session();
    try {
      const result = await session.run(
        `MATCH (c:Character {id: $id}) RETURN c`,
        { id },
      );
      const record = result.records[0];
      if (!record) return null;

      const node = record.get("c").properties;
      return { id: node.id, name: node.name, traits: node.traits, cityId: node.cityId ?? undefined };
    } finally {
      await session.close();
    }
  }

  async getAllCharacters(): Promise<CharacterNode[]> {
    const session = this.getDriver().session();
    try {
      const result = await session.run(`MATCH (c:Character) RETURN c`);
      return result.records.map((r) => {
        const node = r.get("c").properties;
        return { id: node.id, name: node.name, traits: node.traits, cityId: node.cityId ?? undefined };
      });
    } finally {
      await session.close();
    }
  }

  async setRelationship(edge: RelationshipEdge): Promise<void> {
    const session = this.getDriver().session();
    try {
      await session.run(
        `MATCH (a:Character {id: $sourceId}), (b:Character {id: $targetId})
         MERGE (a)-[r:RELATES_TO]->(b)
         SET r.intimacy = $intimacy, r.relationshipType = $relationshipType`,
        {
          sourceId: edge.sourceId,
          targetId: edge.targetId,
          intimacy: edge.intimacy,
          relationshipType: edge.relationshipType,
        },
      );
    } finally {
      await session.close();
    }
  }

  async getRelationship(sourceId: string, targetId: string): Promise<RelationshipEdge | null> {
    const session = this.getDriver().session();
    try {
      const result = await session.run(
        `MATCH (a:Character {id: $sourceId})-[r:RELATES_TO]->(b:Character {id: $targetId})
         RETURN r`,
        { sourceId, targetId },
      );
      const record = result.records[0];
      if (!record) return null;

      const rel = record.get("r").properties;
      return {
        sourceId,
        targetId,
        intimacy: rel.intimacy,
        relationshipType: rel.relationshipType,
      };
    } finally {
      await session.close();
    }
  }

  async getRelationshipsOf(characterId: string): Promise<RelationshipEdge[]> {
    const session = this.getDriver().session();
    try {
      const result = await session.run(
        `MATCH (a:Character {id: $id})-[r:RELATES_TO]-(b:Character)
         RETURN a.id AS sourceId, b.id AS targetId, r.intimacy AS intimacy, r.relationshipType AS relationshipType`,
        { id: characterId },
      );
      return result.records.map((rec) => ({
        sourceId: rec.get("sourceId"),
        targetId: rec.get("targetId"),
        intimacy: rec.get("intimacy"),
        relationshipType: rec.get("relationshipType"),
      }));
    } finally {
      await session.close();
    }
  }

  // Place operations — Neo4j Cypher implementations
  async createPlace(place: PlaceNode): Promise<void> {
    const session = this.getDriver().session();
    try {
      await session.run(
        `MERGE (p:Place {id: $id})
         SET p.name = $name, p.lat = $lat, p.lng = $lng,
             p.status = $status, p.tier = $tier, p.controllerId = $controllerId`,
        { id: place.id, name: place.name, lat: place.lat, lng: place.lng,
          status: place.status, tier: place.tier, controllerId: place.controllerId ?? null },
      );
    } finally {
      await session.close();
    }
  }

  async getPlace(id: string): Promise<PlaceNode | null> {
    const session = this.getDriver().session();
    try {
      const result = await session.run(`MATCH (p:Place {id: $id}) RETURN p`, { id });
      const record = result.records[0];
      if (!record) return null;
      const props = record.get("p").properties;
      return { id: props.id, name: props.name, lat: props.lat, lng: props.lng,
        status: props.status, tier: props.tier, controllerId: props.controllerId ?? undefined };
    } finally {
      await session.close();
    }
  }

  async getAllPlaces(): Promise<PlaceNode[]> {
    const session = this.getDriver().session();
    try {
      const result = await session.run(`MATCH (p:Place) RETURN p`);
      return result.records.map((r) => {
        const props = r.get("p").properties;
        return { id: props.id, name: props.name, lat: props.lat, lng: props.lng,
          status: props.status, tier: props.tier, controllerId: props.controllerId ?? undefined };
      });
    } finally {
      await session.close();
    }
  }

  async updatePlace(id: string, updates: Partial<Omit<PlaceNode, "id">>): Promise<void> {
    const session = this.getDriver().session();
    try {
      const setClauses = Object.entries(updates)
        .map(([key, _]) => `p.${key} = $${key}`)
        .join(", ");
      if (!setClauses) return;
      await session.run(`MATCH (p:Place {id: $id}) SET ${setClauses}`, { id, ...updates });
    } finally {
      await session.close();
    }
  }

  // Movement operations — stored in-memory for Neo4j impl (ephemeral per session)
  private movements: Movement[] = [];

  async addMovement(movement: Movement): Promise<void> {
    this.movements.push({ ...movement });
  }

  async getActiveMovements(tick: number): Promise<Movement[]> {
    return this.movements.filter((m) => m.departureTick <= tick && m.arrivalTick >= tick);
  }

  async getMapData(tick: number): Promise<MapData> {
    const cities = await this.getAllPlaces();
    const allChars = await this.getAllCharacters();
    const activeMovements = await this.getActiveMovements(tick);
    const charsWithCity = allChars
      .filter((c) => c.cityId)
      .map((c) => ({ ...c, cityId: c.cityId! }));
    return { cities, characters: charsWithCity, movements: activeMovements };
  }

  async getCharacterGraph(centerId: string, depth: number): Promise<CharacterGraph> {
    const session = this.getDriver().session();
    try {
      const result = await session.run(
        `MATCH (center:Character {id: $centerId})
         OPTIONAL MATCH path = (center)-[r:RELATES_TO*1..${depth}]-(other:Character)
         WITH center, collect(DISTINCT other) AS others, collect(DISTINCT r) AS rels
         RETURN center, others, rels`,
        { centerId },
      );

      const record = result.records[0];
      if (!record) {
        return { center: { id: centerId, name: "", traits: [] }, characters: [], relationships: [] };
      }

      const centerProps = record.get("center").properties;
      const center: CharacterNode = {
        id: centerProps.id,
        name: centerProps.name,
        traits: centerProps.traits ?? [],
      };

      const others: CharacterNode[] = (record.get("others") ?? []).map(
        (n: { properties: { id: string; name: string; traits: string[] } }) => ({
          id: n.properties.id,
          name: n.properties.name,
          traits: n.properties.traits ?? [],
        }),
      );

      // Re-query relationships explicitly for clean mapping
      const relResult = await session.run(
        `MATCH (center:Character {id: $centerId})
         MATCH (center)-[r:RELATES_TO*1..${depth}]-(other:Character)
         UNWIND r AS rel
         WITH startNode(rel) AS s, endNode(rel) AS e, rel
         RETURN DISTINCT s.id AS sourceId, e.id AS targetId, rel.intimacy AS intimacy, rel.relationshipType AS relationshipType`,
        { centerId },
      );

      const relationships: RelationshipEdge[] = relResult.records.map((rec) => ({
        sourceId: rec.get("sourceId"),
        targetId: rec.get("targetId"),
        intimacy: rec.get("intimacy"),
        relationshipType: rec.get("relationshipType"),
      }));

      return { center, characters: others, relationships };
    } finally {
      await session.close();
    }
  }
}
