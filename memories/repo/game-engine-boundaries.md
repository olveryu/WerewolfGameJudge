# Game Engine Boundaries

- `packages/game-engine/src/engine/` is game-agnostic runtime only: registry contracts, seating
  kernel, and generic snapshot store.
- Werewolf-specific rules live under `packages/game-engine/src/werewolf/`: handlers, reducer,
  protocol state, store, intents, models, resolvers, death calculation, inline progression, and
  wolf vote resolution.
- FibKing-specific rules live under `packages/game-engine/src/fibking/`.
- Do not keep re-export shells for old Werewolf paths such as `@werewolf/game-engine/models`,
  `@werewolf/game-engine/resolvers`, or `@werewolf/game-engine/protocol/types`.
- Contract tests that inspect filesystem paths should point at `packages/game-engine/src/werewolf/...`
  for Werewolf rules, not the old root `models/` or `resolvers/` locations.
