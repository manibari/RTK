import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";

export const characterRouter = router({
  getAll: publicProcedure.query(async ({ ctx }) => {
    return ctx.repo.getAllCharacters();
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.repo.getCharacter(input.id);
    }),

  getGraph: publicProcedure
    .input(z.object({ centerId: z.string(), depth: z.number().min(1).max(3).default(2) }))
    .query(async ({ ctx, input }) => {
      return ctx.repo.getCharacterGraph(input.centerId, input.depth);
    }),

  getRelationships: publicProcedure
    .input(z.object({ characterId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.repo.getRelationshipsOf(input.characterId);
    }),
});
