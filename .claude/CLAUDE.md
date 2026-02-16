@AGENTS.md

# Claude Code Project Settings

## Workflow

- Use plan mode (`EnterPlanMode`) for any task touching 3+ files
- Create task lists for multi-step work
- Read existing code before modifying

## Task Management

- Mark tasks in_progress before starting work
- Mark tasks completed only when build + tests pass
- If blocked, create a new task describing the blocker

## Communication

- Respond in Traditional Chinese (繁體中文) for discussion
- Code, comments, and commit messages in English

## Context Management

- Do not re-read files already in context unless they may have changed
- Use parallel tool calls for independent operations
- Prefer Grep/Glob over Bash for file search
