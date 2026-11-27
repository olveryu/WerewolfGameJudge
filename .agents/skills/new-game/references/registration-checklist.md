# Registration checklist

A new game is registered only when all items hold. Items marked
`[G]` are edited mechanically by the generator's `SHARED_EDITS`;
`[C]` items are pinned by a contract test; `[M]` is manual or
conditional. There is no lockfile step for a game that adds no
dependency: `SHARED_EDITS` performs none.

1. `[G][C]` Game id in `GAME_TYPES`
   (`packages/game-engine/src/platform/protocol/gameTypes.ts`).
2. `[G][C]` `GAME_REGISTRY` entry
   (`packages/game-engine/src/games/registry.ts`): `gameType`,
   `enginePublicExport`, `clientModulePath`, `isProduction`, `rewards`
   (`flat` amounts or a `levelRoll` settlement entry point),
   `workerWorkflows`, `httpRoutes`.
3. `[G][C]` Engine entry in `GAME_ENGINE_CATALOG`
   (`packages/game-engine/src/games/catalog.ts`).
4. `[G][C]` `./games/<id>/public` in `exports`
   (`packages/game-engine/package.json`), pinned by
   `EXPECTED_PACKAGE_EXPORTS` in the engine architecture contract test.
5. `[G][C]` Contract-test whitelists that enumerate games, edited by
   the generator: engine architecture, engine skeleton,
   phase-deadline variants, capabilities, engine contracts,
   bot-dispatch discipline, room-guidance matrix. Read each file's
   expectations; several derive from `GAME_TYPES` / `GAME_REGISTRY`
   and fail naming the game when wiring is missing.
