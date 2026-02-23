# RTK — Romance of the Three Kingdoms Strategy Simulation

A character relationship simulation game inspired by Romance of the Three Kingdoms 13. Built as a local-first desktop application with event sourcing, ECS-style simulation, and AI-powered narrative generation.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (strict mode) |
| Monorepo | pnpm workspaces + Turborepo |
| Simulation | Custom tick-based ECS engine |
| Graph DB | Neo4j (dev) / In-Memory (prod), behind `IGraphRepository` |
| Event Store | SQLite (append-only) |
| API | tRPC |
| Frontend | Next.js + Leaflet + Cytoscape.js |
| AI Narrative | Anthropic Claude API |
| Package | Electron / Tauri (planned) |

## Quick Start

```bash
pnpm install        # install all dependencies
pnpm build          # build all packages
pnpm dev            # start dev mode (all packages)
pnpm test           # run tests
pnpm type-check     # TypeScript check
```

## Project Structure

```
packages/
  simulation/   # ECS engine — tick-based simulation core
  graph-db/     # Graph database abstraction + Neo4j / In-Memory implementations
  api/          # tRPC API server — bridges simulation ↔ frontend
  web/          # Next.js frontend — strategic map, relationship graph, dashboards
```

## Current Feature Status

### Core Systems

| System | Status | Description |
|--------|--------|-------------|
| Relationship | Done | Trait-based intimacy, dynamic types (friend/rival/neutral), event generation |
| Combat | Done | Siege warfare, unit composition (infantry/cavalry/archers) rock-paper-scissors, tactic modifiers, multi-round battles |
| Economy | Done | Gold production, seasonal multipliers, trade routes, food production & consumption |
| Diplomacy | Done | Alliances, non-aggression pacts, mutual defense treaties, trust scores, demands |
| Espionage | Done | Intel/sabotage/blockade missions, success rates, capture consequences |
| Character Growth | Done | Mentorship, aging, death, heir spawning, role assignment (general/governor/diplomat/spymaster) |
| Technology | Done | 5 techs (iron working, archery, logistics, spy network, divine strategy) with research queue |
| Events | Done | 20 procedural event cards, world events (plague/drought/bandits), seasonal effects |
| NPC AI | Done | Personality-based decisions, strategic intent evaluation, faction-level macro strategy |
| AI Narrative | Done | Claude-powered event narratives, daily summaries, fallback templates |
| Victory Conditions | Done | 3 paths — conquest, diplomacy, economy — with live progress tracking |
| Save/Load | Done | 3 save slots with full state restoration |
| Event Sourcing | Done | SQLite append-only store for historical replay |

### Frontend Views

| View | Status | Description |
|------|--------|-------------|
| Strategic Map | Done | Full-screen Leaflet map with floating overlay panels (header, timeline, collapsible sidebar). City status, garrison, movement animations, road network, trade routes, drought/siege indicators |
| Relationship Graph | Done | Radial graph (Cytoscape.js) centered on selected character, intimacy-weighted edges, historical snapshots via timeline |
| Game Log | Done | Battle records, diplomacy events, AI daily summaries, type filtering |
| Faction Stats | Done | Power grid, alliance network, historical power curves, tech progress, traditions, trust scores |
| Hero Hall | Done | Character database with prestige, achievements, alive/dead filter |

### UI Features

| Feature | Status | Description |
|---------|--------|-------------|
| Auto-simulate | Done | Play/pause with speed control (1x/2x/5x) |
| Timeline | Done | Tick slider with battle/diplomacy event markers |
| Event Cards | Done | Modal with player choices for procedural events |
| Headlines | Done | Banner for major events (captures, betrayals, deaths) |
| Toast Notifications | Done | Auto-dismiss notifications color-coded by event type |
| Victory/Defeat Screen | Done | End-game modal with final statistics |
| Character Detail | Done | Profile, stats, skills, relationships, pair events, mentor info, achievements |

### Player Commands (23 types)

- **Military**: move, attack, reinforce, transfer_troops, train_unit, build_siege, blockade
- **City Management**: develop, build_improvement, build_district, set_path, establish_trade
- **Diplomacy**: propose_nap, propose_defense_pact, demand, sow_discord
- **Characters**: hire_neutral, assign_role, assign_mentor, designate_heir
- **Espionage**: spy, sabotage
- **Technology**: start_research

## Known Issues

- **勢力淘汰過快**：弱勢勢力（如呂布）仍可能在 15 tick 內被消滅，中期博弈階段偏短
- **叛亂連鎖**：新佔領城市忠誠度低，連續叛亂可能導致佔領方反而虧損

## Planned Development

### ~~Phase 1 — Character & City Content~~ ✅ Complete

- [x] 武將資料充實：35 位武將皆有歷史背景敘述（biography）、能力值、技能樹
- [x] 武將頭像系統：支援 avatarUrl 顯示
- [x] 城市介紹系統：36 座城市皆有地理描述，在 sidebar 和地圖上呈現
- [x] 擴充城市數量：36 座城市覆蓋所有 EU4 中國區域（含蘇杭、閩贛、廣西、貴州）
- [x] 現代化地名：全面使用現代城市名稱（北京、南京、廣州等）
- [x] 道路系統：IGraphRepository 支援 Road 操作，NPC AI 依路徑鄰接決策

### Phase 2 — Game Balance (In Progress)

- [x] 難度分級系統：3 套難度預設（簡單/普通/困難），影響經濟、成本、NPC AI、事件頻率
- [x] 經濟再平衡：降低強化成本（150→80）、提高城市收入（大城 40→50）
- [x] 駐軍自然恢復：每 N tick 被控制城市 +1 駐軍（上限依城市等級與難度）
- [x] 駐軍轉移系統：玩家/NPC 可透過道路在城市間調兵
- [x] 城市忠誠度與叛亂：佔領城市忠誠度逐漸下降，低於門檻有機率叛亂
- [x] NPC AI 調兵：NPC 自動從盈餘城市轉移兵力到缺口城市
- [ ] 延長遊戲時長：拉長勝利條件門檻，確保遊戲有足夠的中期博弈階段
- [ ] 弱勢勢力保護機制：防止小勢力過早被消滅

### Phase 3 — Polish & UX

- [ ] Tutorial / onboarding flow for new players
- [ ] Sound effects and background music
- [ ] Keyboard shortcuts for common commands
- [ ] Undo last command before advancing day

### Phase 4 — Desktop Packaging

- [ ] Electron or Tauri packaging for local desktop distribution
- [ ] Remove Neo4j dependency — use In-Memory repository as default
- [ ] Offline-first: no network required after install
- [ ] Auto-save on day advance

### Phase 5 — Advanced Features

- [ ] More event cards and world events
- [ ] Campaign scenarios with preset starting conditions
- [ ] Multiplayer (local hot-seat)
- [ ] Mod support (custom scenarios, characters, events)
- [ ] Localization (English, Japanese)
- [ ] Replay viewer — watch a completed game from event log

## Architecture Principles

- **Local-first**: everything runs on the player's machine, no cloud dependency
- **Data abstraction**: all DB access goes through repository interfaces
- **Event sourcing**: never mutate state directly; append events, derive state
- **Decoupled layers**: simulation produces events, frontend consumes snapshots

## License

Private project — not yet licensed for distribution.
