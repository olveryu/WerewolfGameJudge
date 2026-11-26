# AGENTS.md

Global rules for this repository. Area rules live in the nested files listed at the end; read the nested file for the area being changed. When this file and the code disagree, the code and its contract tests decide; fix this file.

## Change isolation

For every change request in this repository, use a separate Git worktree visible in the session's VS Code workspace and Changes view. Reuse it for that request's follow-ups; leave other chats and worktrees unchanged.

Read instructions and skills from that request's current worktree. If a skill loader returns a file from another checkout, read the current worktree's file before following it; an old checkout is not evidence that main's guidance is outdated.

## Werewolf product scope

Werewolf automates only the first night, dawn, and sheriff election. Later nights and subsequent daytime play are handled by the in-person host; this is not a full-game werewolf moderator.

Role cards and the encyclopedia may describe complete rules, including second-night abilities and whole-game limits. Those descriptions are not requests to implement later-night actions, round counters, persistent multi-night resources, or full-game settlement. A role whose active ability starts on the second night has no first-night action; do not invent a placeholder action.

Adding or changing a werewolf role or board stays within this scope by default. Do not ask again whether to support multiple nights merely because supplied rules mention them. Discuss a scope expansion only when the user explicitly requests one; clarify actual first-night rule interactions instead. This boundary is specific to werewolf, not the other games.

## Design interviews

During each grill-me interview, record the user's confirmed decisions in the relevant design document as they are made; update an existing document or create one if none fits. Before implementation, consolidate the conclusions and distinguish confirmed decisions, open questions, and implementation status; never present a proposal as the user's decision.

## Learnings

The client is a web page, including in the mini-program web-view. Unless the user explicitly requests compatibility, do not retain obsolete client commands, game-state versions, or migration paths solely for older application versions. Users can refresh after deployment; current game-state codecs reject invalid persisted state.

Base changes on verified behavior and current ecosystem guidance, not speculation or defensive patches. Preserve architectural boundaries, fail fast on broken invariants, and report actionable failures through the owning logger and error pipeline.

## Project snapshot

A multi-game judge app for in-person play: a React web client that runs in browsers and inside the WeChat mini-program web-view, backed by a Cloudflare Worker with Durable Objects, D1, and R2. It includes collection and progression product modules.

The client was rewritten per `docs/web-client-rewrite.md`; every game has a statically imported factory in `CLIENT_GAME_FACTORIES` (`packages/web/src/games/clientModules.tsx`), with sessions initialized on demand.

Versions: React `^19.3.1`, Vite `^8.3.8`, React Router `^8.5.1` (web package); TypeScript `~6.0.3` (root and web package); Vitest `~4.1.10` and Zod `^4.4.3` (root and every package); ESLint `^9.39.4`, Turbo `^2.11.7` (root); Node `>=22.13.0` (`.nvmrc` pins `22.22.1`), pnpm `10.32.1`.

TypeScript strictness is per config: the root and web configs set `strict` and `noUncheckedIndexedAccess`; the game-engine build config and the worker config set `strict` only.

Layout: a pnpm workspace with four parts — the root (cross-package contracts in `contracts/`, Pages functions in `functions/`, E2E in `e2e/`, tooling in `scripts/`), `packages/web` (the client), `packages/game-engine` (pure game logic; its only runtime dependency is Zod), and `packages/api-worker` (the Worker, Durable Object, and D1 access).

Games (11): werewolf, fibking, pictionary, undercover, storyrelay, drawguess, avalon, spotmatch, secrethitler, decrypto, toolbox (a seatless party toolbox with no completions, rewards, or stats).

The application release version is authoritative in the root `package.json`; `packages/web/src/config/version.ts` imports it, and the release script generates the `CHANGELOG.md` entry from it. Game state has no version field or read-time migration: parsers validate the current shape and identity, and invalid persisted state fails fast.

## Commands

