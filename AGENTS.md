# AGENTS.md

Global rules for this repository. Area rules live in the nested files listed at the end; read the nested file for the area being changed. When this file and the code disagree, the code and its contract tests decide; fix this file.

## Project snapshot

A multi-game judge app (React Native / Expo) for in-person play, backed by a Cloudflare Worker with Durable Objects, D1, and R2. It ships web, iOS, Android, and a WeChat mini-program, and includes collection and progression product modules.

Versions: Expo `~56.0.20`, React Native `0.85.3`, React `19.2.3`, TypeScript `~6.0.3`, ESLint `^9.39.4`, Jest `29.7.0` (root), Vitest `~4.1.10` (both packages), Zod `^4.4.3`, Turbo `^2.11.7`, Node `>=22.13.0` (`.nvmrc` pins `22.22.1`), pnpm `10.32.1`.

TypeScript strictness is per config: the root config sets `strict` and `noUncheckedIndexedAccess`; the game-engine build config and the worker config set `strict` only.

Layout: a pnpm workspace with three parts — the root app, `packages/game-engine` (pure game logic; its only runtime dependency is Zod), and `packages/api-worker` (the Worker, Durable Object, and D1 access).

Games (8): werewolf, fibking, pictionary, undercover, storyrelay, drawguess, avalon, demo. Demo is the hand-built reference the generator templates mirror; it is not generator output, and it is the only game marked non-production.

State versions: werewolf 16, avalon 10, fibking 8, pictionary 9, undercover 5, storyrelay 2, drawguess 2, demo 1.
Persisted states migrate in place at read through each game's `migratePersisted*State`; a newer or unsupported version throws. A Durable Object storage-schema mismatch discards the room instead; that is a different mechanism.

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
| Unused code       | `pnpm run knip`                                                          | Local                                                                  |
| Agent files check | `pnpm run validate:agents`                                               | Local and CI                                                           |
| Full gate         | `pnpm run quality`                                                       | Full run; CI only                                                      |
| E2E               | `pnpm run e2e`                                                           | Full run; CI only (sharded)                                            |
| Single E2E spec   | `gh workflow run e2e-single-spec.yml --ref <branch> --field spec=<file>` | One spec at a time; verify the run with `gh api` (see `e2e/AGENTS.md`) |
| Local dev         | `pnpm run dev`                                                           | Worker plus web                                                        |
| Local migrations  | `pnpm --filter @game-judge/api-worker run db:migrate:local`              | Before first local run or after a new migration                        |
| New game          | `pnpm new-game <gameId>`                                                 | Generator; see the new-game skill                                      |
| Release           | `bash scripts/release.sh [patch\|minor\|major]`                          | Release script                                                         |

