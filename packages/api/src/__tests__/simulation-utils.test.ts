import { describe, it, expect } from "vitest";
import {
  calculateDefensePower,
  calculateAttackPower,
  calculateGoldIncome,
  calculateLoyaltyDelta,
  shouldRebel,
  isSupplied,
  calculateFoodProduction,
} from "../simulation-utils.js";
import type { RoadEdge } from "@rtk/graph-db";
import { buildAdjacencyMap } from "../roads.js";

describe("calculateDefensePower", () => {
  it("returns garrison + tier bonus with no defenders", () => {
    const result = calculateDefensePower({
      garrison: 5,
      tierBonus: 3,
      seasonDefenseBonus: 0,
      forgeMultiplier: 1,
      hasDefenseDistrict: false,
      isFortressPath: false,
      defenderMilitary: [],
      defenderIntelligence: [],
      defenderTactics: [],
    });
    expect(result).toBe(8);
  });

  it("applies forge multiplier to garrison", () => {
    const result = calculateDefensePower({
      garrison: 4,
      tierBonus: 1,
      seasonDefenseBonus: 0,
      forgeMultiplier: 1.5,
      hasDefenseDistrict: false,
      isFortressPath: false,
      defenderMilitary: [],
      defenderIntelligence: [],
      defenderTactics: [],
    });
    expect(result).toBe(7); // round(4*1.5) + 1 = 7
  });

  it("adds defense district +2 bonus", () => {
    const result = calculateDefensePower({
      garrison: 3,
      tierBonus: 1,
      seasonDefenseBonus: 0,
      forgeMultiplier: 1,
      hasDefenseDistrict: true,
      isFortressPath: false,
      defenderMilitary: [],
      defenderIntelligence: [],
      defenderTactics: [],
    });
    expect(result).toBe(6); // 3 + 2 + 1
  });

  it("applies fortress path 1.2x garrison multiplier", () => {
    const result = calculateDefensePower({
      garrison: 5,
      tierBonus: 1,
      seasonDefenseBonus: 0,
      forgeMultiplier: 1,
      hasDefenseDistrict: false,
      isFortressPath: true,
      defenderMilitary: [],
      defenderIntelligence: [],
      defenderTactics: [],
    });
    expect(result).toBe(7); // round(5*1.2) + 1 = 7
  });

  it("adds defender military contribution", () => {
    const result = calculateDefensePower({
      garrison: 3,
      tierBonus: 1,
      seasonDefenseBonus: 0,
      forgeMultiplier: 1,
      hasDefenseDistrict: false,
      isFortressPath: false,
      defenderMilitary: [90],
      defenderIntelligence: [50],
      defenderTactics: [40],
    });
    // 3 + 1 + 90/10 + 50/10*0.5 + 40/20*0.5 = 4 + 9 + 2.5 + 1 = 16.5
    expect(result).toBeCloseTo(16.5, 1);
  });
});

