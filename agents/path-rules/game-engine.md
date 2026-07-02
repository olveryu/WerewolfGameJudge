---
name: 'Game Engine'
description: 'Pure game logic shared package: relative paths, zero platform deps, shared runtime plus per-game modules. Use when: editing game-engine package, registry, seating, werewolf, fibking, growth system, shared game logic'
applyTo: 'packages/game-engine/**'
---

# @werewolf/game-engine Package Standards

Pure game logic package (pnpm workspace), imported by both client and server simultaneously. Zero platform dependencies.

Current boundary:

- `engine/`: game-agnostic runtime contracts/kernels only.
- `werewolf/`: Werewolf rules, protocol state, reducers, handlers, resolvers, role models.
- `fibking/`: FibKing rules, protocol state, handlers, store.
- `cosmetics/`: cross-game cosmetic IDs/types such as role reveal effects.
- `growth/`, `utils/`, `protocol/`: shared support modules.

## Core Rules

- All imports use **relative paths** (`../models/roles`). `@/` alias is forbidden (`tsconfig.json` has `paths: {}` empty).
- React / React Native / Expo / any platform dependency is forbidden. Importing from `src/` directory is forbidden.
- Node.js-specific APIs (`fs`/`path`/`process` etc.) forbidden in src/.
- `console.*` forbidden — use `getEngineLogger()` (DI pattern: `setEngineLogger()` injects, noop when not injected).
- Random numbers/IDs use Web Crypto API (`crypto.getRandomValues`).

## Import Rules

- Consumers import via **deep paths** (tree-shaking friendly):
  - `import { ROLE_SPECS } from '@werewolf/game-engine/werewolf/models/roles'`
  - `import { SCHEMAS } from '@werewolf/game-engine/werewolf/models/roles/spec/schemas'`
  - `import type { WerewolfState } from '@werewolf/game-engine/werewolf/protocol/types'`
  - `import { ROLE_REVEAL_EFFECT_IDS } from '@werewolf/game-engine/cosmetics/roleRevealEffects'`
  - `import { getLevel } from '@werewolf/game-engine/growth/level'`
- `index.ts` barrel export exists but **is not used**. Root-level `import { ... } from '@werewolf/game-engine'` is forbidden.
- Modifying game logic → edit `packages/game-engine/src/` source files.
- Adding files: create source file in game-engine, export by module path. Platform-specific files don't belong in game-engine — place in `src/`.

## Reducer Rules

- **Reset completeness**: Reset-type actions like `RESTART_GAME` must reset **all** mutable fields of the state interface. When adding new state fields, reset logic must be updated in sync.
- **Null seat defense**: `seats` array contains `null` (empty seats). When iterating/filtering/`.every()` checks, handle `null` explicitly (`p === null || p.property`), don't rely on optional chaining short-circuit.

## Handler Rules

- **Null-state guard**: All game control handlers must check `if (!state)` and return error on the first line. This is an established pattern (`handleStartGame` etc.) — new handlers must follow.
- **sideEffects must not be omitted**: Handler results that modify state must include corresponding `sideEffects` (`BROADCAST_STATE` / `SAVE_STATE`). Omission = state changes not persisted, not broadcast.
- **New `WerewolfState` fields must sync `normalizeWerewolfState`** (`werewolf/state/normalizeWerewolfState.ts`): compile-time `satisfies Complete<...>` guard will error as reminder. Omission = field silently dropped.
- **JSDoc requirement**: Handler module headers must contain `@remarks` explaining core logic (gate validation order, death calculation timing, etc.). Public handler functions annotated with `@pre` (state.status and other preconditions).

## Shared Runtime Modules

| Module              | File                                                                                                   | Responsibility                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Engine registry** | `engine/registry/types.ts`                                                                             | Game-agnostic engine contract consumed by Worker DO registry                                                                                                |
| **Seating kernel**  | `engine/seating/kernel.ts`                                                                             | Game-agnostic seat occupancy operations shared by game modules                                                                                              |
| **SnapshotStore**   | `engine/store/SnapshotStore.ts`                                                                        | Generic state holder + revision management + applySnapshot + subscribe/notify. No business logic, no IO                                                     |
| **Cosmetics**       | `cosmetics/roleRevealEffects.ts`                                                                       | Cross-game role reveal effect IDs and deterministic random effect resolution                                                                                |
| **Growth**          | `growth/level.ts` + `growth/frameUnlock.ts` + `growth/rewardCatalog.ts` + `growth/gachaProbability.ts` | XP thresholds · level calculation · reward unlocks · gacha probability engine (rollRarity / selectReward / pity)                                            |
| **ActionResult**    | `protocol/ActionResult.ts`                                                                             | Operation result DU: `{ success: true } \| { success: false; reason: string }`. Per-game protocol modules add `state` / `revision` / `sideEffects` variants |

## Werewolf Modules

| Module                | File                                          | Responsibility                                                                                         |
| --------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **WerewolfStore**     | `werewolf/store/WerewolfStore.ts`             | Werewolf state holder built on `SnapshotStore`                                                         |
| **Intents**           | `werewolf/intents/types.ts`                   | Strongly-typed Werewolf intent definitions from UI to handlers                                         |
| **InlineProgression** | `werewolf/inlineProgression.ts`               | Server-side recursive Werewolf night step advancement within one request, collecting audio sideEffects |
| **ResolveWolfVotes**  | `werewolf/resolveWolfVotes.ts`                | Wolf vote aggregation calculation                                                                      |
| **DeathCalculator**   | `werewolf/DeathCalculator.ts`                 | Werewolf night death settlement (guard/poison/attack/chain)                                            |
| **Reducer**           | `werewolf/reducer/werewolfReducer.ts`         | Applies Werewolf actions to `WerewolfState`                                                            |
| **Normalize**         | `werewolf/state/normalizeWerewolfState.ts`    | Normalizes serialized `WerewolfState` after reducer/application boundaries                             |
| **Initial state**     | `werewolf/state/buildInitialWerewolfState.ts` | Builds initial `WerewolfState` from a preset template                                                  |
| **Models**            | `werewolf/models/`                            | Werewolf templates, statuses, role ids, role specs, and role actions                                   |
| **Resolvers**         | `werewolf/resolvers/`                         | Werewolf night role resolution                                                                         |
