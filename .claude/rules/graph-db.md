---
globs: "packages/graph-db/**/*.ts"
---
# Graph DB Rules

- All database access MUST go through IGraphRepository interface
- Never import neo4j-driver directly outside of `neo4j/` directory
- Cypher queries live in dedicated query files, not inline in business logic
- All repository methods return plain TypeScript objects, never DB-specific types