| Task              | Exact command                                                            | Scope                                                                  |
| ----------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Root tests        | `pnpm run test` (Vitest contracts and generator tests)                   | Local, scoped by path filter                                           |
| Web tests         | `pnpm --filter @game-judge/web run test`                                 | Local, scoped by path filter                                           |
| All tests         | `pnpm run test:all`                                                      | Full run; CI only                                                      |
| Engine build      | `pnpm --filter @game-judge/game-engine run build`                        | As needed; CI builds it first                                          |
| Web build         | `pnpm --filter @game-judge/web run build`                                | Vite build plus per-route gzip budgets                                 |
| Root typecheck    | `pnpm run typecheck`                                                     | Pages types, `contracts/`, `functions/`, `e2e/`                        |
| Web typecheck     | `pnpm --filter @game-judge/web run typecheck`                            | Local, scoped where possible                                           |
| Worker typecheck  | `pnpm --filter @game-judge/api-worker run typecheck`                     | Local, scoped where possible                                           |
| Lint              | `pnpm exec eslint <changed files>`                                       | Local, changed files only; full run in CI                              |
| Format check      | `pnpm exec prettier --check <changed files>`                             | Local, changed files only; full run in CI                              |
| Unused code       | `pnpm run knip`                                                          | Local                                                                  |
| CSS lint, ratchet | `pnpm run lint:css` then `pnpm run lint:ui-baseline`                     | Local and CI; `pnpm run lint:css:baseline` shrinks the CSS record      |
| Agent files check | `pnpm run validate:agents`                                               | Local and CI                                                           |
| Full gate         | `pnpm run quality`                                                       | Full run; CI only                                                      |
| E2E               | `pnpm run e2e`                                                           | Full run; CI only                                                      |
| Single E2E spec   | `gh workflow run e2e-single-spec.yml --ref <branch> --field spec=<file>` | One spec at a time; verify the run with `gh api` (see `e2e/AGENTS.md`) |
| Local dev         | `pnpm run dev`                                                           | Worker plus Vite; Worker uses 127.0.0.1:8787 or an available port      |
| Local migrations  | `pnpm --filter @game-judge/api-worker run db:migrate:local`              | Before first local run or after a new migration                        |
| Local D1 seed     | `pnpm --filter @game-judge/api-worker run db:seed:local`                 | After local migrations; seeds the local development account            |
| New game          | `pnpm new-game <gameId>`                                                 | Generator; see the new-game skill                                      |
| Release           | `bash scripts/release.sh [patch\|minor\|major]`                          | Release script                                                         |

`pnpm run dev` applies local migrations and seeds missing data before starting either server; initialization failures terminate startup. The local D1 seed creates `dev@test.local` with password `dev123` (level 99, all reward items unlocked), preserving existing accounts, progress and word edits on reruns, including recovery after interruption. It explicitly uses Wrangler `--local` in this worktree's Worker directory; run it only against the local database, never production.

The dev launcher skips occupied Worker/Vite/inspector ports, sets Vite's API URL to the selected Worker, and stops both servers when either exits. It preserves configured `JWT_SECRET` values and persists a missing local auth key in the Worker's gitignored `.env.local` (or an existing `.dev.vars`); never commit these files or print the key.