describe("calculateAttackPower", () => {
  it("calculates basic attack from single attacker", () => {
    const result = calculateAttackPower({
      attackerMilitary: [80],
      attackerIntelligence: [40],
      attackerTactics: [60],
      roleAttackBonuses: [0],
      totalTroops: 0,
      tacticAttackMod: 0,
      moraleMultiplier: 1,
      legacyBonus: 0,
      warMachineTradition: false,
    });
    // 80/10 + 40/10*0.5 + 60/20*0.5 = 8 + 2 + 1.5 = 11.5
    expect(result).toBeCloseTo(11.5, 1);
  });

  it("applies general role 20% bonus", () => {
    const result = calculateAttackPower({
      attackerMilitary: [100],
      attackerIntelligence: [0],
      attackerTactics: [0],
      roleAttackBonuses: [0.2],
      totalTroops: 0,
      tacticAttackMod: 0,
      moraleMultiplier: 1,
      legacyBonus: 0,
      warMachineTradition: false,
    });
    expect(result).toBeCloseTo(12, 1); // 10 * 1.2 = 12
  });

  it("adds troops to attack power", () => {
    const result = calculateAttackPower({
      attackerMilitary: [50],
      attackerIntelligence: [0],
      attackerTactics: [0],
      roleAttackBonuses: [0],
      totalTroops: 3,
      tacticAttackMod: 0,
      moraleMultiplier: 1,
      legacyBonus: 0,
      warMachineTradition: false,
    });
    expect(result).toBeCloseTo(8, 1); // 5 + 3
  });

  it("applies aggressive tactic +30% attack", () => {
    const result = calculateAttackPower({
      attackerMilitary: [100],
      attackerIntelligence: [0],
      attackerTactics: [0],
      roleAttackBonuses: [0],
      totalTroops: 0,
      tacticAttackMod: 0.3,
      moraleMultiplier: 1,
      legacyBonus: 0,
      warMachineTradition: false,
    });
    expect(result).toBeCloseTo(13, 1); // 10 * 1.3
  });

  it("applies war machine tradition +10%", () => {
    const result = calculateAttackPower({
      attackerMilitary: [100],
      attackerIntelligence: [0],
      attackerTactics: [0],
      roleAttackBonuses: [0],
      totalTroops: 0,
      tacticAttackMod: 0,
      moraleMultiplier: 1,
      legacyBonus: 0,
      warMachineTradition: true,
    });
    expect(result).toBeCloseTo(11, 1); // 10 * 1.1
  });
});

describe("calculateGoldIncome", () => {
  const baseConfig = {
    majorCityBaseIncome: 50,
    minorCityBaseIncome: 25,
    developmentMultiplierPerLevel: 0.2,
    commerceDistrictBonus: 0.5,
  };

  it("returns base income for a plain major city", () => {
    const result = calculateGoldIncome({
      tier: "major",
      development: 0,
      isUnsupplied: false,
      specialty: "military_academy",
      hasImprovement: false,
      bestCommerce: 0,
      hasGovernor: false,
      hasCommerceDistrict: false,
      isTradeHub: false,
      warExhaustionOver50: false,
      isEconomicPowerhouse: false,
      isNPC: false,
      seasonMultiplier: 1,
      npcIncomeMultiplier: 1,
      config: baseConfig,
    });
    expect(result).toBe(50);
  });

  it("returns base income for a plain minor city", () => {
    const result = calculateGoldIncome({
      tier: "minor",
      development: 0,
      isUnsupplied: false,
      specialty: "granary",
      hasImprovement: false,
      bestCommerce: 0,
      hasGovernor: false,
      hasCommerceDistrict: false,
      isTradeHub: false,
      warExhaustionOver50: false,
      isEconomicPowerhouse: false,
      isNPC: false,
      seasonMultiplier: 1,
      npcIncomeMultiplier: 1,
      config: baseConfig,
    });
    expect(result).toBe(25);
  });

  it("unsupplied cities get -50% income", () => {
    const result = calculateGoldIncome({
      tier: "major",
      development: 0,
      isUnsupplied: true,
      specialty: "military_academy",
      hasImprovement: false,
      bestCommerce: 0,
      hasGovernor: false,
      hasCommerceDistrict: false,
      isTradeHub: false,
      warExhaustionOver50: false,
      isEconomicPowerhouse: false,
      isNPC: false,
      seasonMultiplier: 1,
      npcIncomeMultiplier: 1,
      config: baseConfig,
    });
    expect(result).toBe(25); // 50 * 0.5
  });

  it("development increases income", () => {
    const result = calculateGoldIncome({
      tier: "major",
      development: 3,
      isUnsupplied: false,
      specialty: "granary",
      hasImprovement: false,
      bestCommerce: 0,
      hasGovernor: false,
      hasCommerceDistrict: false,
      isTradeHub: false,
      warExhaustionOver50: false,
      isEconomicPowerhouse: false,
      isNPC: false,
      seasonMultiplier: 1,
      npcIncomeMultiplier: 1,
      config: baseConfig,
    });
    expect(result).toBe(80); // 50 * (1 + 3*0.2) = 50 * 1.6 = 80
  });

  it("market specialty adds +50% income", () => {
    const result = calculateGoldIncome({
      tier: "minor",
      development: 0,
      isUnsupplied: false,
      specialty: "market",
      hasImprovement: false,
      bestCommerce: 0,
      hasGovernor: false,
      hasCommerceDistrict: false,
      isTradeHub: false,
      warExhaustionOver50: false,
      isEconomicPowerhouse: false,
      isNPC: false,
      seasonMultiplier: 1,
      npcIncomeMultiplier: 1,
      config: baseConfig,
    });
    expect(result).toBe(38); // 25 * 1.5 = 37.5 → 38
  });
});

