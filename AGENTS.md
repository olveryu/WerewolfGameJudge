# AGENTS.md

Global rules for this repository. Area rules live in the nested files listed at the end; read the nested file for the area being changed. When this file and the code disagree, the code and its contract tests decide; fix this file.

## Project snapshot

A multi-game judge app (React Native / Expo) for in-person play, backed by a Cloudflare Worker with Durable Objects, D1, and R2. It ships web, iOS, Android, and a WeChat mini-program, and includes collection and progression product modules.

Versions: Expo `~56.0.20`, React Native `0.85.3`, React `19.2.3`, TypeScript `~6.0.3`, ESLint `^9.39.4`, Jest `29.7.0` (root), Vitest `~4.1.10` (both packages), Zod `^4.4.3`, Turbo `^2.11.7`, Node `>=22.13.0` (`.nvmrc` pins `22.22.1`), pnpm `10.32.1`.

TypeScript strictness is per config: the root config sets `strict` and `noUncheckedIndexedAccess`; the game-engine build config and the worker config set `strict` only.

Layout: a pnpm workspace with three parts — the root app, `packages/game-engine` (pure game logic; its only runtime dependency is Zod), and `packages/api-worker` (the Worker, Durable Object, and D1 access).

Games (8): werewolf, fibking, pictionary, undercover, storyrelay, drawguess, avalon, demo. Demo is the hand-built reference the generator templates mirror; it is not generator output, and it is the only game marked non-production.

State versions: werewolf 16, avalon 10, fibking 8, pictionary 9, undercover 5, storyrelay 2, drawguess 2, demo 1.
Upgrade rule: persisted states migrate in place at read through each game's `migratePersisted*State`; a newer or unsupported version throws. Any persisted-shape change must add an upgrade path covering at least the previous version. A Durable Object storage-schema mismatch discards the room instead; that is a different mechanism.

The version number is authoritative in `package.json` only; `src/config/version.ts` reads it at import time, and `app.json` and `CHANGELOG.md` are generated from it by the release script.

## Commands

| Task              | Exact command                                                            | Scope                                                                  |
| ----------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Root tests        | `pnpm run test` (Jest, `src/` only)                                      | Local, scoped by path filter                                           |
| All tests         | `pnpm run test:all`                                                      | Full run; CI only                                                      |
| Engine build      | `pnpm --filter @game-judge/game-engine run build`                        | As needed; CI builds it first                                          |
| Root typecheck    | `pnpm run typecheck`                                                     | Local, scoped where possible                                           |
| Worker typecheck  | `pnpm --filter @game-judge/api-worker run typecheck`                     | Local, scoped where possible                                           |
| Lint              | `pnpm exec eslint <changed files>`                                       | Local, changed files only; full run in CI                              |
| Format check      | `pnpm exec prettier --check <changed files>`                             | Local, changed files only; full run in CI                              |
| Unused code       | `pnpm run knip`                                                          | Local; also runs before push                                           |
| Agent files check | `pnpm run validate:agents`                                               | Local and CI                                                           |
| Full gate         | `pnpm run quality`                                                       | Full run; CI only                                                      |
| E2E               | `pnpm run e2e`                                                           | Full run; CI only (sharded)                                            |
| Single E2E spec   | `gh workflow run e2e-single-spec.yml --ref <branch> --field spec=<file>` | One spec at a time; verify the run with `gh api` (see `e2e/AGENTS.md`) |
| Local dev         | `pnpm run dev`                                                           | Worker plus web                                                        |
| Local migrations  | `pnpm --filter @game-judge/api-worker run db:migrate:local`              | Before first local run or after a new migration                        |
| New game          | `pnpm new-game <gameId>`                                                 | Generator; see the new-game skill                                      |
| Release           | `bash scripts/release.sh [patch\|minor\|major]`                          | Needs explicit approval; see Task tiers                                |

