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

  console.log(`Seeded ${(await repo.getAllCharacters()).length} characters, ${(await repo.getAllPlaces()).length} cities`);
  console.log(`Simulation engine ready at tick ${simulation.currentTick}`);

  const server = createHTTPServer({
    middleware: cors(),
    router: appRouter,
    createContext: (): Context => ({ repo, simulation }),
  });

  // Retry listen with back-off to handle tsx watch rapid restarts
  const listen = (retries = 5, delay = 500): void => {
    const httpServer = server.listen(PORT);
    httpServer.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE" && retries > 0) {
        console.log(`Port ${PORT} busy, retrying in ${delay}ms... (${retries} left)`);
        setTimeout(() => listen(retries - 1, delay * 2), delay);
      } else {
        throw err;
      }
    });
    httpServer.on("listening", () => {
      console.log(`API server listening on http://localhost:${PORT}`);
      const shutdown = () => { httpServer.close(); };
      process.on("SIGTERM", shutdown);
      process.on("SIGINT", shutdown);
    });
  };
  listen();
}

main().catch(console.error);
