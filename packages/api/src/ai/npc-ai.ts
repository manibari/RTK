import type { CharacterNode, PlaceNode } from "@rtk/graph-db";

interface FactionDef {
  id: string;
  leaderId: string;
  members: string[];
}

export interface AIDecision {
  characterId: string;
  action: "move" | "attack" | "stay";
  targetCityId?: string;
  reason: string;
}

/**
 * NPC AI: evaluates strategic decisions for non-player factions.
 * Player faction (shu) is skipped — controlled by the player.
 * Alliance-aware: won't attack allied factions.
 */
export function evaluateNPCDecisions(
  factions: FactionDef[],
  characters: CharacterNode[],
  cities: PlaceNode[],
  playerFactionId: string,
  alliances: Set<string> = new Set(),
): AIDecision[] {
  const decisions: AIDecision[] = [];
  const charMap = new Map(characters.map((c) => [c.id, c]));
  const cityMap = new Map(cities.map((c) => [c.id, c]));

  // Build a lookup: characterId -> factionId
  const charToFaction = new Map<string, string>();
  for (const f of factions) {
    for (const m of f.members) charToFaction.set(m, f.id);
  }

  // Count defenders per city
  const defendersPerCity = new Map<string, string[]>();
  for (const char of characters) {
    if (!char.cityId) continue;
    const list = defendersPerCity.get(char.cityId) ?? [];
    list.push(char.id);
    defendersPerCity.set(char.cityId, list);
  }

  const isAllied = (fA: string, fB: string): boolean => {
    const key = [fA, fB].sort().join(":");
    return alliances.has(key);
  };

  for (const faction of factions) {
    if (faction.id === playerFactionId) continue;

    const factionCities = cities.filter(
      (c) => c.controllerId && faction.members.includes(c.controllerId),
    );
    // Filter enemy cities: exclude allies and dead cities
    const enemyCities = cities.filter((c) => {
      if (c.status === "dead" || !c.controllerId) return false;
      if (faction.members.includes(c.controllerId)) return false;
      const controllerFaction = charToFaction.get(c.controllerId);
      if (controllerFaction && isAllied(faction.id, controllerFaction)) return false;
      return true;
    });

    for (const memberId of faction.members) {
      const char = charMap.get(memberId);
      if (!char?.cityId) continue;

      if (decisions.some((d) => d.characterId === memberId)) continue;

      const decision = decideForCharacter(
        char as CharacterNode & { cityId: string },
        faction,
        factionCities,
        enemyCities,
        defendersPerCity,
        cityMap,
      );
      decisions.push(decision);
    }
  }

  return decisions;
}

function decideForCharacter(
  char: CharacterNode & { cityId: string },
  faction: FactionDef,
  factionCities: PlaceNode[],
  enemyCities: PlaceNode[],
  defendersPerCity: Map<string, string[]>,
  cityMap: Map<string, PlaceNode>,
): AIDecision {
  const currentCity = cityMap.get(char.cityId);
  const isLeader = char.id === faction.leaderId;

  // Leaders prefer to stay and defend
  if (isLeader) {
    // Only attack if we have strong defense and weak enemy nearby
    const weakEnemy = enemyCities.find((c) => {
      const defenders = defendersPerCity.get(c.id)?.length ?? 0;
      return defenders === 0 && c.tier === "minor";
    });
    if (weakEnemy && (defendersPerCity.get(char.cityId)?.length ?? 0) > 1) {
      return {
        characterId: char.id,
        action: "attack",
        targetCityId: weakEnemy.id,
        reason: `Leader attacks undefended ${weakEnemy.name}`,
      };
    }
    return { characterId: char.id, action: "stay", reason: "Leader holds position" };
  }

  // Non-leaders: evaluate priorities
  const myDefenders = defendersPerCity.get(char.cityId)?.length ?? 0;

  // Priority 1: If city is overstaffed (>2 defenders), send to attack weak enemy
  if (myDefenders > 2 && enemyCities.length > 0) {
    // Prefer undefended or weakly defended cities
    const target = pickWeakestCity(enemyCities, defendersPerCity);
    if (target) {
      return {
        characterId: char.id,
        action: "attack",
        targetCityId: target.id,
        reason: `Attack weakly defended ${target.name}`,
      };
    }
  }

  // Priority 2: Reinforce an allied city that has no defenders
  const emptyAlliedCity = factionCities.find(
    (c) => c.id !== char.cityId && (defendersPerCity.get(c.id)?.length ?? 0) === 0,
  );
  if (emptyAlliedCity) {
    return {
      characterId: char.id,
      action: "move",
      targetCityId: emptyAlliedCity.id,
      reason: `Reinforce empty ${emptyAlliedCity.name}`,
    };
  }

  // Priority 3: 30% chance to attack a random enemy city
  if (Math.random() < 0.3 && enemyCities.length > 0) {
    const target = enemyCities[Math.floor(Math.random() * enemyCities.length)];
    return {
      characterId: char.id,
      action: "attack",
      targetCityId: target.id,
      reason: `Opportunistic attack on ${target.name}`,
    };
  }

  // Default: stay
  return { characterId: char.id, action: "stay", reason: "Hold position" };
}

function pickWeakestCity(
  cities: PlaceNode[],
  defendersPerCity: Map<string, string[]>,
): PlaceNode | null {
  let weakest: PlaceNode | null = null;
  let minDefenders = Infinity;

  for (const city of cities) {
    const count = defendersPerCity.get(city.id)?.length ?? 0;
    if (count < minDefenders) {
      minDefenders = count;
      weakest = city;
    }
  }

  return weakest;
}
