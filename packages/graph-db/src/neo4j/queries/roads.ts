// Cypher queries for road (ROAD_TO) relationships between cities

export const CREATE_ROAD = `
  MATCH (a:Place {id: $fromCityId}), (b:Place {id: $toCityId})
  MERGE (a)-[r:ROAD_TO {key: $key}]-(b)
  SET r.type = $type, r.travelTime = $travelTime
`;

export const GET_ROADS_FROM = `
  MATCH (p:Place {id: $cityId})-[r:ROAD_TO]-(other:Place)
  RETURN p.id AS fromCityId, other.id AS toCityId, r.type AS type, r.travelTime AS travelTime
`;

export const GET_ALL_ROADS = `
  MATCH (a:Place)-[r:ROAD_TO]->(b:Place)
  RETURN a.id AS fromCityId, b.id AS toCityId, r.type AS type, r.travelTime AS travelTime
`;
