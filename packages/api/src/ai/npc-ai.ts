import type { CharacterNode, PlaceNode, RelationshipEdge, SpyMissionType } from "@rtk/graph-db";
import type { BattleTactic } from "../simulation-service.js";
import { getReachableNeighbors, type AdjacencyMap } from "../roads.js";

interface FactionDef {
  id: string;
  leaderId: string;
  members: string[];
}

export interface AIDecision {
  characterId: string;
  action: "move" | "attack" | "stay";
  targetCityId?: string;
  tactic?: BattleTactic;
  reason: string;
}

// NPC spy decision: which character to send on what mission
export interface AISpyDecision {
  characterId: string;
  targetCityId: string;
  missionType: SpyMissionType;
  reason: string;
}

// Faction-level strategic intent for a given tick
export type StrategicIntent = "expand" | "defend" | "develop";

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
  aggression += Math.floor(char.military / 4);
  caution += Math.floor(char.intelligence / 4);
  return { aggression: Math.min(6, aggression), caution: Math.min(6, caution) };
}

/**
 * Determine a faction's macro strategic intent based on situation.
 * - expand: faction has strength advantage, go on the offensive
 * - defend: faction is outnumbered or under siege, consolidate
 * - develop: faction is stable, invest in economy/garrisons
 */
export function evaluateStrategicIntent(
  faction: FactionDef,
  factionCities: PlaceNode[],
  enemyCities: PlaceNode[],
  defendersPerCity: Map<string, string[]>,
): StrategicIntent {
  if (factionCities.length === 0) return "defend";

  const totalGarrison = factionCities.reduce((s, c) => s + c.garrison, 0);
  const totalMembers = faction.members.length;
  const avgGarrison = totalGarrison / factionCities.length;

  // Under siege: any faction city with 0 garrison or low defenders → defend
  const underThreat = factionCities.some(
    (c) => c.garrison <= 1 || (defendersPerCity.get(c.id)?.length ?? 0) === 0,
  );
  if (underThreat && totalMembers <= 2) return "defend";

  // Strong position: many members, good garrisons → expand
  if (totalMembers >= 3 && avgGarrison >= 3 && enemyCities.length > 0) return "expand";

  // Low development cities → develop
  const avgDev = factionCities.reduce((s, c) => s + c.development, 0) / factionCities.length;
  if (avgDev < 2 && avgGarrison >= 2) return "develop";

  // Default: balanced — expand if garrison is sufficient, else defend
  if (avgGarrison >= 2 && enemyCities.length > 0) return "expand";
  return "defend";
}

/**
 * Pick a tactic for an NPC character based on traits and situation.
 */
function pickTactic(char: CharacterNode, defending: boolean): BattleTactic {
  const { aggression, caution } = personalityWeight(char);
  if (defending && caution >= 3) return "defensive";
  if (!defending && aggression >= 4) return "aggressive";
  if (caution > aggression + 1) return "defensive";
  if (aggression > caution + 1) return "aggressive";
  return "balanced";
}

/**
 * NPC AI: evaluates strategic decisions for non-player factions.
 * Now with faction-level strategic intent (expand/defend/develop),
 * coordinated target focus, and trait-based tactic selection.
 */
export function evaluateNPCDecisions(
  factions: FactionDef[],
  characters: CharacterNode[],
  cities: PlaceNode[],
  playerFactionId: string,
  alliances: Set<string> = new Set(),
  relationships: RelationshipEdge[] = [],
  adjacency?: AdjacencyMap,
  extCityMap?: Map<string, PlaceNode>,
  expansionAggression: number = 1.0,
): AIDecision[] {
  const decisions: AIDecision[] = [];
  const charMap = new Map(characters.map((c) => [c.id, c]));
  const cityMap = extCityMap ?? new Map(cities.map((c) => [c.id, c]));

  const charToFaction = new Map<string, string>();
  for (const f of factions) {
    for (const m of f.members) charToFaction.set(m, f.id);
  }

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
    const enemyCities = cities.filter((c) => {
      if (c.status === "dead" || !c.controllerId) return false;
      if (faction.members.includes(c.controllerId)) return false;
      const controllerFaction = charToFaction.get(c.controllerId);
      if (controllerFaction && isAllied(faction.id, controllerFaction)) return false;
      return true;
    });

    // Compute faction strategic intent
    const intent = evaluateStrategicIntent(faction, factionCities, enemyCities, defendersPerCity);

    // Pick a coordinated target: all attackers from this faction aim at the same city
    const focusTarget = intent === "expand"
      ? pickBestTarget(enemyCities, defendersPerCity, 2) // moderate caution for faction-level target
      : null;

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
        intent,
        focusTarget,
        adjacency,
        expansionAggression,
      );
      decisions.push(decision);
    }
  }

  return decisions;
}

