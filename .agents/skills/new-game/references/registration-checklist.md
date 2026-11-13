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
   codec, schemas, effects, `migratePersistedState`, and HTTP routes.
   Pinned by `packages/api-worker/src/games/__tests__/catalog.test.ts`
   (one module per `GAME_TYPES` entry, same order; routes equal the
   registry's `httpRoutes`).
7. `[M][C]` If the game declares a workflow: re-export it from
   `packages/api-worker/src/index.ts` AND declare the `[[workflows]]`
   binding in `packages/api-worker/wrangler.toml`. The re-export is
   contract-pinned; no contract test for the binding was located.
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
11. `[G]` D1 registration migration in `packages/api-worker/migrations/`
    (next `NNNN_<id>.sql`): derived from the latest registration
    migration, rebuilding every `game_type`-constrained table with
    the extended CHECK list. Number after the latest physical migration,
    independently of registration-source discovery. The default owned
    `<id>_user_stats` cumulative table is generated; gameplay fields and
    current rebuild/schema/index/trigger/copy-cost review remain manual.
12. `[C]` `httpRoutes` declared in the registry entry and implemented
    in the worker module; an empty list is valid.
13. The game itself: engine object with `stateVersion` /
    `capabilities`, `public.ts` as the only cross-package entrypoint,
    `state/{version,parseState,normalize,codec}.ts` with a
    `migratePersisted*State` wired into the worker module, worker
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
    approved metric before production. Demo remains the explicit
    non-production/no-business-stat reference exception.

If a contract test fails naming the new game, the wiring is missing;
fix the wiring, not the expectation list
(`engineSkeleton.contract.test.ts`; `capabilities.contract.test.ts`).
