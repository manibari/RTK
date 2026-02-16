import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";

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
    return { tick: ctx.simulation.currentTick };
  }),

  // Player commands
  queueCommand: publicProcedure
    .input(z.object({
      type: z.enum(["move", "attack"]),
      characterId: z.string(),
      targetCityId: z.string(),
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
});