6. `[G][C]` Worker module in `WORKER_GAME_CATALOG`
   (`packages/api-worker/src/games/catalog.ts`) with
   `packages/api-worker/src/games/<id>/module.ts` binding engine,
   codec, schemas, effects, and HTTP routes.
   Pinned by `packages/api-worker/src/games/__tests__/catalog.test.ts`
   (one module per `GAME_TYPES` entry, same order; routes equal the
   registry's `httpRoutes`).
7. `[M][C]` If the game declares a workflow: record its
   `workflowName`, `binding`, `exportName` and `modulePath` in the
   registry; re-export it from `packages/api-worker/src/index.ts`;
   declare the matching `[[workflows]]` block in
   `packages/api-worker/wrangler.toml`; then regenerate
   `worker-configuration.d.ts`. The architecture contract welds all
   four registry facts to the deployment block and generated binding type.
   If the game has a word library (`wordSupply` other than `none`),
   the generator writes, from the one `--word-category` list, the engine
   `wordCategories.ts` (`defineWordCategoryCatalog`), its `public.ts`
   export, and the registration migration's `word_games` row plus one
   `word_categories` row per category (item 11). Joining the shared supply
   contract is manual and lands with its adapters in one change: the id in
   `GAME_WORD_GAMES` (`packages/game-engine/src/product/wordSupply/games.ts`),
   the catalog in `WORD_CATEGORY_CATALOGS` of
   `packages/game-engine/src/games/wordCategoryCatalogs.ts` (read by the
   Worker, the admin mock and `contracts/d1Catalog.contract.test.ts`), then
   every map keyed by `GameWordGame` that typecheck names (Env supply flag,
   submission adapter, publication/editorial/provider, word deal, admin
   dashboard tables). The generator leaves those two lists untouched so
   its output typechecks without the adapters; the D1 catalog contract
   names the game until they land. The generator writes no `word_draw_index` /
   `word_draw_ordinals` rows: they belong only to pools on the shared
   draw path and ship with the word-table migration that adds the
   `draw_ordinal` column and its triggers. Pinned by
   `word_games rows equal GAME_WORD_GAMES` and
   `word_categories rows equal each engine category catalog` in
   `contracts/d1Catalog.contract.test.ts`. A category appended at the end
   of a catalog is a catalog edit plus one INSERT migration (its
   `sort_order` is the next index); inserting one mid-list also shifts
   every later `sort_order` under `UNIQUE (game, sort_order)`, so that
   migration renumbers them first; changing a display name is
   one `UPDATE` of `name`, while changing an `id` is rejected by the
   child tables' foreign keys and needs a hand-written migration.
8. `[G]` Home entry in `CLIENT_GAMES`
   (`packages/web/src/games/catalog.ts`): `{ home: <game>Home,
AccountStats: <Game>StatsPanel }` from the game's home and panel.
9. `[C]` Client entry module at the registry's `clientModulePath`
   (`packages/web/src/games/<id>/module.ts`, built with
   `defineClientGameModule`) plus its navigation module. The module
   exists exactly when the game is ported; factories are statically
   imported and sessions initialized on demand. Only
   `packages/web/src/games/catalog.ts` and
   `packages/web/src/games/clientModules.tsx` compose multiple concrete
   client games (same test, 'composes multiple concrete client games
   only in the two exhaustive catalogs').
10. `[G]` Flat reward amounts in `GAME_COMPLETION_REWARDS`
    (`packages/game-engine/src/product/rewards/earnings.ts`), or a
    `levelRoll` settlement entry point in the registry entry instead.
11. `[G][C]` D1 registration migration in `packages/api-worker/migrations/`
    (next `NNNN_<id>.sql`, numbered after the latest physical migration):
    generated only after the generator replays the current migrations in
    `node:sqlite` and checks the resulting schema; it refuses (pinned by
    `refuses a game id that the current schema already registers in
game_types`, `refuses to generate when the current schema hard-codes a
game list that would need a rebuild` and `refuses when a lookup table
is missing from the replayed schema` in `scripts/new-game.test.mjs`)
    when an inserts-only registration would be wrong, and the migration is
    then hand-written. Otherwise it is
    one `INSERT INTO game_types` row appended in `sort_order` (plus
    `word_games`/`word_categories` rows for a word library), so
    `game_types` stays equal to `GAME_TYPES` row by row (pinned by
    `game_types rows equal GAME_TYPES in order` in
    `contracts/d1Catalog.contract.test.ts`). No table is rebuilt. The
    default owned `<id>_user_stats` cumulative table is generated;
    gameplay fields remain manual. The generator also records the new
    file's sha256 in `contracts/d1MigrationManifest.json` (pinned by
    `migration files match the recorded sha256 manifest` in
    `contracts/d1MigrationRules.contract.test.ts`); any later hand edit
    to the migration must update that entry before it is first applied.
    The output is a starting point, not a template: review it against the
    current schema and this game's requirements before committing, and
    never copy it or an earlier migration mechanically. Migration rules
    live in `packages/api-worker/AGENTS.md`.
12. `[C]` `httpRoutes` declared in the registry entry and implemented
    in the worker module; an empty list is valid.
13. The game itself: engine object with `gameType` /
    `capabilities`, `public.ts` as the only cross-package entrypoint,
    `state/{parseState,normalize,codec}.ts` with strict parsing of the
    current state shape, worker
    schemas/effects, the client room screen + room state modules, and
    the review contribution declared as the client module's required
    `review` (`packages/web/src/games/<id>/review/`).
    Cross-package imports of a game must use
    `@game-judge/game-engine/games/<id>/public` only.
14. `[C]` Per-game capability/contract surface: engine skeleton,
    capabilities declaration, phase-deadline variants, bot-dispatch
    discipline, room-guidance matrix registration, review contract
    registration (the game's `<GAME>_REVIEW_ROUNDS` from
    `packages/web/src/test-utils/<id>State.ts` in
    `packages/web/src/__tests__/roomReview.contract.test.ts`; see
    `references/skeleton-and-wiring.md`).
15. `[G]` Static client factory in `CLIENT_GAME_FACTORIES` plus its module
    slot (`packages/web/src/games/clientModules.tsx`). The factory map
    is what marks a game ported for the per-game web contracts
    (`PORTED_GAME_TYPES` in `contracts/architecture.contract.test.ts`
    and `packages/web/src/test-utils/portedGames.ts`).
16. `[G][C]` Strict public statistics DTO/parser and v2 completion facts
    in engine `publicStats.ts` exported through `public.ts`; Worker
    `parsePublicUserStats` / `getPublicUserStats` module hooks; owned
    `dbSchema.ts` and atomic account `countGameStats` adapter. Legacy
    payloads keep rewards only, malformed partial v2 is rejected.
17. `[G][C]` `AccountStats` in `CLIENT_GAMES` uses the shared compact
    panel and `publicGameStatsOptions`. Settings resolve the catalog;
    the room hook/adapter/screen connect that same panel explicitly.
    Count callbacks preserve unknown loading/error states without
    changing existing item-unlock/equipment permissions.
18. `[M]` Approved stats/reward semantics and implemented metrics:
    completed games is the baseline, not inferred wins/scores. Decide
    unit, facts/ownership, denominators/time precision, frozen roster and
    author filtering, history/migration/delay/cache policy; verify every
    approved metric before production. The removed Demo game is not a
    reference implementation or an exception to these requirements.
19. `[G]` Generated design doc in the sole `docs/README.md` game index.
20. `[G][C]` Explicit `--production` updates both `isProduction` and the Home
    contract list in canonical order. Without it, the generated game stays
    hidden and the CLI/report say so; visibility still requires user approval.
21. `[G]` Real-game preview `packages/web/preview/<camel>Preview.tsx`
    registered in `previewGames` (`packages/web/preview/previewGames.ts`):
    the real config, rules and room screens over `createPreviewRoomLink`
    with lobby, playing and ended scenarios from `test-utils/<id>State.ts`.
    Add a scenario per reviewed phase as gameplay lands.

If a contract test fails naming the new game, the wiring is missing;
fix the wiring, not the expectation list
(`engineSkeleton.contract.test.ts`; `capabilities.contract.test.ts`).
