import { router } from "./trpc.js";
import { characterRouter } from "./routers/character.js";
import { simulationRouter } from "./routers/simulation.js";

export const appRouter = router({
  character: characterRouter,
  simulation: simulationRouter,
});

export type AppRouter = typeof appRouter;
