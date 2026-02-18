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

### Player Commands (22 types)

- **Military**: move, attack, reinforce, train_unit, build_siege, blockade
- **City Management**: develop, build_improvement, build_district, set_path, establish_trade
- **Diplomacy**: propose_nap, propose_defense_pact, demand, sow_discord
- **Characters**: hire_neutral, assign_role, assign_mentor, designate_heir
- **Espionage**: spy, sabotage
- **Technology**: start_research

## Known Issues

- **武將描述不足**：目前武將只有名字和特質，缺乏歷史背景敘述和頭像
- **城市描述缺失**：城市缺乏統一的介紹文字，UI 上沒有地方呈現城市背景
- **勝利條件過短**：各勢力成長曲線和迭代速度過快，遊戲太快結束
- **城市數量太少**：地圖上城市不夠多，且使用古地名不夠直覺

## Planned Development

### Phase 1 — Character & City Content

- [ ] 武將資料充實：為每位武將加入歷史背景敘述（biography）、能力值說明
- [ ] 武將頭像系統：支援頭像顯示，可使用 AI 生成或現代人物迷因圖
- [ ] 城市介紹系統：每座城市加入地理描述、歷史背景，在 sidebar 和地圖上呈現
- [ ] 擴充城市數量：增加更多城市節點，涵蓋更完整的地圖
- [ ] 現代化地名：以現代城市名稱與省份標示取代純古地名，提升辨識度

### Phase 2 — Game Balance

- [ ] 降低成長速度：調整經濟收入、科技研發、兵力恢復的數值曲線
- [ ] 延長遊戲時長：拉長勝利條件門檻，確保遊戲有足夠的中期博弈階段
- [ ] AI 難度分級：NPC 勢力的決策邏輯區分簡單/普通/困難
- [ ] 事件頻率調整：平衡隨機事件的正負面影響

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
