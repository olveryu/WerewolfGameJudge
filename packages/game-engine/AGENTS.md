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

- A role is declared once, in its own module under `games/werewolf/roles/`, with `defineRole` from `roles/role.ts`: its card (name, icon, description sections, tags), its traits (faction, team, wolf recognition, immunities), and its night steps. `roles/catalog.ts` reads role selection, templates, and display data from those modules (`getRoleCard`, `getAllRoleIds`, `Faction`, `Team`); there is no second role table. `WEREWOLF_ROLE_DEFINITIONS` in `roles/index.ts` registers those definitions; the shared wolf attack is declared separately in `roles/wolfKill.ts` and `WEREWOLF_SHARED_STEPS`.
- `roles/nightPlan.ts` builds the runtime step registry from the role and shared-step definitions. The central execution order is `NIGHT_STEP_ORDER` in `roles/nightStepOrder.ts`; every step id must be declared there and in its role definition.
- When changing a role, update its module and, for a new step, the step order. `roles/__tests__/roleSteps.contract.test.ts` covers the runtime role set and step behavior. What every step shows is generated from played nights into `__tests__/boards/__snapshots__/night-steps.catalogue.txt` by `night1.catalogue.integration.test.ts`, which also fails when a sentence in a night copy table is shown in no played night.
- A role id is named only in a role module. A rule that belongs to one role is a declaration in that role's module that the flow reads, never a branch in flow code; `roles/__tests__/roleOwnership.contract.test.ts` lists every other role id literal with its reason and fails on a new one.
- A hand card never prints why it is unavailable. The status line says it, and names the card to press when only one is left; `explains every greyed card in the status line` in the catalogue test checks every played night.
- Avalon and Secret Hitler have the same generated list for their nights (`games/<game>/__tests__/__snapshots__/night-steps.catalogue.txt`), built with `platform/steps/__tests__/catalogueKit.ts`; a new game on the step mechanism adds one.
- The catalogue is the reviewed record of everything a night shows. A diff to it is a user-facing change: report every changed line to the user, and get the user's confirmation before committing a new or reworded sentence or a rule the user has not decided. Never regenerate it with `-u` only to make the test pass.
- Catalogue locations and approval workflow live in `docs/catalogues/README.md` and `scripts/lib/catalogues/registry.mjs`. Related tests and `catalogue:check` write complete candidates and line diffs to `.catalogue-reports/`; only explicit `catalogue:update --reviewed <ids>` updates baselines, never CI or Vitest `-u`. A generated narrated game must replace the TODO step and supply formal night scenarios before its catalogue can pass.
- No check can enumerate situations: one nobody plays is absent from the catalogue and from review. For each situation a role or rule introduces — every action used and skipped, every unavailable reason, the actor feared, the actor converted, the target swapped, the role as a bottom card, the step on a night with and without a wolf attack — add a played night to `__tests__/boards/nightScenarios.ts`.

## Randomness, logging, assertions

- Randomness uses Web Crypto: `crypto.getRandomValues` through `platform/random/random.ts` (`secureRng` and friends).
- No `console.*` in this package (`no-console` error in the root `eslint.config.mjs`) and no logger dependency; pure APIs return typed outcomes or throw contract errors.
- No ordinary type assertions in production code: only `as const` is allowed, pinned by `game-engine production type honesty` in `packages/game-engine/src/platform/__tests__/architecture.contract.test.ts` and `Production types: no ordinary assertions` in `contracts/architecture.contract.test.ts`. Use type guards, `satisfies`, or generic inference instead.

## Tests for this package

- Runner: Vitest. Config includes `src/**/__tests__/**/*.test.ts`. The package scripts are `build` and `test` only; lint, format, and other gates run from the root.
- Contract tests pin the boundaries stated above: package exports, engine skeleton, capabilities, phase-deadline variants, and the no-ordinary-assertions rule.
- Settlement uses one arm decision (`decideSettleCountdownArm`, `SETTLE_COUNTDOWN_MS = 5000`) with no manual-close path, pinned by `settleCountdown.contract.test.ts` (`platform/room/settleCountdown.ts`).
