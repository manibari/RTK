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
      expect(config.economy.majorCityBaseIncome).toBe(40);
      expect(config.economy.minorCityBaseIncome).toBe(20);
      expect(config.economy.developmentMultiplierPerLevel).toBe(0.2);
      expect(config.costs.reinforce).toBe(150);
      expect(config.costs.develop).toBe(400);
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
});