describe("calculateLoyaltyDelta", () => {
  it("returns unchanged loyalty for a stable allied city", () => {
    const result = calculateLoyaltyDelta({
      currentLoyalty: 50,
      isForeignController: false,
      foreignDecayPerTick: 2,
      garrisonBelow1: false,
      warExhaustionOver50: false,
      hasGovernor: false,
      development: 0,
      tradeRouteCount: 0,
      isCulturalPath: false,
      isAllied: true,
    });
    expect(result).toBe(51); // +1 for allied
  });

  it("applies foreign decay", () => {
    const result = calculateLoyaltyDelta({
      currentLoyalty: 50,
      isForeignController: true,
      foreignDecayPerTick: 3,
      garrisonBelow1: false,
      warExhaustionOver50: false,
      hasGovernor: false,
      development: 0,
      tradeRouteCount: 0,
      isCulturalPath: false,
      isAllied: false,
    });
    expect(result).toBe(47);
  });

  it("governor adds +2 loyalty", () => {
    const result = calculateLoyaltyDelta({
      currentLoyalty: 50,
      isForeignController: false,
      foreignDecayPerTick: 0,
      garrisonBelow1: false,
      warExhaustionOver50: false,
      hasGovernor: true,
      development: 0,
      tradeRouteCount: 0,
      isCulturalPath: false,
      isAllied: false,
    });
    expect(result).toBe(52);
  });

  it("cultural path prevents loyalty below 60", () => {
    const result = calculateLoyaltyDelta({
      currentLoyalty: 40,
      isForeignController: true,
      foreignDecayPerTick: 5,
      garrisonBelow1: true,
      warExhaustionOver50: true,
      hasGovernor: false,
      development: 0,
      tradeRouteCount: 0,
      isCulturalPath: true,
      isAllied: false,
    });
    expect(result).toBe(60); // cultural path floor
  });

  it("clamps loyalty between 0 and 100", () => {
    const high = calculateLoyaltyDelta({
      currentLoyalty: 99,
      isForeignController: false,
      foreignDecayPerTick: 0,
      garrisonBelow1: false,
      warExhaustionOver50: false,
      hasGovernor: true,
      development: 5,
      tradeRouteCount: 3,
      isCulturalPath: false,
      isAllied: true,
    });
    expect(high).toBe(100);

    const low = calculateLoyaltyDelta({
      currentLoyalty: 3,
      isForeignController: true,
      foreignDecayPerTick: 5,
      garrisonBelow1: true,
      warExhaustionOver50: true,
      hasGovernor: false,
      development: 0,
      tradeRouteCount: 0,
      isCulturalPath: false,
      isAllied: false,
    });
    expect(low).toBe(0);
  });
});

describe("shouldRebel", () => {
  it("returns false when loyalty >= threshold", () => {
    expect(shouldRebel({
      loyalty: 25,
      rebellionThreshold: 20,
      rebellionChance: 0.5,
      garrison: 3,
      gold: 100,
    }, 0.3)).toBe(false);
  });

  it("returns true when loyalty < threshold and random <= chance", () => {
    expect(shouldRebel({
      loyalty: 10,
      rebellionThreshold: 20,
      rebellionChance: 0.5,
      garrison: 3,
      gold: 100,
    }, 0.3)).toBe(true);
  });

  it("returns false when loyalty < threshold but random > chance", () => {
    expect(shouldRebel({
      loyalty: 10,
      rebellionThreshold: 20,
      rebellionChance: 0.2,
      garrison: 3,
      gold: 100,
    }, 0.5)).toBe(false);
  });
});

