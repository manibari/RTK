// Game balance configuration — centralized numeric constants per difficulty

export type Difficulty = "easy" | "normal" | "hard";

export interface BalanceConfig {
  difficulty: Difficulty;

  economy: {
    majorCityBaseIncome: number;
    minorCityBaseIncome: number;
    developmentMultiplierPerLevel: number;
    commerceDistrictBonus: number; // e.g. 0.5 = +50%
    tradeRouteGoldBonus: number;
    maxTradeRoutesPerCity: number;
  };

  costs: {
    reinforce: number;
    develop: number;
    buildImprovement: number;
    buildDistrict: number;
    hireNeutral: number;
    spyMission: number;
    establishTrade: number;
    buildSiege: number;
    setPath: number;
    transferTroops: number;
  };

  victory: {
    diplomaticConsecutiveTicks: number;
    economicGoldShareThreshold: number; // e.g. 0.90 = 90%
    economicConsecutiveTicks: number;
  };

  tech: {
    researchTimeMultiplier: number;
    researchCostMultiplier: number;
  };

  combat: {
    baseDeathChance: number;
    aggressiveDeathChance: number;
    baseSiegeDelay: number;
    conquestGarrisonPenalty: number; // garrison lost by captured city on conquest
    troopHardCap: number;            // absolute max troops per character
    troopSoftCapBase: number;        // base soft cap before leadership bonus
    troopOverloadPenaltyRate: number; // combat penalty per excess troop
  };

  events: {
    worldEventChance: number;
    eventCardChance: number;
    eventCardGoldScale: number;
    winterFoodLoss: number;
  };

  npcAI: {
    npcIncomeMultiplier: number;
    npcCostMultiplier: number;
    spyChancePerTick: number;
    npcExpansionAggression: number;
    freeGarrisonPerSeason: number;
    underdogCityThreshold: number;        // factions with <= N cities get protection
    underdogFreeGarrisonPerTick: number;  // free garrison per tick for underdog cities
  };

  food: {
    majorCityFoodIncome: number;
    minorCityFoodIncome: number;
  };

  loyalty: {
    initialLoyalty: number;
    capturedCityLoyalty: number;
    foreignDecayPerTick: number;
    foreignDecayDurationMonths: number; // months of instability after capture
    rebellionThreshold: number;
    rebellionChance: number;
    rebellionCooldownTicks: number; // ticks of immunity after a rebellion
  };

  garrison: {
    recoveryInterval: number;     // ticks between passive +1
    majorCityGarrisonCap: number; // natural recovery cap for major cities
    minorCityGarrisonCap: number; // natural recovery cap for minor cities
  };

  diplomacy: {
    threatPerConquest: number;            // AE gained per city conquest
    threatPerConquestMajor: number;       // AE gained per major city conquest
    threatDecayPerTick: number;           // natural threat decay per tick
    threatWarThreshold: number;           // threshold for AI hostility
    truceDurationTicks: number;           // auto-truce length after battle
    truceBrokenThreatPenalty: number;     // threat penalty for breaking truce
    powerRatioMinToAttack: number;        // AI won't attack unless power ratio >= this
    warExhaustionPerBattle: number;       // exhaustion gained per battle
    warExhaustionDefendThreshold: number; // AI goes defensive above this
  };
}

