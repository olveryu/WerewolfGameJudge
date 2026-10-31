# API worker package

Scope: `packages/api-worker/**` only. Engine rules live in `packages/game-engine/AGENTS.md`; client rules in `src/AGENTS.md`; shared workflow, commands, and gates in the root file.

## Identity and entrypoint

- Hono app (`packages/api-worker/src/index.ts`). Each handler file exports a route group; the entrypoint composes them, applies CORS and error handling centrally, and re-exports the room Durable Object class and the declared workflow classes.
- Route groups stay with their owner under `features/*`, `games/*`, or `platform/*`. There is no shared root schema directory.
- TypeScript `~6.0.3`, Zod `^4.4.3`, Vitest `~4.1.10`, Wrangler `^4.147.0` (see `package.json`). The worker config is standalone: `strict: true`, `noEmit: true`, no `noUncheckedIndexedAccess`.

## Runtime bindings (`wrangler.toml`)

- D1 database `DB` (`werewolf-db`); Durable Object bindings `GAME_ROOM` (`GameRoom`) and `WECHAT_AUTH` (`WeChatAuthProxy`); R2 buckets `AVATARS` (`werewolf-avatars`) and `GAME_MEDIA` (`werewolf-game-media`).
- Rate limits `ROOM_LOOKUP_LIMITER` and `ANONYMOUS_SIGNUP_LIMITER`; Analytics Engine datasets `LOAD_TIMING`, `AI_USAGE`, `REQUEST_TRAFFIC`; three workflow bindings (`fib-word-supply`, `undercover-word-supply`, `drawguess-word-supply`); cron triggers every 5 minutes, at 03:00, and at 04:00 (saga reconciliation, expiry/cleanup, editorial dispatch).
- `compatibility_date` is `2026-10-01`. Do not confuse this file with the separate Pages config at the repo root.

## Room authority: Durable Object and its SQLite storage

- Composition root: `packages/api-worker/src/app/GameRoom.ts` resolves game modules and is exported as the `GameRoom` Durable Object class. `GameRoomRuntime` owns the state store, effect outbox, command pipeline, and gateway.
- Room authority state lives in the Durable Object's own SQLite storage, accessed via the storage SQL API, never via Drizzle. Schema version is 3 (`ROOM_STORAGE_SCHEMA_VERSION`); tables are `room_schema`, `room_state`, `command_receipts`, `effect_outbox`, `effect_replays`.
- There is no storage migration chain. On any stored version other than the current one, storage is discarded and recreated (rooms are short-lived sessions). Game-state version evolution inside `room_state.game_state` is the game module's own concern. The D1 `rooms` table is only the room directory (metadata and saga state), not authoritative game state.

## Effect outbox, recovery, and read-time migration

- Effects are inserted in the same transaction as the committed command. The single Durable Object alarm drains due effects and sweeps presence. Dedupe is on `(scope, game_type, effect_type, business_key)`. Retry policy: at most 7 attempts, 2-second base doubling to a 5-minute cap, 2-minute delivery watchdog. Failed effects can be replayed through the admin recovery surface (`features/admin/effectRecovery.ts`).
- `RoomStateStore.read()` compares the stored `state_version` with the module's current version. Equal: parse directly. Older with a migrate function: migrate in place, rewriting the state row and every command-receipt row in one transaction. Newer, or no migrate function: throw `Unsupported <game> state version`. The per-version upgrade functions live in the engine (see the engine file's version table); the worker owns only the read-time wiring.

## D1 and Drizzle

- D1 is the relational store; Drizzle is the typed query layer over it (`createDb` returns `drizzle(d1)`, schema-free). There is no Drizzle Kit, no Drizzle config, and no generated schema directory.
- Migrations are hand-written SQL files applied by Wrangler: 64 files, `0001_init.sql` through `0065_demo.sql`, with no `0002` file.
- 33 tables are declared exactly once via `sqliteTable` in owner `dbSchema.ts` modules, pinned by a client contract test. Further tables exist only as raw SQL in migrations; check the migrations before claiming the full physical set.
- Registration migrations extend every `game_type` CHECK list by rebuilding the constrained tables (table-copy pattern). A new game-owned table needs an owner `dbSchema.ts` or an explicit reason for staying raw-SQL-only.

## Worker game catalog and modules

- `WORKER_GAME_CATALOG` is exhaustive: exactly one worker module per entry in `GAME_TYPES`, in the same order (pinned by `catalog.test.ts`). Each module binds the engine, state codec, public/internal command schemas, effect schema, migrate function, and HTTP routes.
- HTTP routes are projected from the same catalog; duplicate paths fail fast. A game declaring a workflow must also re-export it from the entrypoint and declare the workflow binding in `wrangler.toml`.

## HTTP patterns

- Validate JSON bodies with `jsonBody(schema)` (`platform/http/`). It returns HTTP 400 with `{ success: false, reason: 'VALIDATION_ERROR', detail }`. Do not read and cast request JSON by hand.
- `callDurableObject` translates Durable Object errors into HTTP errors (503 retryable, 429 overloaded). Central error handling in the entrypoint catches HTTP errors, syntax errors, and generic errors; handlers do not need their own translation for these.
- `requireAuth` authenticates the current principal and sets `c.var.userId` and `c.var.isAnonymous`. Zod 4 is the schema library (`z.email()` and friends); seat schemas use the established `z.coerce.number().int().min(0)` shape for werewolf seats.
- The realtime gateway upgrades WebSocket connections to the room Durable Object stub and runs the v2 `SYNC`/`SYNC_RESULT` exchange (see the engine file for the wire protocol).

## Scripts, migrations, and gates

- Verified scripts in this package: `dev`, `dev:test`, `deploy`, `db:migrate:local`, `db:migrate:remote`, `db:seed:local`, `types`, `types:check`, `typecheck`, `test`. Migrations run before deploy in CI (see `.github/workflows/ci.yml` for the verified job order). This package has no `lint`, `format`, `knip`, or `build` script; those gates apply through the root configs and root tasks. Do not invent a package-local gate command. `typecheck` runs the Wrangler types check first, then the main config, then the test config.
- Number the next migration after the latest file; never renumber or rewrite an applied migration. A registration migration must extend every `game_type`-constrained table, including foreign-key dependents, using the table-copy pattern of the previous registration migration. Local: `db:migrate:local`. Remote: `db:migrate:remote`. Both use the `werewolf-db` database and the package's Wrangler config.

## Secrets and logging

- `wrangler.toml` `[secrets] required` lists 11 names (count verified; read the list from that file at the time of use). CI additionally references 5 further names. Never write a secret value into code, docs, or this file. Any secrets inventory must be regenerated from `wrangler.toml` plus the workflow files at the time of writing; do not copy an old table.
- `console.*` is an error in this package, with one exception: the worker logger at `platform/observability/logger.ts` is the only module allowed to call it directly. Its `error()` also reports to the error-reporting service. Use that logger; do not add a second logging path. For client logging rules, see `src/AGENTS.md`.

## Tests for this package

- Runner: Vitest under the Workers pool. The config loads D1 migrations via `readD1Migrations` and applies them in `test/applyMigrations.ts`; it includes `src/**/__tests__/**/*.test.ts`.
- The catalog test pins one module per game type and the HTTP-route projection. The worker entrypoint's workflow re-exports are pinned by a client contract test against the registry's declared workflows.
