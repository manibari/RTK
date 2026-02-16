import { createHTTPServer } from "@trpc/server/adapters/standalone";
import cors from "cors";
import { appRouter } from "./app-router.js";
import { InMemoryGraphRepository, seedData } from "@rtk/graph-db";
import { SimulationService } from "./simulation-service.js";
import { SqliteEventStore } from "./event-store/sqlite-event-store.js";
import type { Context } from "./trpc.js";

const PORT = Number(process.env.PORT) || 3001;

async function main() {
  const repo = new InMemoryGraphRepository();
  await repo.connect();
  await seedData(repo);

  const eventStore = new SqliteEventStore(); // in-memory SQLite
  const simulation = new SimulationService(repo, eventStore);
  await simulation.init();

  console.log(`Seeded ${(await repo.getAllCharacters()).length} characters`);
  console.log(`Simulation engine ready at tick ${simulation.currentTick}`);

  const server = createHTTPServer({
    middleware: cors(),
    router: appRouter,
    createContext: (): Context => ({ repo, simulation }),
  });

  server.listen(PORT);
  console.log(`API server listening on http://localhost:${PORT}`);
}

main().catch(console.error);
