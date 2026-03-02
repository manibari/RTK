// Pure utility functions extracted from simulation-service.ts for testability

import type { PlaceNode } from "@rtk/graph-db";
import type { AdjacencyMap } from "./roads.js";

export interface CombatParams {
  garrison: number;
  tierBonus: number;
  seasonDefenseBonus: number;
  forgeMultiplier: number;
  hasDefenseDistrict: boolean;
  isFortressPath: boolean;
  defenderMilitary: number[];
  defenderIntelligence: number[];
  defenderTactics: number[];
}

/**
 * Calculate defense power for a city battle.
 */
export function calculateDefensePower(params: CombatParams): number {
  let garrisonPower = params.garrison;
  garrisonPower = Math.round(garrisonPower * params.forgeMultiplier);
  if (params.hasDefenseDistrict) garrisonPower += 2;
  if (params.isFortressPath) garrisonPower = Math.round(garrisonPower * 1.2);
  let defensePower = garrisonPower + params.tierBonus + params.seasonDefenseBonus;
  for (let i = 0; i < params.defenderMilitary.length; i++) {
    defensePower += params.defenderMilitary[i] / 10
      + (params.defenderIntelligence[i] ?? 0) / 10 * 0.5
      + (params.defenderTactics[i] ?? 0) / 20 * 0.5;
  }
  return defensePower;
}

export interface AttackParams {
  attackerMilitary: number[];
  attackerIntelligence: number[];
  attackerTactics: number[];
  roleAttackBonuses: number[];
  totalTroops: number;
  tacticAttackMod: number;
  moraleMultiplier: number;
  legacyBonus: number;
  warMachineTradition: boolean;
}

/**
 * Calculate attack power for a city battle.
 */
export function calculateAttackPower(params: AttackParams): number {
  let attackPower = 0;
  for (let i = 0; i < params.attackerMilitary.length; i++) {
    const base = params.attackerMilitary[i] / 10
      + (params.attackerIntelligence[i] ?? 0) / 10 * 0.5
      + (params.attackerTactics[i] ?? 0) / 20 * 0.5;
    attackPower += base * (1 + (params.roleAttackBonuses[i] ?? 0));
  }
  attackPower += params.totalTroops;
  attackPower *= (1 + params.tacticAttackMod);
  attackPower *= params.moraleMultiplier;
  if (params.legacyBonus > 0) attackPower += Math.min(params.legacyBonus, 5);
  if (params.warMachineTradition) attackPower *= 1.1;
  return attackPower;
}

export interface GoldIncomeParams {
  tier: "major" | "minor";
  development: number;
  isUnsupplied: boolean;
  specialty: string;
  hasImprovement: boolean;
  bestCommerce: number;
  hasGovernor: boolean;
  hasCommerceDistrict: boolean;
  isTradeHub: boolean;
  warExhaustionOver50: boolean;
  isEconomicPowerhouse: boolean;
  isNPC: boolean;
  seasonMultiplier: number;
  npcIncomeMultiplier: number;
  config: {
    majorCityBaseIncome: number;
    minorCityBaseIncome: number;
    developmentMultiplierPerLevel: number;
    commerceDistrictBonus: number;
  };
}

/**
 * Calculate gold income for a city.
 */
export function calculateGoldIncome(params: GoldIncomeParams): number {
  const baseIncome = params.tier === "major" ? params.config.majorCityBaseIncome : params.config.minorCityBaseIncome;
  let multiplier = 1 + params.development * params.config.developmentMultiplierPerLevel;
  if (params.isUnsupplied) multiplier *= 0.5;
  if (params.specialty === "market") {
    multiplier += params.hasImprovement ? 1.0 : 0.5;
  }
  multiplier += params.bestCommerce * 0.005;
  if (params.hasGovernor) multiplier += 0.2;
  if (params.hasCommerceDistrict) multiplier += params.config.commerceDistrictBonus;
  if (params.isTradeHub) multiplier += 0.5;
  if (params.warExhaustionOver50) multiplier *= 0.8;
  if (params.isEconomicPowerhouse) multiplier += 0.2;
  const npcIncomeMult = params.isNPC ? params.npcIncomeMultiplier : 1;
  return Math.round(baseIncome * multiplier * params.seasonMultiplier * npcIncomeMult);
}