`pnpm run quality` runs `turbo run build typecheck lint knip format test && pnpm run validate:agents && pnpm run lint:css && pnpm run lint:ui-baseline`. In CI the same work is split: one job runs Turbo build/typecheck/knip plus the agent-files check, lint/format/Stylelint/the UI baseline ratchet run as a parallel job, root-contract, engine, web, and worker tests run sharded, and `ci-gate` requires all of them plus E2E. E2E is not part of `quality`; it serves the `packages/web/dist` build from the `build-web` job, and the `e2e` matrix in `.github/workflows/ci.yml` runs every spec exactly once, pinned by `runs every E2E spec exactly once` in `contracts/ciE2eCoverage.contract.test.ts`. Locally, run the scoped form of the failing area (path-filtered tests, the changed package's typecheck) plus `tsc --noEmit` and `knip`; do not present a local full `quality` run as the gate.

## Architecture boundaries

The engine decides state transitions, rule decisions, and settlement in `packages/game-engine`; the Durable Object applies them atomically and broadcasts snapshots for the client to render.

Layers: `platform/` holds shared protocol, realtime, room, and audio chassis code; `games/` holds one directory per game; `product/` holds growth, rewards, and word-supply modules. One game never imports another, and cross-package game code is reached only through that game's `public` entrypoint, pinned by the game-module dependency boundary and public-entrypoint tests in `packages/game-engine/src/platform/__tests__/architecture.contract.test.ts`. The engine package has no React, Cloudflare, network, storage, or Node dependencies.

Room link and state identity: the client link lives in `packages/web/src/platform/realtime/` (`RoomLink`, pure reducer plus runtime). Commands go over HTTP `POST /room/command` and are correlated by `commandId`; state arrives over the WebSocket as snapshots. A snapshot is `RoomSnapshot { gameType, revision, state }`, decoded by the game's `GameStateCodec`. The wire protocol is v2: the client sends `SYNC` only; the server sends `SYNC_RESULT`, `STATE_UPDATE`, or `INBOX_HINT` (online/offline presence was removed 2026-11-07: no `PRESENCE` frame is sent or rendered). Terminal close codes are 1002 and 4000–4003; 4004 is rate-limited and retries. Reconnection is unbounded and driven by the pure reducer.

Settlement uses one arm decision (`decideSettleCountdownArm`, `SETTLE_COUNTDOWN_MS = 5000`) with no manual finish, pinned by `settleCountdown.contract.test.ts` (`packages/game-engine/src/platform/room/settleCountdown.ts`).

Persistence: D1 is the relational store and Drizzle is the typed layer over it, with a schema-free driver and hand-written SQL migrations; D1 tables are declared once in owner `dbSchema.ts` modules (43, pinned by `declares every physical D1 table exactly once in its owner module` in `contracts/architecture.contract.test.ts`), and tables reached only through raw SQL have no such declaration. Room authority state lives in the Durable Object's own SQLite storage, with no migration chain or schema-version table: a stored table name or column mismatch discards the room. R2 provides the `AVATARS` and `GAME_MEDIA` buckets; D1, Durable Object, rate-limit, workflow, cron, and analytics bindings are declared in the worker `wrangler.toml`.

A new game is registered in the engine registry, the engine catalog, the worker catalog, the web client catalog, and the static web factories, with a D1 registration migration and contract-test whitelists updated. The generator also wires completed-games statistics end to end; approved gameplay metrics and reward/stat semantics remain go-live requirements. See the new-game skill.

## Enforced conventions

- Generator tests use Vitest as their only test runner; `scripts/new-game.test.mjs` is included in `vitest.config.ts`. Do not add a `node:test` runner or a Vitest wrapper that spawns one.
- Add tests only for new or changed behavior, bug fixes, concrete edge cases, or explicitly required contracts. Avoid tests that merely mirror implementation, guard against speculative future changes, or duplicate lint/typecheck/build checks; preserve tests that cover distinct behavior or required architecture/business contracts.
- `react/no-danger` is an error for `packages/web/**` in `eslint.config.mjs`: untrusted strings render only through React's escaping.
- `console.*` is a `no-console` error in `eslint.config.mjs`, exempt only in the web logger `packages/web/src/utils/logger.ts`, `e2e/helpers/diagnostics.ts`, and the worker logger `packages/api-worker/src/platform/observability/logger.ts`.
- In the worker, permissive `z.object` appears only in the 8 files listed by `uses permissive Zod objects only for external provider payloads` in `contracts/architecture.contract.test.ts`, all external provider payloads; internal data uses `z.strictObject`.
- Production code in the web client, engine, and worker allows only `as const` assertions, pinned by `Production types: no ordinary assertions` in `contracts/architecture.contract.test.ts` and `game-engine production type honesty` in `packages/game-engine/src/platform/__tests__/architecture.contract.test.ts`.
- Web style values are CSS custom properties from `packages/web/src/theme/tokens.css` and `packages/web/src/theme/colors.ts`, policed by Stylelint (`stylelint.config.mjs`, local rules in `scripts/ui-lint/`; `pnpm run lint:css`). Existing violations are recorded in `stylelint-suppressions.json`, which `scripts/ui-baseline-ratchet.mjs` (`pnpm run lint:ui-baseline`) keeps exact and shrink-only; the art layer exemption is registered only in `scripts/ui-lint/registry/artLayer.mjs`.
- Renamed identifiers (`roomCode`, `seat`, `hostUserId`, `isPityTriggered`, `userId`) are enforced by `no-restricted-syntax` in `eslint.config.mjs`, and commit headers are capped at 100 characters by `commitlint.config.js`.

## Output rule

Summarize results in text; for failures, give excerpts, counts, and `file:line` references only, write the full log to a file on disk, print that file's path, and read only the failure section. Judge pass or fail from the command's own exit status or the CI conclusion field, never from a piped command's exit code.

## Pointers

Nested files: `packages/web/AGENTS.md`, `packages/game-engine/AGENTS.md`, `packages/api-worker/AGENTS.md`, `e2e/AGENTS.md`.

Skills: `.agents/skills/<name>/SKILL.md` — read the skill before starting its workflow; skills never replace the nested area files.

For a dedicated read-only audit of a werewolf role/board change, use `.agents/skills/review-werewolf-addition/SKILL.md`.

Wiring: `docs/agent-config.md` — the human wiring document for this file set: layout, budgets, how to add or change a rule or skill, and how to verify loading.

Deciding docs: `docs/README.md` (index), `docs/web-client-rewrite.md` (client rewrite plan and phases), `docs/room-shell-contract.md`, `docs/multigame-platform-design.md` §25 (new-game checklist), `docs/realtime-link-redesign.md` (current-system sections only; its opening tables describe the pre-redesign system), `docs/DEPLOYMENT.md`, `e2e/helpers/README.md`.
