# Game engine package

Scope: `packages/game-engine/**` only. Client rules live in `src/AGENTS.md`; worker rules in `packages/api-worker/AGENTS.md`; shared workflow, commands, and gates in the root file.

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

## State identity, codec, and versions

- Every game owns `state/version.ts` (`*_STATE_IDENTITY`: game type plus state version), `state/parseState.ts` (strict parser, current version only), `state/normalize.ts` (invariant checker), and `state/codec.ts` (identity plus parser, satisfying `GameStateCodec`).
- Werewolf is the exception to the normalize path: its checker lives at `domain/state/normalize.ts`, and its strict parser imports it from there.
- Current versions and accepted older versions (each in its game's `state/version.ts` and `state/migratePersisted*State`):

  | Game       | Current | `migratePersisted*State` accepts |
  | ---------- | ------- | -------------------------------- |
  | werewolf   | 16      | 12, 13, 14, 15                   |
  | avalon     | 10      | 1–9                              |
  | fibking    | 8       | 5, 6, 7                          |
  | pictionary | 9       | 8 only                           |
  | undercover | 5       | 1, 2, 3, 4                       |
  | storyrelay | 2       | 1 only                           |
  | drawguess  | 2       | 1 only                           |
  | demo       | 1       | none (strict parser only)        |

- A strict parser rejects every other version. A migration function upgrades field by field, then runs the strict parser.
- Persisted state is migrated at read time by the worker (see the worker file). The engine owns the per-version upgrade functions only.

## Reducers and handlers

- Handlers return domain `StateAction` values and outcomes only, with no platform effect identifiers or `sideEffects` field, pinned for werewolf handlers by `Werewolf handler event boundary` in `packages/game-engine/src/platform/__tests__/architecture.contract.test.ts`.
- New state fields are synced with the game's normalize checker through the strict parser's `satisfies Complete<...>` guard, which fails typecheck when a field is missing (for werewolf the sync point is the parser calling `normalizeState`).
- Restart semantics are defined per field in the game's reducer; in werewolf, `boardNominations` is explicitly preserved across restart.
- The roster is a seat-keyed record parsed by the shared roster parser (`parseRoomRoster`, `platform/room/roster.ts`), pinned by `rosterUnification.contract.test.ts`; there is no null-bearing `seats` array.

## Command and snapshot envelopes

- The command receipt is `RoomCommandResult` (`committed` with snapshot and `CommittedCommandOutcome`, or `rejected` with a reason), created and parsed only through the shared helpers in `platform/protocol/commandResult.ts`.
- Snapshots use `RoomSnapshot` with a `GameStateCodec`: exact keys, matching game type and state version, then the game's parser.
- Shared seat commands and reason codes live in `platform/protocol/` (`commands.ts`, `reasons.ts`), pinned by `commandVocabulary.contract.test.ts` and `reasonCodes.contract.test.ts`.
- The realtime wire protocol is v2: client sends `SYNC` only; server sends `SYNC_RESULT`, `STATE_UPDATE`, `PRESENCE`, `INBOX_HINT`. Parsers are fail-fast strict schemas; violations are protocol errors. Close codes are defined in `platform/realtime/closeCodes.ts`.

## Models: one source, derived registries

- Werewolf role models live in `domain/models/`. Each game owns its models. (Only werewolf has a `domain/models/` directory.)
- `ROLE_SPECS` is the single source for what a werewolf role is and does. `SCHEMAS` is built from it (`buildSchemas`), and `NIGHT_STEPS` is derived from it plus the night-step order (`buildNightSteps`). Edits go in the spec; the registries are derived.

## Randomness, logging, assertions

- Randomness uses Web Crypto: `crypto.getRandomValues` through `platform/random/random.ts` (`secureRng` and friends).
- No `console.*` in this package (`no-console` error in the root `eslint.config.mjs`) and no logger dependency; pure APIs return typed outcomes or throw contract errors.
- No ordinary type assertions in production code: only `as const` is allowed, pinned by `game-engine production type honesty` in `packages/game-engine/src/platform/__tests__/architecture.contract.test.ts` and `Production types: no ordinary assertions` in `src/__tests__/architecture.contract.test.ts`. Use type guards, `satisfies`, or generic inference instead.

## Tests for this package

- Runner: Vitest. Config includes `src/**/__tests__/**/*.test.ts`. The package scripts are `build` and `test` only; lint, format, and other gates run from the root.
- Contract tests pin the boundaries stated above: package exports, engine skeleton, capabilities, phase-deadline variants, and the no-ordinary-assertions rule.
- Settlement uses one arm decision (`decideSettleCountdownArm`, `SETTLE_COUNTDOWN_MS = 5000`) with no manual-close path, pinned by `settleCountdown.contract.test.ts` (`platform/room/settleCountdown.ts`).