export interface LoyaltyDeltaParams {
  currentLoyalty: number;
  isForeignController: boolean;
  foreignDecayPerTick: number;
  garrisonBelow1: boolean;
  warExhaustionOver50: boolean;
  hasGovernor: boolean;
  development: number;
  tradeRouteCount: number;
  isCulturalPath: boolean;
  isAllied: boolean;
}

/**
 * Calculate the new loyalty value after a tick.
 */
export function calculateLoyaltyDelta(params: LoyaltyDeltaParams): number {
  let loyalty = params.currentLoyalty;
  if (params.isForeignController) loyalty -= params.foreignDecayPerTick;
  if (params.garrisonBelow1) loyalty -= 1;
  if (params.warExhaustionOver50) loyalty -= 1;
  if (params.hasGovernor) loyalty += 2;
  loyalty += params.development * 0.5;
  loyalty += params.tradeRouteCount;
  if (params.isCulturalPath && loyalty < 60) loyalty = 60;
  if (params.isAllied) loyalty += 1;
  return Math.max(0, Math.min(100, loyalty));
}

export interface RebellionParams {
  loyalty: number;
  rebellionThreshold: number;
  rebellionChance: number;
  garrison: number;
  gold: number;
}

/**
 * Determine if a city should rebel (deterministic check, caller provides random).
 */
export function shouldRebel(params: RebellionParams, random: number): boolean {
  if (params.loyalty >= params.rebellionThreshold) return false;
  return random <= params.rebellionChance;
}

/**
 * BFS to check if a city is supplied (connected to capital through faction territory).
 */
export function isSupplied(
  cityId: string,
  capitalCityId: string,
  factionCityIds: Set<string>,
  adjacency: AdjacencyMap,
): boolean {
  if (cityId === capitalCityId) return true;
  if (!factionCityIds.has(capitalCityId)) return false;

  const visited = new Set<string>([capitalCityId]);
  const queue = [capitalCityId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const roads = adjacency.get(current) ?? [];
    for (const road of roads) {
      const neighborId = road.fromCityId === current ? road.toCityId : road.fromCityId;
      if (visited.has(neighborId)) continue;
      if (!factionCityIds.has(neighborId)) continue;
      if (neighborId === cityId) return true;
      visited.add(neighborId);
      queue.push(neighborId);
    }
  }
  return false;
}

export interface FoodProductionParams {
  tier: "major" | "minor";
  specialty: string;
  hasImprovement: boolean;
  hasAgricultureDistrict: boolean;
  isBreadbasketPath: boolean;
  isWinter: boolean;
  isDrought: boolean;
  garrison: number;
  isSieged: boolean;
  currentFood: number;
  config: {
    majorCityFoodIncome: number;
    minorCityFoodIncome: number;
  };
}

/**
 * Calculate food production / consumption for a city.
 * Returns the new food value.
 */
export function calculateFoodProduction(params: FoodProductionParams): number {
  let foodIncome = params.tier === "major" ? params.config.majorCityFoodIncome : params.config.minorCityFoodIncome;
  if (params.specialty === "granary") foodIncome *= params.hasImprovement ? 3 : 2;
  if (params.hasAgricultureDistrict) foodIncome = Math.round(foodIncome * 1.6);
  if (params.isBreadbasketPath) foodIncome = Math.round(foodIncome * 1.5);
  if (params.isWinter) foodIncome = Math.round(foodIncome * 0.6);
  if (params.isDrought) foodIncome = Math.round(foodIncome * 0.5);
  const consumption = params.garrison * 5 * (params.isSieged ? 2 : 1);
  return Math.max(0, params.currentFood + foodIncome - consumption);
}