/**
 * NPC spy decisions: factions may send spies against enemies.
 * Called from simulation-service after movement decisions.
 */
export function evaluateNPCSpyDecisions(
  factions: FactionDef[],
  characters: CharacterNode[],
  cities: PlaceNode[],
  playerFactionId: string,
  alliances: Set<string> = new Set(),
  activeSpyCharIds: Set<string> = new Set(),
  spyChancePerTick: number = 0.15,
): AISpyDecision[] {
  const decisions: AISpyDecision[] = [];
  const charToFaction = new Map<string, string>();
  for (const f of factions) {
    for (const m of f.members) charToFaction.set(m, f.id);
  }

  const isAllied = (fA: string, fB: string): boolean => {
    const key = [fA, fB].sort().join(":");
    return alliances.has(key);
  };

  for (const faction of factions) {
    if (faction.id === playerFactionId) continue;
    // Chance per tick for each NPC faction to attempt a spy mission
    if (Math.random() > spyChancePerTick) continue;

    const enemyCities = cities.filter((c) => {
      if (c.status === "dead" || !c.controllerId) return false;
      if (faction.members.includes(c.controllerId)) return false;
      const cf = charToFaction.get(c.controllerId);
      if (cf && isAllied(faction.id, cf)) return false;
      return true;
    });
    if (enemyCities.length === 0) continue;

    // Find a character with espionage or intelligence skill (prefer spymaster role)
    const factionChars = characters.filter(
      (c) => faction.members.includes(c.id) && c.cityId && !activeSpyCharIds.has(c.id),
    );
    // Score by espionage capability
    const spyCandidates = factionChars
      .map((c) => ({
        char: c,
        score: c.intelligence + (c.skills?.espionage ?? 0) * 3 + (c.role === "spymaster" ? 5 : 0),
      }))
      .filter((x) => x.score >= 3) // minimum threshold
      .sort((a, b) => b.score - a.score);

    if (spyCandidates.length === 0) continue;

    const spy = spyCandidates[0].char;
    const target = enemyCities[Math.floor(Math.random() * enemyCities.length)];

    // Choose mission type: sabotage if target has high garrison, intel otherwise
    const missionType: SpyMissionType = target.garrison >= 4 ? "sabotage" : "intel";

    decisions.push({
      characterId: spy.id,
      targetCityId: target.id,
      missionType,
      reason: `${spy.name} spies on ${target.name} (${missionType})`,
    });
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
  intent: StrategicIntent,
  focusTarget: PlaceNode | null,
  adjacency?: AdjacencyMap,
  expansionAggression: number = 1.0,
): AIDecision {
  const currentCity = cityMap.get(char.cityId);
  const isLeader = char.id === faction.leaderId;
  const { aggression, caution } = personalityWeight(char);

  // Compute reachable neighbors for adjacency filtering
  const reachableSet = adjacency
    ? new Set(getReachableNeighbors(char.cityId, adjacency, cityMap))
    : null;

  const viableEnemyCities = enemyCities.filter((c) => {
    if (reachableSet && !reachableSet.has(c.id)) return false;
    if (!c.controllerId) return true;
    const intimacy = getIntimacyWith(char.id, c.controllerId, relationships);
    return intimacy < 70;
  });

  // ── DEFEND intent: leaders stay, non-leaders reinforce weakest cities ──
  if (intent === "defend") {
    // Reinforce the weakest garrison faction city (reachable only)
    const weakest = factionCities
      .filter((c) => c.id !== char.cityId && (!reachableSet || reachableSet.has(c.id)))
      .sort((a, b) => a.garrison - b.garrison)[0];
    if (weakest && weakest.garrison <= 2 && !isLeader) {
      return {
        characterId: char.id,
        action: "move",
        targetCityId: weakest.id,
        reason: `[Defend] Reinforce ${weakest.name} (garrison ${weakest.garrison})`,
      };
    }
    return { characterId: char.id, action: "stay", reason: `[Defend] Hold position` };
  }

  // ── DEVELOP intent: stay and build (handled in npcSpend), only attack if obvious opportunity ──
  if (intent === "develop") {
    const easyTarget = viableEnemyCities.find(
      (c) => c.garrison <= 1 && (defendersPerCity.get(c.id)?.length ?? 0) === 0,
    );
    if (easyTarget && !isLeader) {
      const tactic = pickTactic(char, false);
      return {
        characterId: char.id,
        action: "attack",
        targetCityId: easyTarget.id,
        tactic,
        reason: `[Develop] Opportunistic grab on undefended ${easyTarget.name}`,
      };
    }
    return { characterId: char.id, action: "stay", reason: `[Develop] Stay and build` };
  }

  // ── EXPAND intent: coordinated offensive ──

  // Filter focus target by reachability
  const reachableFocusTarget = focusTarget && (!reachableSet || reachableSet.has(focusTarget.id)) ? focusTarget : null;

  // Leaders: attack the focus target if safe
  if (isLeader) {
    const homeDefenders = defendersPerCity.get(char.cityId)?.length ?? 0;
    const leaderThreshold = Math.max(1, 2 - Math.floor(aggression / 3));
    if (reachableFocusTarget && homeDefenders > leaderThreshold) {
      const tactic = pickTactic(char, false);
      return {
        characterId: char.id,
        action: "attack",
        targetCityId: reachableFocusTarget.id,
        tactic,
        reason: `[Expand] Leader leads assault on ${reachableFocusTarget.name}`,
      };
    }
    return { characterId: char.id, action: "stay", reason: "[Expand] Leader holds capital" };
  }

  // Non-leaders: coordinate on focus target if available
  const myDefenders = defendersPerCity.get(char.cityId)?.length ?? 0;

  // Priority 1: Join the coordinated attack on the focus target
  if (reachableFocusTarget && myDefenders > 1) {
    const tactic = pickTactic(char, false);
    return {
      characterId: char.id,
      action: "attack",
      targetCityId: reachableFocusTarget.id,
      tactic,
      reason: `[Expand] Coordinated assault on ${reachableFocusTarget.name}`,
    };
  }

  // Priority 2: Attack any weak target if overstaffed
  const attackThreshold = Math.max(1, 2 + Math.floor(caution / 2) - Math.floor(aggression / 2));
  if (myDefenders > attackThreshold && viableEnemyCities.length > 0) {
    const target = pickBestTarget(viableEnemyCities, defendersPerCity, caution);
    if (target) {
      const tactic = pickTactic(char, false);
      return {
        characterId: char.id,
        action: "attack",
        targetCityId: target.id,
        tactic,
        reason: `[Expand] Attack ${target.name} (personality-driven)`,
      };
    }
  }

  // Priority 3: Reinforce an allied city that has no defenders (reachable only)
  const emptyAlliedCity = factionCities.find(
    (c) => c.id !== char.cityId && (!reachableSet || reachableSet.has(c.id)) && (defendersPerCity.get(c.id)?.length ?? 0) === 0,
  );
  if (emptyAlliedCity) {
    return {
      characterId: char.id,
      action: "move",
      targetCityId: emptyAlliedCity.id,
      reason: `[Expand] Reinforce empty ${emptyAlliedCity.name}`,
    };
  }

  // Priority 4: Random opportunistic attack (scaled by expansion aggression)
  const randomAttackChance = (0.15 + aggression * 0.05 - caution * 0.03) * expansionAggression;
  if (Math.random() < randomAttackChance && viableEnemyCities.length > 0) {
    const target = viableEnemyCities[Math.floor(Math.random() * viableEnemyCities.length)];
    const tactic = pickTactic(char, false);
    return {
      characterId: char.id,
      action: "attack",
      targetCityId: target.id,
      tactic,
      reason: `[Expand] Opportunistic attack on ${target.name}`,
    };
  }

  return { characterId: char.id, action: "stay", reason: "[Expand] Hold position" };
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
    let score = 10 - defenders * (1 + caution * 0.3) - garrison * 0.8;
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
