# Game engine package

Scope: `packages/game-engine/**` only. Client rules live in `packages/web/AGENTS.md`; worker rules in `packages/api-worker/AGENTS.md`; shared workflow, commands, and gates in the root file.

## Identity and boundaries

- The engine's only runtime dependency is `zod` (`package.json`), with no React, platform APIs, network, storage, or I/O in `src/`, pinned by the dependency-boundary describes in `packages/game-engine/src/platform/__tests__/architecture.contract.test.ts`.
- Imports inside the package use relative paths; the `@/` alias is not used here.
- `platform/` must not import `games/`, one game must not import another game, and cross-package access to a game goes only through its `public` entrypoint, pinned by the game-module dependency boundary tests in `packages/game-engine/src/platform/__tests__/architecture.contract.test.ts`.
- Removed generic directories (`engine`, `models`, `protocol`, `resolvers` under the package `src/`) and second game-module entrypoints besides `public` are pinned against by `does not expose removed generic game subpaths` and `exposes each game module only through public or testing entrypoints` in `packages/game-engine/src/platform/__tests__/architecture.contract.test.ts`.

## Versions and strictness

- TypeScript `~6.0.3`, Zod `^4.4.3`, Vitest `~4.1.10` (see `package.json`).
- The editor/test config extends the root config, so it inherits `strict: true` and `noUncheckedIndexedAccess: true`.
- The build config (`tsconfig.build.json`, used by the `build` script) is standalone and sets `strict: true` only; it does not set `noUncheckedIndexedAccess`.

## Public entrypoints and catalog

- Games expose `./games/<id>/public` plus `./games/catalog` and `./games/registry`; the exact export list is pinned by `EXPECTED_PACKAGE_EXPORTS` in `packages/game-engine/src/platform/__tests__/architecture.contract.test.ts`.
- The engine catalog is exhaustive over `GAME_TYPES`, pinned by `game registry completeness` in `packages/game-engine/src/platform/__tests__/gameRegistry.contract.test.ts`. A registry entry carries the engine export path, client module path, production flag, rewards, declared workflows, and HTTP routes. For the full new-game wiring list, see the root file's pointer to the generator.

## State shape and codec

- Every game owns `state/parseState.ts` (strict parser), `state/normalize.ts` (invariant checker), and `state/codec.ts` (game identity plus parser, satisfying `GameStateCodec`). Game state has no version field or persisted-state migration path; a shape change applies to the current state contract, and incompatible persisted data fails parsing.
- Werewolf is the exception to the normalize path: its checker lives at `domain/state/normalize.ts`, and its strict parser imports it from there.

## Reducers and handlers

- Handlers return domain `StateAction` values and outcomes only, with no platform effect identifiers or `sideEffects` field, pinned for werewolf handlers by `Werewolf handler event boundary` in `packages/game-engine/src/platform/__tests__/architecture.contract.test.ts`.
- New state fields are synced with the game's normalize checker through the strict parser's `satisfies Complete<...>` guard, which fails typecheck when a field is missing (for werewolf the sync point is the parser calling `normalizeState`).
- Restart semantics are defined per field in the game's reducer; in werewolf, `boardNominations` is explicitly preserved across restart.
- The roster is a seat-keyed record parsed by the shared roster parser (`parseRoomRoster`, `platform/room/roster.ts`), pinned by `rosterUnification.contract.test.ts`; there is no null-bearing `seats` array.

## Command and snapshot envelopes

- The command receipt is `RoomCommandResult` (`committed` with snapshot and `CommittedCommandOutcome`, or `rejected` with a reason), created and parsed only through the shared helpers in `platform/protocol/commandResult.ts`.
- Snapshots use `RoomSnapshot` with a `GameStateCodec`: exact keys, matching game type, then the game's parser.
- Shared seat commands and reason codes live in `platform/protocol/` (`commands.ts`, `reasons.ts`), pinned by `commandVocabulary.contract.test.ts` and `reasonCodes.contract.test.ts`.
- The realtime wire protocol is v2: client sends `SYNC` only; server sends `SYNC_RESULT`, `STATE_UPDATE`, `INBOX_HINT` (online/offline presence was removed 2026-11-07; no `PRESENCE` frame exists). Parsers are fail-fast strict schemas; violations are protocol errors. Close codes are defined in `platform/realtime/closeCodes.ts`.

## Werewolf role catalog and night runtime

- Werewolf's catalog data remains in `domain/models/roles/spec/` and powers role selection, templates, and existing projections. `ROLE_SPECS`, `SCHEMAS`, and `NIGHT_STEPS` still serve those consumers; they are not the runtime implementation of night actions.
- Night behavior lives in one module per role under `games/werewolf/roles/`, declared with `defineRole` from `roles/role.ts`. `WEREWOLF_ROLE_DEFINITIONS` in `roles/index.ts` registers those definitions; the shared wolf attack is declared separately in `roles/wolfKill.ts` and `WEREWOLF_SHARED_STEPS`.
- `roles/nightPlan.ts` builds the runtime step registry from the role and shared-step definitions. The central execution order remains `NIGHT_STEP_ORDER` in `domain/models/roles/spec/nightStepIds.ts`; every runtime step id must be declared there and in its role definition.
- When changing night behavior, update the role module, runtime registry/order, and the catalog metadata still consumed by existing surfaces. `roles/__tests__/roleSteps.contract.test.ts` covers the runtime role set and generated step behavior.

## Randomness, logging, assertions

- Randomness uses Web Crypto: `crypto.getRandomValues` through `platform/random/random.ts` (`secureRng` and friends).
- No `console.*` in this package (`no-console` error in the root `eslint.config.mjs`) and no logger dependency; pure APIs return typed outcomes or throw contract errors.
- No ordinary type assertions in production code: only `as const` is allowed, pinned by `game-engine production type honesty` in `packages/game-engine/src/platform/__tests__/architecture.contract.test.ts` and `Production types: no ordinary assertions` in `contracts/architecture.contract.test.ts`. Use type guards, `satisfies`, or generic inference instead.

## Tests for this package

- Runner: Vitest. Config includes `src/**/__tests__/**/*.test.ts`. The package scripts are `build` and `test` only; lint, format, and other gates run from the root.
- Contract tests pin the boundaries stated above: package exports, engine skeleton, capabilities, phase-deadline variants, and the no-ordinary-assertions rule.
- Settlement uses one arm decision (`decideSettleCountdownArm`, `SETTLE_COUNTDOWN_MS = 5000`) with no manual-close path, pinned by `settleCountdown.contract.test.ts` (`platform/room/settleCountdown.ts`).
