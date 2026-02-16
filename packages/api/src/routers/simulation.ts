import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";

export const simulationRouter = router({
  advanceDay: publicProcedure.mutation(async ({ ctx }) => {
    const events = await ctx.simulation.advanceDay();
    return {
      tick: ctx.simulation.currentTick,
      events,
    };
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

  getCurrentTick: publicProcedure.query(({ ctx }) => {
    return { tick: ctx.simulation.currentTick };
  }),
});
