import { router } from "./trpc.js";
import { characterRouter } from "./routers/character.js";
import { simulationRouter } from "./routers/simulation.js";
import { mapRouter } from "./routers/map.js";

export const appRouter = router({
  character: characterRouter,
  simulation: simulationRouter,
  map: mapRouter,
});

export type AppRouter = typeof appRouter;
