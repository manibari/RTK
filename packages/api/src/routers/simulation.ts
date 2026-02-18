import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { getCombatRating } from "../simulation-service.js";

export const simulationRouter = router({
  advanceDay: publicProcedure.mutation(async ({ ctx }) => {
    return ctx.simulation.advanceDay();
  }),

  getEventLog: publicProcedure
    .input(
      z.object({
        characterId: z.string().optional(),
        fromTick: z.number().optional(),
        toTick: z.number().optional(),
      }),
    )
    .query(({ ctx, input }) => {
      return ctx.simulation.getEventLog(input.characterId, input.fromTick, input.toTick);
    }),

  getPairEvents: publicProcedure
    .input(z.object({ actorId: z.string(), targetId: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.simulation.getPairEvents(input.actorId, input.targetId);
    }),

  getGraphAtTick: publicProcedure
    .input(z.object({ centerId: z.string(), depth: z.number().min(1).max(3).default(2), tick: z.number().min(0) }))
    .query(async ({ ctx, input }) => {
      return ctx.simulation.getGraphAtTick(input.centerId, input.depth, input.tick);
    }),

  getIntimacyTimeline: publicProcedure
    .input(z.object({ actorId: z.string(), targetId: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.simulation.getIntimacyTimeline(input.actorId, input.targetId);
    }),

  getDailySummary: publicProcedure
    .input(z.object({ tick: z.number().min(0) }))
    .query(({ ctx, input }) => {
      return { tick: input.tick, summary: ctx.simulation.getDailySummary(input.tick) };
    }),

  getCurrentTick: publicProcedure.query(({ ctx }) => {
    return { tick: ctx.simulation.currentTick, season: ctx.simulation.currentSeason };
  }),

  // Player commands
  queueCommand: publicProcedure
    .input(z.object({
      type: z.enum(["move", "attack", "recruit", "reinforce", "develop", "build_improvement", "spy", "sabotage", "blockade", "hire_neutral", "assign_role", "start_research", "establish_trade", "build_district", "assign_mentor", "build_siege", "demand", "sow_discord", "train_unit", "set_path", "propose_nap", "propose_defense_pact", "designate_heir"]),
      characterId: z.string(),
      targetCityId: z.string(),
      targetCharacterId: z.string().optional(),
      role: z.enum(["general", "governor", "diplomat", "spymaster"]).optional(),
      techId: z.string().optional(),
      tactic: z.enum(["aggressive", "defensive", "balanced"]).optional(),
      tradeCityId: z.string().optional(),
      districtType: z.enum(["defense", "commerce", "agriculture", "recruitment"]).optional(),
      demandType: z.enum(["tribute", "withdraw"]).optional(),
      demandAmount: z.number().optional(),
      targetFactionId: z.string().optional(),
      unitType: z.enum(["infantry", "cavalry", "archers"]).optional(),
      cityPath: z.enum(["fortress", "trade_hub", "cultural", "breadbasket"]).optional(),
    }))
    .mutation(({ ctx, input }) => {
      ctx.simulation.queueCommand(input);
      return { queued: true, command: input };
    }),

  getCommandQueue: publicProcedure.query(({ ctx }) => {
    return ctx.simulation.getCommandQueue();
  }),

  clearCommandQueue: publicProcedure.mutation(({ ctx }) => {
    ctx.simulation.clearCommandQueue();
    return { cleared: true };
  }),

  // Factions
  getFactions: publicProcedure.query(async ({ ctx }) => {
    return ctx.simulation.getFactions();
  }),

  // Game state
  getGameState: publicProcedure.query(({ ctx }) => {
    return ctx.simulation.getGameState();
  }),

  getAlliances: publicProcedure.query(({ ctx }) => {
    return ctx.simulation.getAlliances();
  }),

  proposeAlliance: publicProcedure
    .input(z.object({ factionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.simulation.proposeAlliance(input.factionId);
    }),

  breakAlliance: publicProcedure
    .input(z.object({ factionId: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.simulation.breakAlliance(input.factionId);
    }),

  getFactionStats: publicProcedure.query(async ({ ctx }) => {
    return ctx.simulation.getFactionStats();
  }),

  predictBattle: publicProcedure
    .input(z.object({ attackerIds: z.array(z.string()), cityId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.simulation.predictBattle(input.attackerIds, input.cityId);
    }),

  getFactionHistory: publicProcedure.query(({ ctx }) => {
    return ctx.simulation.getFactionHistory();
  }),

  getCombatRating: publicProcedure
    .input(z.object({ traits: z.array(z.string()) }))
    .query(({ input }) => {
      return getCombatRating(input.traits);
    }),

  // Spy missions
  getSpyMissions: publicProcedure.query(({ ctx }) => {
    return ctx.simulation.getSpyMissions();
  }),

  // Technology
  getFactionTechs: publicProcedure.query(({ ctx }) => {
    return ctx.simulation.getFactionTechs();
  }),

  // Neutral check
  isNeutral: publicProcedure
    .input(z.object({ characterId: z.string() }))
    .query(({ ctx, input }) => {
      return { neutral: ctx.simulation.isNeutral(input.characterId) };
    }),

  // Trade routes
  getTradeRoutes: publicProcedure.query(({ ctx }) => {
    return ctx.simulation.getTradeRoutes();
  }),

  // Dead characters
  getDeadCharacters: publicProcedure.query(({ ctx }) => {
    return ctx.simulation.getDeadCharacters();
  }),

  // Morale
  getAllMorale: publicProcedure.query(({ ctx }) => {
    return ctx.simulation.getAllMorale();
  }),

  // Prestige & Achievements
  getAllPrestige: publicProcedure.query(({ ctx }) => {
    return ctx.simulation.getAllPrestige();
  }),

  getCharacterAchievements: publicProcedure
    .input(z.object({ characterId: z.string() }))
    .query(({ ctx, input }) => {
      return { achievements: ctx.simulation.getAchievements(input.characterId), prestige: ctx.simulation.getPrestige(input.characterId) };
    }),

  // Supply status
  getSupplyStatus: publicProcedure.query(async ({ ctx }) => {
    return ctx.simulation.computeSupplyStatus();
  }),

  // Favorability
  getCharacterFavorability: publicProcedure
    .input(z.object({ characterId: z.string() }))
    .query(({ ctx, input }) => {
      return { favorability: ctx.simulation.getFavorability(input.characterId) };
    }),

  // Mentor pairs
  getMentorPairs: publicProcedure.query(({ ctx }) => {
    return ctx.simulation.getMentorPairs();
  }),

  // Active drought cities
  getDroughtCities: publicProcedure.query(({ ctx }) => {
    return ctx.simulation.getActiveDroughtCities();
  }),

  // War exhaustion
  getWarExhaustion: publicProcedure.query(({ ctx }) => {
    return ctx.simulation.getWarExhaustion();
  }),

  // Faction trust
  getFactionTrust: publicProcedure.query(({ ctx }) => {
    return ctx.simulation.getFactionTrust();
  }),

  // Victory stats (for victory screen)
  getVictoryStats: publicProcedure.query(async ({ ctx }) => {
    return ctx.simulation.getVictoryStats();
  }),

  // Victory progress (live HUD)
  getVictoryProgress: publicProcedure.query(async ({ ctx }) => {
    return ctx.simulation.getVictoryProgress();
  }),

  // Event cards
  resolveEventCard: publicProcedure
    .input(z.object({ choiceIndex: z.number().min(0).max(3) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.simulation.resolveEventCard(input.choiceIndex);
    }),

  // Save / Load
  saveGame: publicProcedure
    .input(z.object({ slot: z.number().min(1).max(3) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.simulation.saveGame(input.slot);
    }),

  loadGame: publicProcedure
    .input(z.object({ slot: z.number().min(1).max(3) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.simulation.loadGame(input.slot);
    }),

  listSaves: publicProcedure.query(({ ctx }) => {
    return ctx.simulation.listSaves();
  }),

  // City loyalty
  getCityLoyalty: publicProcedure.query(({ ctx }) => {
    return ctx.simulation.getAllCityLoyalty();
  }),

  // Faction traditions
  getFactionTraditions: publicProcedure.query(({ ctx }) => {
    return ctx.simulation.getFactionTraditions();
  }),

  // Treaties
  getTreaties: publicProcedure.query(({ ctx }) => {
    return ctx.simulation.getTreaties();
  }),

  // Designated heir
  getDesignatedHeir: publicProcedure.query(({ ctx }) => {
    return { heirId: ctx.simulation.getDesignatedHeir() };
  }),

  // Hero hall
  getHeroHall: publicProcedure.query(async ({ ctx }) => {
    return ctx.simulation.getHeroHall();
  }),

  // City vulnerability
  getCityVulnerability: publicProcedure.query(async ({ ctx }) => {
    return ctx.simulation.getCityVulnerability();
  }),

  // Reset
  reset: publicProcedure.mutation(async ({ ctx }) => {
    await ctx.simulation.reset();
    return { tick: 0, status: "ongoing" };
  }),
});
