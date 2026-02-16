---
globs: "**/*.test.ts"
---
# Testing Rules

- Use `describe` / `it` blocks, not `test`
- Follow Arrange-Act-Assert pattern
- Mock external dependencies (Neo4j, file system)
- Test simulation systems with deterministic seeds
- Name test files as `{module}.test.ts` next to source
