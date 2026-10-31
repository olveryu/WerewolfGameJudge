# Registration checklist — 15 items

A new game is registered only when all 15 items hold. Items marked
`[G]` are edited mechanically by the generator's `SHARED_EDITS`;
`[C]` items are pinned by a contract test; `[M]` is manual or
conditional. Every deciding file below was checked to exist at
drafting time. There is no lockfile step for a game that adds no
dependency: the generator performs none.

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
   codec, schemas, effects, `migratePersistedState`, and HTTP routes.
   Pinned by `packages/api-worker/src/games/__tests__/catalog.test.ts`
   (one module per `GAME_TYPES` entry, same order; routes equal the
   registry's `httpRoutes`).
7. `[M][C]` If the game declares a workflow: re-export it from
   `packages/api-worker/src/index.ts` AND declare the `[[workflows]]`
   binding in `packages/api-worker/wrangler.toml`. The re-export is
   contract-pinned; no contract test for the binding was located.
8. `[G]` Client plugin in `CLIENT_GAME_PLUGIN_CATALOG`
   (`src/games/catalog.ts`): navigation + `createModule`.
9. `[C]` Client entry module at the registry's `clientModulePath`
   (`src/games/<id>/module.ts`) plus its navigation module. The client
   catalog is the only place that may compose multiple concrete games.
10. `[G]` Flat reward amounts in `GAME_COMPLETION_REWARDS`
    (`packages/game-engine/src/product/rewards/earnings.ts`), or a
    `levelRoll` settlement entry point in the registry entry instead.
11. `[G]` D1 registration migration in `packages/api-worker/migrations/`
    (next `NNNN_<id>.sql`): derived from the latest registration
    migration, rebuilding every `game_type`-constrained table with
    the extended CHECK list. Game-owned tables are a marked manual
    TODO in the generated file.
12. `[C]` `httpRoutes` declared in the registry entry and implemented
    in the worker module; an empty list is valid.
13. The game itself: engine object with `stateVersion` /
    `capabilities`, `public.ts` as the only cross-package entrypoint,
    `state/{version,parseState,normalize,codec}.ts` with a
    `migratePersisted*State` wired into the worker module, worker
    schemas/effects, and the client room screen + room state modules.
    Cross-package imports of a game must use
    `@game-judge/game-engine/games/<id>/public` only.
14. `[C]` Per-game capability/contract surface: engine skeleton,
    capabilities declaration, phase-deadline variants, bot-dispatch
    discipline, room-guidance matrix registration (see
    `references/skeleton-and-wiring.md`).
15. `[G]` Test fixture catalog entry in
    `src/test-utils/clientGameCatalog.tsx`.

Never hand-edit an expectation list to "align" it. If a contract test
fails naming the new game, the wiring is missing; fix the wiring.
