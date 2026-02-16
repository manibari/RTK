import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";

export const mapRouter = router({
  getMapData: publicProcedure
    .input(z.object({ tick: z.number().min(0) }))
    .query(async ({ ctx, input }) => {
      return ctx.repo.getMapData(input.tick);
    }),

  getAllPlaces: publicProcedure.query(async ({ ctx }) => {
    return ctx.repo.getAllPlaces();
  }),

  getPlace: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.repo.getPlace(input.id);
    }),
});