describe("isSupplied", () => {
  const roads: RoadEdge[] = [
    { fromCityId: "a", toCityId: "b", type: "official", travelTime: 1 },
    { fromCityId: "b", toCityId: "c", type: "official", travelTime: 1 },
    { fromCityId: "d", toCityId: "e", type: "official", travelTime: 1 },
  ];
  const adjacency = buildAdjacencyMap(roads);

  it("capital is always supplied", () => {
    expect(isSupplied("a", "a", new Set(["a", "b", "c"]), adjacency)).toBe(true);
  });

  it("connected city is supplied", () => {
    expect(isSupplied("c", "a", new Set(["a", "b", "c"]), adjacency)).toBe(true);
  });

  it("disconnected city is not supplied", () => {
    expect(isSupplied("d", "a", new Set(["a", "b", "d"]), adjacency)).toBe(false);
  });

  it("returns false when capital is not in faction cities", () => {
    expect(isSupplied("b", "x", new Set(["a", "b"]), adjacency)).toBe(false);
  });
});

describe("calculateFoodProduction", () => {
  const baseConfig = {
    majorCityFoodIncome: 30,
    minorCityFoodIncome: 15,
  };

  it("produces base food for minor city", () => {
    const result = calculateFoodProduction({
      tier: "minor",
      specialty: "forge",
      hasImprovement: false,
      hasAgricultureDistrict: false,
      isBreadbasketPath: false,
      isWinter: false,
      isDrought: false,
      garrison: 2,
      isSieged: false,
      currentFood: 50,
      config: baseConfig,
    });
    // 50 + 15 - 2*5 = 55
    expect(result).toBe(55);
  });

  it("granary doubles food income", () => {
    const result = calculateFoodProduction({
      tier: "minor",
      specialty: "granary",
      hasImprovement: false,
      hasAgricultureDistrict: false,
      isBreadbasketPath: false,
      isWinter: false,
      isDrought: false,
      garrison: 2,
      isSieged: false,
      currentFood: 50,
      config: baseConfig,
    });
    // 50 + 30 - 10 = 70
    expect(result).toBe(70);
  });

  it("winter reduces food by 40%", () => {
    const result = calculateFoodProduction({
      tier: "major",
      specialty: "forge",
      hasImprovement: false,
      hasAgricultureDistrict: false,
      isBreadbasketPath: false,
      isWinter: true,
      isDrought: false,
      garrison: 3,
      isSieged: false,
      currentFood: 100,
      config: baseConfig,
    });
    // 100 + round(30*0.6) - 15 = 100 + 18 - 15 = 103
    expect(result).toBe(103);
  });

  it("siege doubles food consumption", () => {
    const result = calculateFoodProduction({
      tier: "minor",
      specialty: "forge",
      hasImprovement: false,
      hasAgricultureDistrict: false,
      isBreadbasketPath: false,
      isWinter: false,
      isDrought: false,
      garrison: 4,
      isSieged: true,
      currentFood: 50,
      config: baseConfig,
    });
    // 50 + 15 - 4*5*2 = 50 + 15 - 40 = 25
    expect(result).toBe(25);
  });

  it("food never goes below 0", () => {
    const result = calculateFoodProduction({
      tier: "minor",
      specialty: "forge",
      hasImprovement: false,
      hasAgricultureDistrict: false,
      isBreadbasketPath: false,
      isWinter: false,
      isDrought: false,
      garrison: 10,
      isSieged: true,
      currentFood: 0,
      config: baseConfig,
    });
    // 0 + 15 - 100 = max(0, -85) = 0
    expect(result).toBe(0);
  });
});
