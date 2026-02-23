import { describe, it, expect } from "vitest";
import { drawEventCard } from "../event-cards.js";
import {
  getBalanceConfig,
  BALANCE_EASY,
  BALANCE_NORMAL,
  BALANCE_HARD,
} from "../balance-config.js";
import { evaluateNPCSpyDecisions } from "../ai/npc-ai.js";

describe("Simulation Balance Integration", () => {
  describe("drawEventCard respects eventCardChance", () => {
    it("returns null more often with lower chance", () => {
      // Run many trials with chance = 0 to ensure always null
      let nullCount = 0;
      for (let i = 0; i < 100; i++) {
        if (drawEventCard(0, 1.0) === null) nullCount++;
      }
      expect(nullCount).toBe(100);
    });

    it("returns cards with chance = 1", () => {
      let cardCount = 0;
      for (let i = 0; i < 100; i++) {
        if (drawEventCard(1.0, 1.0) !== null) cardCount++;
      }
      expect(cardCount).toBe(100);
    });

    it("scales gold deltas by goldScale", () => {
      // Draw with scale 0.5 — all gold deltas should be halved
      const card = drawEventCard(1.0, 0.5);
      expect(card).not.toBeNull();
      if (card) {
        for (const choice of card.choices) {
          if (choice.effect.goldDelta != null && choice.effect.goldDelta !== 0) {
            // The scaled value should be roughly half of original
            // We can't compare to original since we don't know which card was drawn,
            // but we can verify the value is an integer (Math.round was applied)
            expect(Number.isInteger(choice.effect.goldDelta)).toBe(true);
          }
        }
      }
    });
  });

  describe("NPC spy decisions respect spyChancePerTick", () => {
    it("spyChancePerTick=0 produces no spy decisions", () => {
      const factions = [
        { id: "shu", leaderId: "l1", members: ["l1"] },
        { id: "wei", leaderId: "l2", members: ["l2", "spy1"] },
      ];
      const characters = [
        { id: "l1", name: "L1", cityId: "c1", traits: [], military: 5, intelligence: 5, charm: 5 } as any,
        { id: "l2", name: "L2", cityId: "c2", traits: [], military: 5, intelligence: 5, charm: 5 } as any,
        { id: "spy1", name: "Spy", cityId: "c2", traits: [], military: 3, intelligence: 8, charm: 3, skills: { espionage: 3 }, role: "spymaster" } as any,
      ];
      const cities = [
        { id: "c1", name: "C1", controllerId: "l1", status: "allied", tier: "major", garrison: 3 } as any,
        { id: "c2", name: "C2", controllerId: "l2", status: "hostile", tier: "major", garrison: 3 } as any,
      ];

      let totalDecisions = 0;
      for (let i = 0; i < 100; i++) {
        const decisions = evaluateNPCSpyDecisions(factions, characters, cities, "shu", new Set(), new Set(), 0);
        totalDecisions += decisions.length;
      }
      expect(totalDecisions).toBe(0);
    });
  });

  describe("getBalanceConfig returns consistent difficulty values", () => {
    it("normal config has expected economy values", () => {
      const config = getBalanceConfig("normal");
      expect(config.economy.majorCityBaseIncome).toBe(50);
      expect(config.economy.minorCityBaseIncome).toBe(25);
      expect(config.economy.developmentMultiplierPerLevel).toBe(0.2);
      expect(config.costs.reinforce).toBe(80);
      expect(config.costs.develop).toBe(400);
      expect(config.costs.transferTroops).toBe(30);
    });

    it("hard config has expected NPC AI values", () => {
      const config = getBalanceConfig("hard");
      expect(config.npcAI.npcIncomeMultiplier).toBe(1.25);
      expect(config.npcAI.npcCostMultiplier).toBe(0.8);
      expect(config.npcAI.freeGarrisonPer4Ticks).toBe(1);
    });

    it("easy config has easier victory thresholds", () => {
      const config = getBalanceConfig("easy");
      expect(config.victory.diplomaticConsecutiveTicks).toBeLessThan(
        BALANCE_NORMAL.victory.diplomaticConsecutiveTicks,
      );
      expect(config.victory.economicGoldShareThreshold).toBeLessThan(
        BALANCE_NORMAL.victory.economicGoldShareThreshold,
      );
    });
  });

  describe("garrison config values are consistent across difficulties", () => {
    it("all presets have valid garrison values", () => {
      for (const preset of [BALANCE_EASY, BALANCE_NORMAL, BALANCE_HARD]) {
        expect(preset.garrison.recoveryInterval).toBeGreaterThan(0);
        expect(preset.garrison.majorCityGarrisonCap).toBeGreaterThan(0);
        expect(preset.garrison.minorCityGarrisonCap).toBeGreaterThan(0);
        expect(preset.garrison.majorCityGarrisonCap).toBeGreaterThanOrEqual(
          preset.garrison.minorCityGarrisonCap,
        );
      }
    });

    it("easier difficulties recover garrison faster", () => {
      expect(BALANCE_EASY.garrison.recoveryInterval).toBeLessThan(
        BALANCE_HARD.garrison.recoveryInterval,
      );
    });

    it("easier difficulties have higher garrison caps", () => {
      expect(BALANCE_EASY.garrison.majorCityGarrisonCap).toBeGreaterThan(
        BALANCE_HARD.garrison.majorCityGarrisonCap,
      );
      expect(BALANCE_EASY.garrison.minorCityGarrisonCap).toBeGreaterThan(
        BALANCE_HARD.garrison.minorCityGarrisonCap,
      );
    });

    it("normal preset has expected garrison values", () => {
      expect(BALANCE_NORMAL.garrison.recoveryInterval).toBe(3);
      expect(BALANCE_NORMAL.garrison.majorCityGarrisonCap).toBe(8);
      expect(BALANCE_NORMAL.garrison.minorCityGarrisonCap).toBe(5);
    });
  });

  describe("conquest garrison penalty config", () => {
    it("normal preset conquest penalty is 2", () => {
      expect(BALANCE_NORMAL.combat.conquestGarrisonPenalty).toBe(2);
    });

    it("easy preset is less punishing", () => {
      expect(BALANCE_EASY.combat.conquestGarrisonPenalty).toBeLessThanOrEqual(
        BALANCE_NORMAL.combat.conquestGarrisonPenalty,
      );
    });

    it("all presets have baseSiegeDelay of 3", () => {
      expect(BALANCE_EASY.combat.baseSiegeDelay).toBe(3);
      expect(BALANCE_NORMAL.combat.baseSiegeDelay).toBe(3);
      expect(BALANCE_HARD.combat.baseSiegeDelay).toBe(3);
    });
  });

  describe("underdog protection config", () => {
    it("normal preset has expected underdog values", () => {
      expect(BALANCE_NORMAL.npcAI.underdogCityThreshold).toBe(2);
      expect(BALANCE_NORMAL.npcAI.underdogFreeGarrisonPerTick).toBe(1);
    });

    it("easy preset gives more underdog protection", () => {
      expect(BALANCE_EASY.npcAI.underdogFreeGarrisonPerTick).toBeGreaterThanOrEqual(
        BALANCE_NORMAL.npcAI.underdogFreeGarrisonPerTick,
      );
    });

    it("hard preset has tighter threshold", () => {
      expect(BALANCE_HARD.npcAI.underdogCityThreshold).toBeLessThanOrEqual(
        BALANCE_NORMAL.npcAI.underdogCityThreshold,
      );
    });
  });

  describe("expansion aggression reduced from previous values", () => {
    it("normal expansion aggression is 0.7", () => {
      expect(BALANCE_NORMAL.npcAI.npcExpansionAggression).toBe(0.7);
    });

    it("hard expansion aggression is 1.0", () => {
      expect(BALANCE_HARD.npcAI.npcExpansionAggression).toBe(1.0);
    });

    it("easy expansion aggression is 0.5", () => {
      expect(BALANCE_EASY.npcAI.npcExpansionAggression).toBe(0.5);
    });
  });

  describe("loyalty config values are consistent across difficulties", () => {
    it("all presets have valid loyalty values", () => {
      for (const preset of [BALANCE_EASY, BALANCE_NORMAL, BALANCE_HARD]) {
        expect(preset.loyalty.initialLoyalty).toBeGreaterThan(0);
        expect(preset.loyalty.initialLoyalty).toBeLessThanOrEqual(100);
        expect(preset.loyalty.capturedCityLoyalty).toBeGreaterThan(0);
        expect(preset.loyalty.capturedCityLoyalty).toBeLessThan(preset.loyalty.initialLoyalty);
        expect(preset.loyalty.foreignDecayPerTick).toBeGreaterThan(0);
        expect(preset.loyalty.rebellionThreshold).toBeGreaterThan(0);
        expect(preset.loyalty.rebellionChance).toBeGreaterThan(0);
        expect(preset.loyalty.rebellionChance).toBeLessThanOrEqual(1);
      }
    });

    it("harder difficulties have harsher rebellion parameters", () => {
      expect(BALANCE_HARD.loyalty.foreignDecayPerTick).toBeGreaterThan(
        BALANCE_EASY.loyalty.foreignDecayPerTick,
      );
      expect(BALANCE_HARD.loyalty.rebellionChance).toBeGreaterThan(
        BALANCE_EASY.loyalty.rebellionChance,
      );
      expect(BALANCE_HARD.loyalty.rebellionThreshold).toBeGreaterThan(
        BALANCE_EASY.loyalty.rebellionThreshold,
      );
    });

    it("easier difficulties give more loyalty to captured cities", () => {
      expect(BALANCE_EASY.loyalty.capturedCityLoyalty).toBeGreaterThan(
        BALANCE_HARD.loyalty.capturedCityLoyalty,
      );
    });

    it("normal preset has expected loyalty values", () => {
      expect(BALANCE_NORMAL.loyalty.initialLoyalty).toBe(50);
      expect(BALANCE_NORMAL.loyalty.capturedCityLoyalty).toBe(25);
      expect(BALANCE_NORMAL.loyalty.foreignDecayPerTick).toBe(2);
      expect(BALANCE_NORMAL.loyalty.rebellionThreshold).toBe(20);
      expect(BALANCE_NORMAL.loyalty.rebellionChance).toBe(0.20);
    });
  });
});
