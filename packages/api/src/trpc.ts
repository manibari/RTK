import { initTRPC } from "@trpc/server";
import type { IGraphRepository } from "@rtk/graph-db";
import type { SimulationService } from "./simulation-service.js";

export interface Context {
  repo: IGraphRepository;
  simulation: SimulationService;
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