`pnpm run quality` runs `turbo run build typecheck lint knip format test && pnpm run validate:agents`. In CI the same work is split: one job runs Turbo build/typecheck/knip plus the agent-files check, lint/format run as a parallel job, tests run sharded, and `ci-gate` requires all of them. E2E is not part of `quality`. Locally, run the scoped form of the failing area (path-filtered tests, the changed package's typecheck) plus `tsc --noEmit` and `knip`; do not present a local full `quality` run as the gate.

## Architecture boundaries

The engine decides state transitions, rule decisions, and settlement in `packages/game-engine`; the Durable Object applies them atomically and broadcasts snapshots for the client to render.

Layers: `platform/` holds shared protocol, realtime, room, and audio chassis code; `games/` holds one directory per game; `product/` holds growth, rewards, and word-supply modules. One game never imports another, and cross-package game code is reached only through that game's `public` entrypoint, pinned by the game-module dependency boundary and public-entrypoint tests in `packages/game-engine/src/platform/__tests__/architecture.contract.test.ts`. The engine package has no React, Cloudflare, network, storage, or Node dependencies.

Room link and state identity: the client link lives in `src/platform/realtime/` (`RoomLink`, pure reducer plus runtime). Commands go over HTTP `POST /room/command` and are correlated by `commandId`; state arrives over the WebSocket as snapshots. A snapshot is `RoomSnapshot { gameType, stateVersion, revision, state }`, decoded by the game's `GameStateCodec`. The wire protocol is v2: the client sends `SYNC` only; the server sends `SYNC_RESULT`, `STATE_UPDATE`, `PRESENCE`, or `INBOX_HINT`. Terminal close codes are 1002 and 4000–4003; 4004 is rate-limited and retries. Reconnection is unbounded and driven by the pure reducer.

Settlement uses one arm decision (`decideSettleCountdownArm`, `SETTLE_COUNTDOWN_MS = 5000`) with no manual finish, pinned by `settleCountdown.contract.test.ts` (`packages/game-engine/src/platform/room/settleCountdown.ts`).

Persistence: D1 is the relational store and Drizzle is the typed layer over it, with a schema-free driver and hand-written SQL migrations; D1 tables are declared once in owner `dbSchema.ts` modules (33, pinned by `declares every physical D1 table exactly once in its owner module` in `src/__tests__/architecture.contract.test.ts`), and tables reached only through raw SQL have no such declaration. Room authority state lives in the Durable Object's own SQLite storage (schema version 3, no migration chain: a stored mismatch discards the room), together with command receipts and the effect outbox. R2 provides the `AVATARS` and `GAME_MEDIA` buckets; D1, Durable Object, rate-limit, workflow, cron, and analytics bindings are declared in the worker `wrangler.toml`.

A new game is registered in the engine registry, the engine catalog, the worker catalog, the client catalog, and the test fixture catalog, with a D1 registration migration and the contract-test whitelists updated; the generator performs the mechanical edits. See the nested engine and worker files and the new-game skill for the full list.

## Enforced conventions

- Import `Modal` only from `@/components/AppModal`, enforced by `no-restricted-imports` in `eslint.config.mjs` (the only exemption is `AppModal` itself).
- `console.*` is a `no-console` error in `eslint.config.mjs`, exempt only in `jest.setup.ts`, `__mocks__/**`, `e2e/helpers/diagnostics.ts`, and the worker logger, with named loggers in `src/utils/logger.ts`.
- Permissive `z.object` appears only in the 8 worker files listed by `uses permissive Zod objects only for external provider payloads` in `src/__tests__/architecture.contract.test.ts`, all external provider payloads; internal data uses `z.strictObject`.
- Production code across all three packages allows only `as const` assertions, pinned by `Production types: no ordinary assertions` in `src/__tests__/architecture.contract.test.ts` and `game-engine production type honesty` in `packages/game-engine/src/platform/__tests__/architecture.contract.test.ts`.
- Style values use `@/theme` tokens (`colors`, `spacing`, `typography`, `borderRadius`, `shadows`), policed by `No hardcoded style values` in `src/__tests__/noHardcodedStyleValues.contract.test.ts` (ratchet allowlist, 0/1 literals allowed).
- Renamed identifiers (`roomCode`, `seat`, `hostUserId`, `isPityTriggered`, `userId`) are enforced by `no-restricted-syntax` in `eslint.config.mjs`, and commit headers are capped at 100 characters by `commitlint.config.js`.

## Output rule

Summarize results in text; for failures, give excerpts, counts, and `file:line` references only, write the full log to a file on disk, print that file's path, and read only the failure section. Judge pass or fail from the command's own exit status or the CI conclusion field, never from a piped command's exit code.

## Pointers

Nested files: `packages/game-engine/AGENTS.md`, `packages/api-worker/AGENTS.md`, `src/AGENTS.md`, `e2e/AGENTS.md`.

Skills: `.agents/skills/<name>/SKILL.md` — read the skill before starting its workflow; skills never replace the nested area files.

Wiring: `docs/agent-config.md` — the human wiring document for this file set: layout, budgets, how to add or change a rule or skill, and how to verify loading.

Deciding docs: `docs/README.md` (index), `docs/room-shell-contract.md`, `docs/multigame-platform-design.md` §25 (new-game checklist), `docs/realtime-link-redesign.md` (current-system sections only; its opening tables describe the pre-redesign system), `docs/DEPLOYMENT.md`, `e2e/helpers/README.md`.
