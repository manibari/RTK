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
    freeGarrisonPer4Ticks: number;
  };

  food: {
    majorCityFoodIncome: number;
    minorCityFoodIncome: number;
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
    reinforce: 100,
    develop: 300,
    buildImprovement: 500,
    buildDistrict: 400,
    hireNeutral: 200,
    spyMission: 100,
    establishTrade: 200,
    buildSiege: 300,
    setPath: 400,
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
    baseSiegeDelay: 2,
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
    npcExpansionAggression: 0.7,
    freeGarrisonPer4Ticks: 0,
  },

  food: {
    majorCityFoodIncome: 30,
    minorCityFoodIncome: 15,
  },
};

export const BALANCE_NORMAL: BalanceConfig = {
  difficulty: "normal",

  economy: {
    majorCityBaseIncome: 40,
    minorCityBaseIncome: 20,
    developmentMultiplierPerLevel: 0.2,
    commerceDistrictBonus: 0.5,
    tradeRouteGoldBonus: 7,
    maxTradeRoutesPerCity: 2,
  },

  costs: {
    reinforce: 150,
    develop: 400,
    buildImprovement: 600,
    buildDistrict: 500,
    hireNeutral: 200,
    spyMission: 100,
    establishTrade: 200,
    buildSiege: 300,
    setPath: 400,
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
    baseSiegeDelay: 2,
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
    npcExpansionAggression: 1.0,
    freeGarrisonPer4Ticks: 0,
  },

  food: {
    majorCityFoodIncome: 30,
    minorCityFoodIncome: 15,
  },
};

export const BALANCE_HARD: BalanceConfig = {
  difficulty: "hard",

  economy: {
    majorCityBaseIncome: 30,
    minorCityBaseIncome: 15,
    developmentMultiplierPerLevel: 0.15,
    commerceDistrictBonus: 0.4,
    tradeRouteGoldBonus: 5,
    maxTradeRoutesPerCity: 2,
  },

  costs: {
    reinforce: 200,
    develop: 500,
    buildImprovement: 700,
    buildDistrict: 600,
    hireNeutral: 200,
    spyMission: 100,
    establishTrade: 200,
    buildSiege: 300,
    setPath: 400,
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
    baseSiegeDelay: 2,
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
    npcExpansionAggression: 1.3,
    freeGarrisonPer4Ticks: 1,
  },

  food: {
    majorCityFoodIncome: 30,
    minorCityFoodIncome: 15,
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
