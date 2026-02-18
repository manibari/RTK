import type { RoadEdge, PlaceNode } from "@rtk/graph-db";

export type AdjacencyMap = Map<string, RoadEdge[]>;

export function buildAdjacencyMap(roads: RoadEdge[]): AdjacencyMap {
  const map: AdjacencyMap = new Map();
  for (const road of roads) {
    const fromList = map.get(road.fromCityId) ?? [];
    fromList.push(road);
    map.set(road.fromCityId, fromList);

    const toList = map.get(road.toCityId) ?? [];
    toList.push(road);
    map.set(road.toCityId, toList);
  }
  return map;
}

export function findRoad(adjacency: AdjacencyMap, from: string, to: string, cityMap?: Map<string, PlaceNode>): RoadEdge | null {
  const roads = adjacency.get(from);
  if (!roads) return null;
  const matching = roads.filter(
    (r) => (r.fromCityId === from && r.toCityId === to) || (r.fromCityId === to && r.toCityId === from),
  );
  if (matching.length === 0) return null;
  // If cityMap provided, filter out unusable waterways; then pick fastest
  const usable = cityMap
    ? matching.filter((r) => isWaterwayUsable(r, cityMap))
    : matching;
  if (usable.length === 0) return matching[0]; // fallback to any road
  return usable.reduce((best, r) => r.travelTime < best.travelTime ? r : best);
}

export function isWaterwayUsable(road: RoadEdge, cityMap: Map<string, PlaceNode>): boolean {
  if (road.type !== "waterway") return true;
  const origin = cityMap.get(road.fromCityId);
  const dest = cityMap.get(road.toCityId);
  return origin?.specialty === "harbor" || dest?.specialty === "harbor";
}

export function getReachableNeighbors(
  cityId: string,
  adjacency: AdjacencyMap,
  cityMap: Map<string, PlaceNode>,
): string[] {
  const roads = adjacency.get(cityId) ?? [];
  const seen = new Set<string>();
  const neighbors: string[] = [];
  for (const road of roads) {
    const neighborId = road.fromCityId === cityId ? road.toCityId : road.fromCityId;
    if (seen.has(neighborId)) continue;
    const neighborCity = cityMap.get(neighborId);
    if (!neighborCity || neighborCity.status === "dead") continue;
    if (!isWaterwayUsable(road, cityMap)) continue;
    seen.add(neighborId);
    neighbors.push(neighborId);
  }
  return neighbors;
}
