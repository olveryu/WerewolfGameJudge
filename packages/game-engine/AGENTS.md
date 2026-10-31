# Game engine package

Scope: `packages/game-engine/**` only. Client rules live in `src/AGENTS.md`; worker rules in `packages/api-worker/AGENTS.md`; shared workflow, commands, and gates in the root file.

## Identity and boundaries

- Pure game logic only. The only runtime dependency is `zod`. No React, no platform APIs, no network, no storage, no I/O in `src/`.
- Imports inside the package use relative paths; the `@/` alias is not used here. Do not import client or worker code.
- `platform/` must not import `games/`. One game must not import another game. Cross-package access to a game goes only through its `public` entrypoint, as listed in the package exports.
- Do not restore removed generic directories (`engine`, `models`, `protocol`, `resolvers` under the package `src/`) or add a second game-module entrypoint besides `public`.

## Versions and strictness

- TypeScript `~6.0.3`, Zod `^4.4.3`, Vitest `~4.1.10` (see `package.json`).
- The editor/test config extends the root config, so it inherits `strict: true` and `noUncheckedIndexedAccess: true`.
- The build config (`tsconfig.build.json`, used by the `build` script) is standalone and sets `strict: true` only; it does not set `noUncheckedIndexedAccess`. Do not claim the shipped build is checked with that flag.

## Public entrypoints and catalog

- Games expose `./games/<id>/public` plus `./games/catalog` and `./games/registry`. The exact export list is pinned by the `EXPECTED_PACKAGE_EXPORTS` contract test; adding or removing an export means updating that test in the same change.
- The engine catalog is exhaustive over `GAME_TYPES`. A registry entry carries the engine export path, client module path, production flag, rewards, declared workflows, and HTTP routes. For the full new-game wiring list, see the root file's pointer to the generator; do not hand-maintain a second checklist here.

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

- A strict parser rejects every other version. A migration function upgrades field by field, then runs the strict parser. Never widen a strict parser to accept an old version, and never silently drop a field a migration does not name.
- Persisted state is migrated at read time by the worker (see the worker file). The engine owns the per-version upgrade functions only.

## Reducers and handlers

- Handlers return domain `StateAction` values and outcomes only. No side effects in handlers: no broadcast, audio, save, or message effect identifiers, and no `sideEffects` field.
- New state fields must be synced with the game's normalize checker: the strict parser's `satisfies Complete<...>` guard must keep passing. For werewolf the sync point is the parser calling `normalizeState`.
- Restart semantics are defined per field in the game's reducer. Do not assume a reset clears every mutable field: in werewolf, `boardNominations` is explicitly preserved across restart. A new field must state its restart behavior where the reducer defines it.
- There is no null-bearing `seats` array. The roster is a seat-keyed record parsed by the shared roster parser. Do not write null-seat guards for a shape that does not exist.

## Command and snapshot envelopes

- The authoritative command receipt is `RoomCommandResult` (`committed` with snapshot and `CommittedCommandOutcome`, or `rejected` with a reason), created and parsed only through the shared helpers in `platform/protocol/commandResult.ts`. A second, lossy result shape is forbidden.
- Snapshots use `RoomSnapshot` with a `GameStateCodec`: exact keys, matching game type and state version, then the game's parser.
- Shared seat commands and reason codes live in `platform/protocol/` (`commands.ts`, `reasons.ts`). Games must not invent equivalents.
- The realtime wire protocol is v2: client sends `SYNC` only; server sends `SYNC_RESULT`, `STATE_UPDATE`, `PRESENCE`, `INBOX_HINT`. Parsers are fail-fast strict schemas; violations are protocol errors. Close codes are defined in `platform/realtime/closeCodes.ts`.

## Models: one source, derived registries

- Werewolf role models live in `domain/models/`. Each game owns its models; other games must not import them. (Only werewolf has a `domain/models/` directory; do not write a glob implying all games do.)
- `ROLE_SPECS` is the single source for what a werewolf role is and does. `SCHEMAS` is built from it (`buildSchemas`), and `NIGHT_STEPS` is derived from it plus the night-step order (`buildNightSteps`). Edit the spec; never hand-edit a derived registry.
- Step identity is the `NightStepId` derived from the derived steps. Constraints belong on schemas (schema-first). Resolver inputs carry no cross-night fields. Do not state any blanket attack-neutrality rule: constraints are declared per spec, and the code carries them.

## Randomness, logging, assertions

- Randomness uses Web Crypto: `crypto.getRandomValues` through `platform/random/random.ts` (`secureRng` and friends). `Math.random` is not used here.
- No `console.*` in this package (enforced by the shared lint config), and no logger dependency. Pure APIs return typed outcomes or throw contract errors; they do not log.
- No ordinary type assertions in production code. Only `as const` is allowed; both `x as T` and `<T>x` are violations, pinned by contract tests in this package and in the client. Use type guards, `satisfies`, or generic inference instead.
- No Node-specific APIs (`fs`, `path`, `process`) in `src/`.

## Tests for this package

- Runner: Vitest. Config includes `src/**/__tests__/**/*.test.ts`. The package scripts are `build` and `test` only; lint, format, and other gates run from the root.
- Contract tests pin the boundaries stated above: package exports, engine skeleton, capabilities, phase-deadline variants, and the no-ordinary-assertions rule. A change that moves a boundary must update the pinning test in the same change, not work around it.
- Settle rule (shared chassis): `SETTLE_COUNTDOWN_MS = 5000`, one arm decision (`decideSettleCountdownArm`): complete arms or refreshes the deadline, incomplete clears an armed deadline, otherwise no-op. There is no manual-close path; do not add one.
