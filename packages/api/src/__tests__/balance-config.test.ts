import { describe, it, expect } from "vitest";
import {
  BALANCE_EASY,
  BALANCE_NORMAL,
  BALANCE_HARD,
  getBalanceConfig,
  type BalanceConfig,
} from "../balance-config.js";

describe("BalanceConfig", () => {
  const configs: [string, BalanceConfig][] = [
    ["easy", BALANCE_EASY],
    ["normal", BALANCE_NORMAL],
    ["hard", BALANCE_HARD],
  ];

  it("getBalanceConfig returns the correct preset", () => {
    expect(getBalanceConfig("easy")).toBe(BALANCE_EASY);
    expect(getBalanceConfig("normal")).toBe(BALANCE_NORMAL);
    expect(getBalanceConfig("hard")).toBe(BALANCE_HARD);
  });

  it("each config has the correct difficulty label", () => {
    expect(BALANCE_EASY.difficulty).toBe("easy");
    expect(BALANCE_NORMAL.difficulty).toBe("normal");
    expect(BALANCE_HARD.difficulty).toBe("hard");
  });

  describe("economy values scale down with difficulty", () => {
    it("major city base income: easy >= normal >= hard", () => {
      expect(BALANCE_EASY.economy.majorCityBaseIncome).toBeGreaterThanOrEqual(
        BALANCE_NORMAL.economy.majorCityBaseIncome,
      );
      expect(BALANCE_NORMAL.economy.majorCityBaseIncome).toBeGreaterThanOrEqual(
        BALANCE_HARD.economy.majorCityBaseIncome,
      );
    });

    it("minor city base income: easy >= normal >= hard", () => {
      expect(BALANCE_EASY.economy.minorCityBaseIncome).toBeGreaterThanOrEqual(
        BALANCE_NORMAL.economy.minorCityBaseIncome,
      );
      expect(BALANCE_NORMAL.economy.minorCityBaseIncome).toBeGreaterThanOrEqual(
        BALANCE_HARD.economy.minorCityBaseIncome,
      );
    });

    it("development multiplier: easy >= normal >= hard", () => {
      expect(BALANCE_EASY.economy.developmentMultiplierPerLevel).toBeGreaterThanOrEqual(
        BALANCE_NORMAL.economy.developmentMultiplierPerLevel,
      );
      expect(BALANCE_NORMAL.economy.developmentMultiplierPerLevel).toBeGreaterThanOrEqual(
        BALANCE_HARD.economy.developmentMultiplierPerLevel,
      );
    });

    it("commerce district bonus: easy >= normal >= hard", () => {
      expect(BALANCE_EASY.economy.commerceDistrictBonus).toBeGreaterThanOrEqual(
        BALANCE_NORMAL.economy.commerceDistrictBonus,
      );
      expect(BALANCE_NORMAL.economy.commerceDistrictBonus).toBeGreaterThanOrEqual(
        BALANCE_HARD.economy.commerceDistrictBonus,
      );
    });

    it("trade route gold: easy >= normal >= hard", () => {
      expect(BALANCE_EASY.economy.tradeRouteGoldBonus).toBeGreaterThanOrEqual(
        BALANCE_NORMAL.economy.tradeRouteGoldBonus,
      );
      expect(BALANCE_NORMAL.economy.tradeRouteGoldBonus).toBeGreaterThanOrEqual(
        BALANCE_HARD.economy.tradeRouteGoldBonus,
      );
    });
  });

  describe("costs scale up with difficulty", () => {
    it("reinforce: easy <= normal <= hard", () => {
      expect(BALANCE_EASY.costs.reinforce).toBeLessThanOrEqual(BALANCE_NORMAL.costs.reinforce);
      expect(BALANCE_NORMAL.costs.reinforce).toBeLessThanOrEqual(BALANCE_HARD.costs.reinforce);
    });

    it("develop: easy <= normal <= hard", () => {
      expect(BALANCE_EASY.costs.develop).toBeLessThanOrEqual(BALANCE_NORMAL.costs.develop);
      expect(BALANCE_NORMAL.costs.develop).toBeLessThanOrEqual(BALANCE_HARD.costs.develop);
    });

    it("build improvement: easy <= normal <= hard", () => {
      expect(BALANCE_EASY.costs.buildImprovement).toBeLessThanOrEqual(BALANCE_NORMAL.costs.buildImprovement);
      expect(BALANCE_NORMAL.costs.buildImprovement).toBeLessThanOrEqual(BALANCE_HARD.costs.buildImprovement);
    });

    it("build district: easy <= normal <= hard", () => {
      expect(BALANCE_EASY.costs.buildDistrict).toBeLessThanOrEqual(BALANCE_NORMAL.costs.buildDistrict);
      expect(BALANCE_NORMAL.costs.buildDistrict).toBeLessThanOrEqual(BALANCE_HARD.costs.buildDistrict);
    });
  });

  describe("victory conditions harder with difficulty", () => {
    it("diplomatic ticks: easy <= normal <= hard", () => {
      expect(BALANCE_EASY.victory.diplomaticConsecutiveTicks).toBeLessThanOrEqual(
        BALANCE_NORMAL.victory.diplomaticConsecutiveTicks,
      );
      expect(BALANCE_NORMAL.victory.diplomaticConsecutiveTicks).toBeLessThanOrEqual(
        BALANCE_HARD.victory.diplomaticConsecutiveTicks,
      );
    });

    it("economic gold share: easy <= normal <= hard", () => {
      expect(BALANCE_EASY.victory.economicGoldShareThreshold).toBeLessThanOrEqual(
        BALANCE_NORMAL.victory.economicGoldShareThreshold,
      );
      expect(BALANCE_NORMAL.victory.economicGoldShareThreshold).toBeLessThanOrEqual(
        BALANCE_HARD.victory.economicGoldShareThreshold,
      );
    });

    it("economic ticks: easy <= normal <= hard", () => {
      expect(BALANCE_EASY.victory.economicConsecutiveTicks).toBeLessThanOrEqual(
        BALANCE_NORMAL.victory.economicConsecutiveTicks,
      );
      expect(BALANCE_NORMAL.victory.economicConsecutiveTicks).toBeLessThanOrEqual(
        BALANCE_HARD.victory.economicConsecutiveTicks,
      );
    });
  });

  describe("tech slows down with difficulty", () => {
    it("research time multiplier: easy <= normal <= hard", () => {
      expect(BALANCE_EASY.tech.researchTimeMultiplier).toBeLessThanOrEqual(
        BALANCE_NORMAL.tech.researchTimeMultiplier,
      );
      expect(BALANCE_NORMAL.tech.researchTimeMultiplier).toBeLessThanOrEqual(
        BALANCE_HARD.tech.researchTimeMultiplier,
      );
    });

    it("research cost multiplier: easy <= normal <= hard", () => {
      expect(BALANCE_EASY.tech.researchCostMultiplier).toBeLessThanOrEqual(
        BALANCE_NORMAL.tech.researchCostMultiplier,
      );
      expect(BALANCE_NORMAL.tech.researchCostMultiplier).toBeLessThanOrEqual(
        BALANCE_HARD.tech.researchCostMultiplier,
      );
    });
  });

  describe("NPC AI harder with difficulty", () => {
    it("NPC income multiplier: easy <= normal <= hard", () => {
      expect(BALANCE_EASY.npcAI.npcIncomeMultiplier).toBeLessThanOrEqual(
        BALANCE_NORMAL.npcAI.npcIncomeMultiplier,
      );
      expect(BALANCE_NORMAL.npcAI.npcIncomeMultiplier).toBeLessThanOrEqual(
        BALANCE_HARD.npcAI.npcIncomeMultiplier,
      );
    });

    it("NPC cost multiplier: easy >= normal >= hard", () => {
      expect(BALANCE_EASY.npcAI.npcCostMultiplier).toBeGreaterThanOrEqual(
        BALANCE_NORMAL.npcAI.npcCostMultiplier,
      );
      expect(BALANCE_NORMAL.npcAI.npcCostMultiplier).toBeGreaterThanOrEqual(
        BALANCE_HARD.npcAI.npcCostMultiplier,
      );
    });

    it("spy chance increases with difficulty", () => {
      expect(BALANCE_EASY.npcAI.spyChancePerTick).toBeLessThanOrEqual(
        BALANCE_NORMAL.npcAI.spyChancePerTick,
      );
      expect(BALANCE_NORMAL.npcAI.spyChancePerTick).toBeLessThanOrEqual(
        BALANCE_HARD.npcAI.spyChancePerTick,
      );
    });

    it("expansion aggression: easy <= normal <= hard", () => {
      expect(BALANCE_EASY.npcAI.npcExpansionAggression).toBeLessThanOrEqual(
        BALANCE_NORMAL.npcAI.npcExpansionAggression,
      );
      expect(BALANCE_NORMAL.npcAI.npcExpansionAggression).toBeLessThanOrEqual(
        BALANCE_HARD.npcAI.npcExpansionAggression,
      );
    });

    it("free garrison only on hard", () => {
      expect(BALANCE_EASY.npcAI.freeGarrisonPer4Ticks).toBe(0);
      expect(BALANCE_NORMAL.npcAI.freeGarrisonPer4Ticks).toBe(0);
      expect(BALANCE_HARD.npcAI.freeGarrisonPer4Ticks).toBeGreaterThan(0);
    });

    it("underdog threshold: easy >= normal >= hard", () => {
      expect(BALANCE_EASY.npcAI.underdogCityThreshold).toBeGreaterThanOrEqual(
        BALANCE_NORMAL.npcAI.underdogCityThreshold,
      );
      expect(BALANCE_NORMAL.npcAI.underdogCityThreshold).toBeGreaterThanOrEqual(
        BALANCE_HARD.npcAI.underdogCityThreshold,
      );
    });

    it("underdog free garrison: easy >= normal >= hard", () => {
      expect(BALANCE_EASY.npcAI.underdogFreeGarrisonPerTick).toBeGreaterThanOrEqual(
        BALANCE_NORMAL.npcAI.underdogFreeGarrisonPerTick,
      );
      expect(BALANCE_NORMAL.npcAI.underdogFreeGarrisonPerTick).toBeGreaterThanOrEqual(
        BALANCE_HARD.npcAI.underdogFreeGarrisonPerTick,
      );
    });

    it("all presets have positive underdog values", () => {
      for (const [, config] of configs) {
        expect(config.npcAI.underdogCityThreshold).toBeGreaterThan(0);
        expect(config.npcAI.underdogFreeGarrisonPerTick).toBeGreaterThan(0);
      }
    });
  });

  describe("transfer troops cost scales with difficulty", () => {
    it("transferTroops: easy <= normal <= hard", () => {
      expect(BALANCE_EASY.costs.transferTroops).toBeLessThanOrEqual(BALANCE_NORMAL.costs.transferTroops);
      expect(BALANCE_NORMAL.costs.transferTroops).toBeLessThanOrEqual(BALANCE_HARD.costs.transferTroops);
    });
  });

  describe("conquest garrison penalty scales with difficulty", () => {
    it("conquestGarrisonPenalty: easy <= normal <= hard", () => {
      expect(BALANCE_EASY.combat.conquestGarrisonPenalty).toBeLessThanOrEqual(
        BALANCE_NORMAL.combat.conquestGarrisonPenalty,
      );
      expect(BALANCE_NORMAL.combat.conquestGarrisonPenalty).toBeLessThanOrEqual(
        BALANCE_HARD.combat.conquestGarrisonPenalty,
      );
    });

    it("all presets have positive conquest garrison penalty", () => {
      for (const [, config] of configs) {
        expect(config.combat.conquestGarrisonPenalty).toBeGreaterThan(0);
      }
    });
  });

  describe("garrison recovery scales with difficulty", () => {
    it("recovery interval: easy <= normal <= hard (slower on harder)", () => {
      expect(BALANCE_EASY.garrison.recoveryInterval).toBeLessThanOrEqual(
        BALANCE_NORMAL.garrison.recoveryInterval,
      );
      expect(BALANCE_NORMAL.garrison.recoveryInterval).toBeLessThanOrEqual(
        BALANCE_HARD.garrison.recoveryInterval,
      );
    });

    it("major city garrison cap: easy >= normal >= hard", () => {
      expect(BALANCE_EASY.garrison.majorCityGarrisonCap).toBeGreaterThanOrEqual(
        BALANCE_NORMAL.garrison.majorCityGarrisonCap,
      );
      expect(BALANCE_NORMAL.garrison.majorCityGarrisonCap).toBeGreaterThanOrEqual(
        BALANCE_HARD.garrison.majorCityGarrisonCap,
      );
    });

    it("minor city garrison cap: easy >= normal >= hard", () => {
      expect(BALANCE_EASY.garrison.minorCityGarrisonCap).toBeGreaterThanOrEqual(
        BALANCE_NORMAL.garrison.minorCityGarrisonCap,
      );
      expect(BALANCE_NORMAL.garrison.minorCityGarrisonCap).toBeGreaterThanOrEqual(
        BALANCE_HARD.garrison.minorCityGarrisonCap,
      );
    });

    it("garrison caps are positive", () => {
      for (const [, config] of configs) {
        expect(config.garrison.recoveryInterval).toBeGreaterThan(0);
        expect(config.garrison.majorCityGarrisonCap).toBeGreaterThan(0);
        expect(config.garrison.minorCityGarrisonCap).toBeGreaterThan(0);
      }
    });
  });

  describe("troop carrying config", () => {
    it("troopHardCap is 8 across all difficulties", () => {
      for (const [, config] of configs) {
        expect(config.combat.troopHardCap).toBe(8);
      }
    });

    it("troopSoftCapBase: easy >= normal = hard", () => {
      expect(BALANCE_EASY.combat.troopSoftCapBase).toBeGreaterThanOrEqual(
        BALANCE_NORMAL.combat.troopSoftCapBase,
      );
      expect(BALANCE_NORMAL.combat.troopSoftCapBase).toBe(
        BALANCE_HARD.combat.troopSoftCapBase,
      );
    });

    it("troopOverloadPenaltyRate: easy <= normal <= hard", () => {
      expect(BALANCE_EASY.combat.troopOverloadPenaltyRate).toBeLessThanOrEqual(
        BALANCE_NORMAL.combat.troopOverloadPenaltyRate,
      );
      expect(BALANCE_NORMAL.combat.troopOverloadPenaltyRate).toBeLessThanOrEqual(
        BALANCE_HARD.combat.troopOverloadPenaltyRate,
      );
    });

    it("all presets have valid troop values", () => {
      for (const [, config] of configs) {
        expect(config.combat.troopHardCap).toBeGreaterThan(0);
        expect(config.combat.troopSoftCapBase).toBeGreaterThan(0);
        expect(config.combat.troopOverloadPenaltyRate).toBeGreaterThan(0);
        expect(config.combat.troopOverloadPenaltyRate).toBeLessThan(1);
      }
    });

    it("normal preset has expected troop values", () => {
      expect(BALANCE_NORMAL.combat.troopHardCap).toBe(8);
      expect(BALANCE_NORMAL.combat.troopSoftCapBase).toBe(2);
      expect(BALANCE_NORMAL.combat.troopOverloadPenaltyRate).toBe(0.10);
    });
  });

  describe("all numeric values are positive and sensible", () => {
    for (const [name, config] of configs) {
      it(`${name}: economy values are positive`, () => {
        expect(config.economy.majorCityBaseIncome).toBeGreaterThan(0);
        expect(config.economy.minorCityBaseIncome).toBeGreaterThan(0);
        expect(config.economy.developmentMultiplierPerLevel).toBeGreaterThan(0);
        expect(config.economy.commerceDistrictBonus).toBeGreaterThan(0);
        expect(config.economy.tradeRouteGoldBonus).toBeGreaterThan(0);
        expect(config.economy.maxTradeRoutesPerCity).toBeGreaterThan(0);
      });

      it(`${name}: costs are positive`, () => {
        expect(config.costs.reinforce).toBeGreaterThan(0);
        expect(config.costs.develop).toBeGreaterThan(0);
        expect(config.costs.buildImprovement).toBeGreaterThan(0);
        expect(config.costs.buildDistrict).toBeGreaterThan(0);
      });

      it(`${name}: victory thresholds are within [0, 1] or positive ticks`, () => {
        expect(config.victory.diplomaticConsecutiveTicks).toBeGreaterThan(0);
        expect(config.victory.economicGoldShareThreshold).toBeGreaterThan(0);
        expect(config.victory.economicGoldShareThreshold).toBeLessThanOrEqual(1);
        expect(config.victory.economicConsecutiveTicks).toBeGreaterThan(0);
      });

      it(`${name}: event chances are in [0, 1]`, () => {
        expect(config.events.worldEventChance).toBeGreaterThanOrEqual(0);
        expect(config.events.worldEventChance).toBeLessThanOrEqual(1);
        expect(config.events.eventCardChance).toBeGreaterThanOrEqual(0);
        expect(config.events.eventCardChance).toBeLessThanOrEqual(1);
        expect(config.events.eventCardGoldScale).toBeGreaterThan(0);
      });
    }
  });
});