export const BALANCE_EASY: BalanceConfig = {
  difficulty: "easy",

  economy: {
    majorCityBaseIncome: 60,
    minorCityBaseIncome: 30,
    developmentMultiplierPerLevel: 0.3,
    commerceDistrictBonus: 0.8,
    tradeRouteGoldBonus: 10,
    maxTradeRoutesPerCity: 3,
  },

  costs: {
    reinforce: 60,
    develop: 300,
    buildImprovement: 500,
    buildDistrict: 400,
    hireNeutral: 200,
    spyMission: 100,
    establishTrade: 200,
    buildSiege: 300,
    setPath: 400,
    transferTroops: 20,
  },

  victory: {
    diplomaticConsecutiveTicks: 15,
    economicGoldShareThreshold: 0.80,
    economicConsecutiveTicks: 8,
  },

  tech: {
    researchTimeMultiplier: 0.9,
    researchCostMultiplier: 0.9,
  },

  combat: {
    baseDeathChance: 0.15,
    aggressiveDeathChance: 0.25,
    baseSiegeDelay: 3,
    conquestGarrisonPenalty: 1,
    troopHardCap: 8,
    troopSoftCapBase: 3,
    troopOverloadPenaltyRate: 0.08,
  },

  events: {
    worldEventChance: 0.15,
    eventCardChance: 0.30,
    eventCardGoldScale: 1.0,
    winterFoodLoss: 10,
  },

  npcAI: {
    npcIncomeMultiplier: 0.85,
    npcCostMultiplier: 1.15,
    spyChancePerTick: 0.10,
    npcExpansionAggression: 0.5,
    freeGarrisonPerSeason: 0,
    underdogCityThreshold: 2,
    underdogFreeGarrisonPerTick: 2,
  },

  food: {
    majorCityFoodIncome: 30,
    minorCityFoodIncome: 15,
  },

  loyalty: {
    initialLoyalty: 60,
    capturedCityLoyalty: 50,
    foreignDecayPerTick: 1,
    foreignDecayDurationMonths: 12,
    rebellionThreshold: 15,
    rebellionChance: 0.15,
    rebellionCooldownTicks: 5,
  },

  garrison: {
    recoveryInterval: 2,
    majorCityGarrisonCap: 10,
    minorCityGarrisonCap: 7,
  },

  diplomacy: {
    threatPerConquest: 15,
    threatPerConquestMajor: 30,
    threatDecayPerTick: 0.5,
    threatWarThreshold: 40,
    truceDurationTicks: 10,
    truceBrokenThreatPenalty: 30,
    powerRatioMinToAttack: 1.2,
    warExhaustionPerBattle: 3,
    warExhaustionDefendThreshold: 70,
  },
};

export const BALANCE_NORMAL: BalanceConfig = {
  difficulty: "normal",

  economy: {
    majorCityBaseIncome: 50,
    minorCityBaseIncome: 25,
    developmentMultiplierPerLevel: 0.2,
    commerceDistrictBonus: 0.5,
    tradeRouteGoldBonus: 7,
    maxTradeRoutesPerCity: 2,
  },

  costs: {
    reinforce: 80,
    develop: 400,
    buildImprovement: 600,
    buildDistrict: 500,
    hireNeutral: 200,
    spyMission: 100,
    establishTrade: 200,
    buildSiege: 300,
    setPath: 400,
    transferTroops: 30,
  },

  victory: {
    diplomaticConsecutiveTicks: 30,
    economicGoldShareThreshold: 0.90,
    economicConsecutiveTicks: 15,
  },

  tech: {
    researchTimeMultiplier: 1.3,
    researchCostMultiplier: 1.2,
  },

  combat: {
    baseDeathChance: 0.15,
    aggressiveDeathChance: 0.25,
    baseSiegeDelay: 3,
    conquestGarrisonPenalty: 2,
    troopHardCap: 8,
    troopSoftCapBase: 2,
    troopOverloadPenaltyRate: 0.10,
  },

  events: {
    worldEventChance: 0.20,
    eventCardChance: 0.25,
    eventCardGoldScale: 0.7,
    winterFoodLoss: 15,
  },

  npcAI: {
    npcIncomeMultiplier: 1.0,
    npcCostMultiplier: 1.0,
    spyChancePerTick: 0.15,
    npcExpansionAggression: 0.7,
    freeGarrisonPerSeason: 0,
    underdogCityThreshold: 2,
    underdogFreeGarrisonPerTick: 1,
  },

  food: {
    majorCityFoodIncome: 30,
    minorCityFoodIncome: 15,
  },

  loyalty: {
    initialLoyalty: 50,
    capturedCityLoyalty: 50,
    foreignDecayPerTick: 2,
    foreignDecayDurationMonths: 9,
    rebellionThreshold: 20,
    rebellionChance: 0.20,
    rebellionCooldownTicks: 4,
  },

  garrison: {
    recoveryInterval: 3,
    majorCityGarrisonCap: 8,
    minorCityGarrisonCap: 5,
  },

  diplomacy: {
    threatPerConquest: 15,
    threatPerConquestMajor: 30,
    threatDecayPerTick: 0.5,
    threatWarThreshold: 40,
    truceDurationTicks: 8,
    truceBrokenThreatPenalty: 30,
    powerRatioMinToAttack: 1.2,
    warExhaustionPerBattle: 3,
    warExhaustionDefendThreshold: 70,
  },
};

