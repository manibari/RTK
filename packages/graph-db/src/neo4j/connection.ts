import neo4j, { type Driver } from "neo4j-driver";

export interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
}

const DEFAULT_CONFIG: Neo4jConfig = {
  uri: "bolt://localhost:7687",
  username: "neo4j",
  password: "neo4j",
};

export function createDriver(config: Neo4jConfig = DEFAULT_CONFIG): Driver {
  return neo4j.driver(config.uri, neo4j.auth.basic(config.username, config.password));
}
