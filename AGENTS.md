# AGENTS.md

## Project Overview

RTK — A grand strategy simulation game inspired by Romance of the Three Kingdoms 13.
Core features: tick-based simulation with combat, diplomacy, espionage, economy systems;
radial relationship graph with event sourcing for replay; AI-powered narrative generation.

## Tech Stack

- **Language**: TypeScript (strict mode)
- **Monorepo**: pnpm workspaces + Turborepo
- **Simulation**: Custom tick-based ECS-style engine in TypeScript
- **Graph DB**: Neo4j (dev) / In-Memory (prod), behind `IGraphRepository` abstraction
- **Event Store**: SQLite (append-only event sourcing)
- **API**: tRPC
- **Frontend**: Next.js + Leaflet (strategic map) + Cytoscape.js (relationship graph)
- **AI Narrative**: Anthropic Claude API (daily summaries, event narratives)
- **Package**: Electron or Tauri (future — local desktop game, no cloud deploy)

## Build & Run

```bash
pnpm install          # install all deps
pnpm build            # build all packages
pnpm dev              # dev mode (all packages)
pnpm test             # run tests
pnpm type-check       # TypeScript check
pnpm lint             # lint all packages
```

## Project Structure

```
packages/
  simulation/   # ECS engine — tick-based simulation (combat, economy, diplomacy, espionage, AI, events)
  graph-db/     # Graph database abstraction + Neo4j / In-Memory implementations
  api/          # tRPC API server — 58 endpoints bridging simulation ↔ frontend
  web/          # Next.js frontend — strategic map, relationship graph, stats dashboard, game log, hero hall
```

## Operating Principles

- Local-first: everything runs on the player's machine, no cloud dependency
- Data abstraction: all DB access goes through repository interfaces
- Event sourcing: never mutate state directly; append events, derive state
- Simulation and presentation are decoupled — simulation produces events, frontend consumes snapshots

## Coding Style

- Functional patterns, early returns
- Explicit types, no `any`
- Prefer `const` and immutable data
- Name files in kebab-case, types/interfaces in PascalCase
- One export per file for core domain types

## Testing

- Use Vitest for all packages
- Follow Arrange-Act-Assert pattern
- Unit test simulation systems and graph queries
- Integration test API routes

## Git Commit

- Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- Commit message in English, imperative mood
- One logical change per commit

## Git Hygiene

- Do not commit `.env`, credentials, or large binaries
- Keep commits atomic and reviewable
- Branch naming: `feat/xxx`, `fix/xxx`, `refactor/xxx`

## Error Handling

- Fail fast with descriptive errors at system boundaries
- Use Result types or explicit error returns over try-catch where practical
- Log errors with context (entity ID, tick number, event code)

## Definition of Done

- TypeScript compiles with no errors
- All existing tests pass
- New logic has corresponding tests
- No `any` types introduced