export const BALANCE_HARD: BalanceConfig = {
  difficulty: "hard",

  economy: {
    majorCityBaseIncome: 35,
    minorCityBaseIncome: 18,
    developmentMultiplierPerLevel: 0.15,
    commerceDistrictBonus: 0.4,
    tradeRouteGoldBonus: 5,
    maxTradeRoutesPerCity: 2,
  },

  costs: {
    reinforce: 120,
    develop: 500,
    buildImprovement: 700,
    buildDistrict: 600,
    hireNeutral: 200,
    spyMission: 100,
    establishTrade: 200,
    buildSiege: 300,
    setPath: 400,
    transferTroops: 50,
  },

  victory: {
    diplomaticConsecutiveTicks: 40,
    economicGoldShareThreshold: 0.92,
    economicConsecutiveTicks: 20,
  },

  tech: {
    researchTimeMultiplier: 1.5,
    researchCostMultiplier: 1.4,
  },

  combat: {
    baseDeathChance: 0.15,
    aggressiveDeathChance: 0.25,
    baseSiegeDelay: 3,
    conquestGarrisonPenalty: 2,
    troopHardCap: 8,
    troopSoftCapBase: 2,
    troopOverloadPenaltyRate: 0.12,
  },

  events: {
    worldEventChance: 0.25,
    eventCardChance: 0.20,
    eventCardGoldScale: 0.5,
    winterFoodLoss: 20,
  },

  npcAI: {
    npcIncomeMultiplier: 1.25,
    npcCostMultiplier: 0.8,
    spyChancePerTick: 0.20,
    npcExpansionAggression: 1.0,
    freeGarrisonPerSeason: 1,
    underdogCityThreshold: 1,
    underdogFreeGarrisonPerTick: 1,
  },

  food: {
    majorCityFoodIncome: 30,
    minorCityFoodIncome: 15,
  },

  loyalty: {
    initialLoyalty: 50,
    capturedCityLoyalty: 40,
    foreignDecayPerTick: 3,
    foreignDecayDurationMonths: 6,
    rebellionThreshold: 25,
    rebellionChance: 0.30,
    rebellionCooldownTicks: 3,
  },

  garrison: {
    recoveryInterval: 4,
    majorCityGarrisonCap: 6,
    minorCityGarrisonCap: 4,
  },

  diplomacy: {
    threatPerConquest: 10,
    threatPerConquestMajor: 20,
    threatDecayPerTick: 0.8,
    threatWarThreshold: 50,
    truceDurationTicks: 5,
    truceBrokenThreatPenalty: 20,
    powerRatioMinToAttack: 1.0,
    warExhaustionPerBattle: 2,
    warExhaustionDefendThreshold: 80,
  },
};

const BALANCE_CONFIGS: Record<Difficulty, BalanceConfig> = {
  easy: BALANCE_EASY,
  normal: BALANCE_NORMAL,
  hard: BALANCE_HARD,
};

export function getBalanceConfig(difficulty: Difficulty): BalanceConfig {
  return BALANCE_CONFIGS[difficulty];
}
