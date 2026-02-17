import type { CharacterNode, PlaceNode, RelationshipEdge } from "@rtk/graph-db";

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

// ── Personality system ──
const AGGRESSION_TRAITS: Record<string, number> = {
  brave: 2, ambitious: 1, impulsive: 3, proud: 1, treacherous: 1,
};
const CAUTION_TRAITS: Record<string, number> = {
  cautious: 2, strategic: 2, wise: 1, humble: 1, loyal: 1,
};

function personalityWeight(char: CharacterNode): { aggression: number; caution: number } {
  let aggression = 0, caution = 0;
  for (const t of char.traits) {
    aggression += AGGRESSION_TRAITS[t] ?? 0;
    caution += CAUTION_TRAITS[t] ?? 0;
  }
  // Military-heavy chars are slightly more aggressive; intelligence-heavy are more cautious
  aggression += Math.floor(char.military / 4);
  caution += Math.floor(char.intelligence / 4);
  return { aggression: Math.min(6, aggression), caution: Math.min(6, caution) };
}

/**
 * NPC AI: evaluates strategic decisions for non-player factions.
 * Player faction (shu) is skipped — controlled by the player.
 * Alliance-aware: won't attack allied factions.
 * Relationship-aware: avoids attacking cities held by high-intimacy characters.
 * Personality-aware: traits drive aggression vs caution thresholds.
 */
export function evaluateNPCDecisions(
  factions: FactionDef[],
  characters: CharacterNode[],
  cities: PlaceNode[],
  playerFactionId: string,
  alliances: Set<string> = new Set(),
  relationships: RelationshipEdge[] = [],
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
        relationships,
      );
      decisions.push(decision);
    }
  }

  return decisions;
}

function getIntimacyWith(charId: string, targetId: string, relationships: RelationshipEdge[]): number {
  const rel = relationships.find(
    (r) =>
      (r.sourceId === charId && r.targetId === targetId) ||
      (r.sourceId === targetId && r.targetId === charId),
  );
  return rel?.intimacy ?? 50;
}

function decideForCharacter(
  char: CharacterNode & { cityId: string },
  faction: FactionDef,
  factionCities: PlaceNode[],
  enemyCities: PlaceNode[],
  defendersPerCity: Map<string, string[]>,
  cityMap: Map<string, PlaceNode>,
  relationships: RelationshipEdge[],
): AIDecision {
  const currentCity = cityMap.get(char.cityId);
  const isLeader = char.id === faction.leaderId;
  const { aggression, caution } = personalityWeight(char);

  // Filter out enemy cities whose controller has high intimacy with this character
  const viableEnemyCities = enemyCities.filter((c) => {
    if (!c.controllerId) return true;
    const intimacy = getIntimacyWith(char.id, c.controllerId, relationships);
    return intimacy < 70; // Won't attack someone with intimacy >= 70
  });

  // Leaders prefer to stay and defend (but aggressive leaders are bolder)
  if (isLeader) {
    const weakEnemy = pickBestTarget(viableEnemyCities, defendersPerCity, caution);
    const homeDefenders = defendersPerCity.get(char.cityId)?.length ?? 0;
    const leaderThreshold = Math.max(1, 2 - Math.floor(aggression / 3));
    if (weakEnemy && homeDefenders > leaderThreshold) {
      return {
        characterId: char.id,
        action: "attack",
        targetCityId: weakEnemy.id,
        reason: `Leader attacks ${weakEnemy.name}`,
      };
    }
    return { characterId: char.id, action: "stay", reason: "Leader holds position" };
  }

  // Non-leaders: evaluate priorities
  const myDefenders = defendersPerCity.get(char.cityId)?.length ?? 0;

  // Priority 1: If city is overstaffed, send to attack
  // Aggressive chars attack from overstaffed-by-1; cautious wait for overstaffed-by-3+
  const attackThreshold = Math.max(1, 2 + Math.floor(caution / 2) - Math.floor(aggression / 2));
  if (myDefenders > attackThreshold && viableEnemyCities.length > 0) {
    const target = pickBestTarget(viableEnemyCities, defendersPerCity, caution);
    if (target) {
      return {
        characterId: char.id,
        action: "attack",
        targetCityId: target.id,
        reason: `Attack ${target.name} (personality-driven)`,
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

  // Priority 3: Random attack — chance scales with aggression, reduced by caution
  const randomAttackChance = 0.15 + aggression * 0.05 - caution * 0.03;
  if (Math.random() < randomAttackChance && viableEnemyCities.length > 0) {
    const target = viableEnemyCities[Math.floor(Math.random() * viableEnemyCities.length)];
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

/**
 * Pick the best target city to attack.
 * Cautious chars prefer weakly defended cities; aggressive chars also consider high-value targets.
 */
function pickBestTarget(
  cities: PlaceNode[],
  defendersPerCity: Map<string, string[]>,
  caution: number,
): PlaceNode | null {
  let best: PlaceNode | null = null;
  let bestScore = -Infinity;

  for (const city of cities) {
    const defenders = defendersPerCity.get(city.id)?.length ?? 0;
    const garrison = city.garrison;
    // Score: lower defense = higher score; high caution penalizes well-defended targets more
    let score = 10 - defenders * (1 + caution * 0.3) - garrison * 0.5;
    // Bonus for undefended cities
    if (defenders === 0) score += 5;
    // Bonus for minor cities (easier to capture)
    if (city.tier === "minor") score += 2;
    // Bonus for low food cities (starving)
    if ((city.food ?? 100) < 30) score += 3;
    if (score > bestScore) {
      bestScore = score;
      best = city;
    }
  }

  return best;
}