`pnpm run quality` runs `turbo run build typecheck lint knip format test && pnpm run validate:agents`. In CI the same work is split: one job runs Turbo build/typecheck/knip plus the agent-files check, lint/format run as a parallel job, tests run sharded, and `ci-gate` requires all of them. E2E is not part of `quality`. Locally, run the scoped form of the failing area (path-filtered tests, the changed package's typecheck) plus `tsc --noEmit` and `knip`, which also run before push; do not present a local full `quality` run as the gate.

## Architecture boundaries

The engine is the sole authority for game logic: state transitions, rule decisions, and settlement are decided in `packages/game-engine`, applied atomically by the Durable Object, and broadcast as snapshots. The client renders authoritative snapshots and never recomputes an engine decision.

Layers: `platform/` holds shared protocol, realtime, room, and audio chassis code; `games/` holds one directory per game, and one game never imports another — cross-package game code is reached only through that game's `public` entrypoint; `product/` holds growth, rewards, and word-supply modules. The engine package has no React, Cloudflare, network, storage, or Node dependencies.

Room link and state identity: the client link lives in `src/platform/realtime/` (`RoomLink`, pure reducer plus runtime). Commands go over HTTP `POST /room/command` and are correlated by `commandId`; state arrives over the WebSocket as snapshots. A snapshot is `RoomSnapshot { gameType, stateVersion, revision, state }`, decoded by the game's `GameStateCodec`. The wire protocol is v2: the client sends `SYNC` only; the server sends `SYNC_RESULT`, `STATE_UPDATE`, `PRESENCE`, or `INBOX_HINT`. Terminal close codes are 1002 and 4000–4003; 4004 is rate-limited and retries. Reconnection is unbounded and driven by the pure reducer.

Host flow: host management exists only for the host, decided by the shell factory (`viewer.isHost`); games build it ungated. Bottom buttons declare only the audiences `participant` or `anyone` — there is no host audience, and the host's next step is the host task card, which references sheet actions by key and carries no handler. For werewolf Day/Ended, the host-only flow is last-night info, then review, then closing; the review step completes only when the host has shared the review, read from the engine's `nightReviewAllowedSeats`.

Sheriff secrecy is a derivation, not redaction: the shared record function returns `null` during registration, so no surface — panel, review, or host — may display the count or list; only the viewer's own registration state is exposed. The panel and the night review share that one record.

The night-review verdict is settled by the engine: target and verdict are computed once, in one persisted action, and the client renders the recorded verdict only — it never recounts votes into a verdict, and an unrecorded verdict renders as pending even when the votes are unanimous.

Settlement has one rule: when every required submission is in, a 5-second countdown arms (`SETTLE_COUNTDOWN_MS = 5000`) and settlement runs on expiry. There is no manual finish. A foreground client may dispatch expiry at zero, but that only accelerates the server's scheduled settlement; it is never the authority.

Persistence: D1 is the relational store and Drizzle is the typed layer over it, with a schema-free driver and hand-written SQL migrations; each table is declared once in its owner `dbSchema.ts` module, and tables reached only through raw SQL have no such declaration. Room authority state lives in the Durable Object's own SQLite storage (schema version 3, no migration chain: a stored mismatch discards the room), together with command receipts and the effect outbox. R2 provides the `AVATARS` and `GAME_MEDIA` buckets; D1, Durable Object, rate-limit, workflow, cron, and analytics bindings are declared in the worker `wrangler.toml`.

A new game is registered in the engine registry, the engine catalog, the worker catalog, the client catalog, and the test fixture catalog, with a D1 registration migration and the contract-test whitelists updated; the generator performs the mechanical edits. See the nested engine and worker files and the new-game skill for the full list.

## Conventions the code cannot guess

Confirmations: call `showAlert`/`showPrompt` from `src/utils/alert.ts` (or render `AlertModal` directly); import `Modal` only from `@/components/AppModal`, never from `react-native` — see `src/components/AlertModal.tsx` and the `no-restricted-imports` rule in `eslint.config.mjs`.

Logging: use named loggers from `src/utils/logger.ts`; `console.*` is an ESLint error, with narrow exemptions only for `jest.setup.ts`, `__mocks__/**`, `e2e/helpers/diagnostics.ts`, and the worker logger — see `eslint.config.mjs`.

Zod boundaries: internal data uses `z.strictObject`; permissive `z.object` is allowed only in the 8 worker files listed by the contract test, all external provider payloads — see `src/__tests__/architecture.contract.test.ts`.

Type honesty: production code across all three packages allows only `as const` assertions — no plain `as`, no angle-bracket assertions; test files are excluded by the contract-test walker — see `src/__tests__/architecture.contract.test.ts` and the engine architecture contract test.

Style tokens: import `colors`, `spacing`, `typography`, `borderRadius`, `shadows`, and related tokens from `@/theme`; literal style values are policed by a contract test with a ratchet allowlist that can only shrink — see `src/__tests__/noHardcodedStyleValues.contract.test.ts`.

Naming: use the renamed identifiers enforced by `no-restricted-syntax` (`roomCode`, `seat`, `hostUserId`, `isPityTriggered`, `userId`); check existing names with grep before introducing a new one; commit headers are at most 100 characters with a conventional type — see `eslint.config.mjs` and `commitlint.config.js`.

## Principles

1. Fix the root cause, not the symptom: if removing the change leaves the trigger in place, the fix is incomplete.
2. Check the current code and current library documentation before writing an API call, a dependency, or an architecture decision; never invent behavior.
3. Be honest in types: every optional marker and assertion must match what the type truly allows; required fields stay required.
4. Fail fast and visibly: validate strictly, never swallow an error silently, and give every catch a handler.
5. Finish end to end: a new type, field, or enum needs consumers across the whole chain or it is dead code, and shared behavior lives in exactly one implementation.

## Task tiers

Read-only work is free: reading, searching, and running checks, tests, formatting, and typechecks on a scoped area.

Scoped edits inside an approved task are free: changes within the approved files and scope, including targeted fixes and their tests; verify every touched symbol's consumers before editing, and stay inside the approved scope.

Explicit approval is required, naming the action, for: merging, releasing, deploying, production migrations or production configuration, changing CI gates, force-pushing, bypassing verification, deleting data, or any work outside the approved scope. Approval to implement is not approval to merge or publish; those are separate approvals.

## Output rule

Summarize results in text; for failures, give excerpts, counts, and `file:line` references only, write the full log to a file on disk, print that file's path, and read only the failure section. Judge pass or fail from the command's own exit status or the CI conclusion field, never from a piped command's exit code.

## Pointers

Nested files: `packages/game-engine/AGENTS.md`, `packages/api-worker/AGENTS.md`, `src/AGENTS.md`, `e2e/AGENTS.md`.

Skills: `.agents/skills/<name>/SKILL.md` — read the skill before starting its workflow; skills never replace the nested area files.

Wiring: `docs/agent-config.md` — the human wiring document for this file set: layout, budgets, how to add or change a rule or skill, and how to verify loading.

Deciding docs: `docs/README.md` (index), `docs/room-shell-contract.md`, `docs/multigame-platform-design.md` §25 (new-game checklist), `docs/realtime-link-redesign.md` (current-system sections only; its opening tables describe the pre-redesign system), `docs/DEPLOYMENT.md`, `e2e/helpers/README.md`.
