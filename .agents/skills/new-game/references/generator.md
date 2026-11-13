# Generator — counts regenerated from code

Generator: `scripts/new-game.mjs` (command `pnpm new-game`) with
implementation in `scripts/lib/new-game/` (`generate.mjs`, `edits.mjs`,
`migration.mjs`, `render.mjs`, `report.mjs`).

## Command

```
pnpm new-game <gameId> --preset identity|stage|demo-hybrid [--production]
  [--name <text>] [--subtitle <text>] [--icon <ionicon-name>]
  [--tier main|mini] [--xp <n>] [--draws <n>] [--daily-target <n>]
```

Defaults: display name = game id, tier `mini`, rewards 5 XP / 1 draw /
daily target 5 (`DEFAULT_REWARDS` in `generate.mjs`). The game id must
match `/^[a-z][a-z0-9]*$/` (`render.mjs`, `assertValidGameId`); class
names derive from it.

## Shared edits

`SHARED_EDITS` is exported from `generate.mjs`; `generatorFacts()` and
the skill's check script derive this list and all template/preset counts.
The current list has 17 entries:

1. `packages/game-engine/src/platform/protocol/gameTypes.ts`
2. `packages/game-engine/src/games/registry.ts`
3. `packages/game-engine/src/product/rewards/earnings.ts`
4. `packages/game-engine/package.json`
5. `packages/game-engine/src/platform/__tests__/architecture.contract.test.ts`
6. `packages/game-engine/src/platform/__tests__/engineSkeleton.contract.test.ts`
7. `packages/game-engine/src/platform/__tests__/phaseDeadlineVariants.contract.test.ts`
8. `packages/game-engine/src/platform/engine/__tests__/capabilities.contract.test.ts`
9. `packages/game-engine/src/platform/engine/__tests__/contracts.test.ts`
10. `packages/game-engine/src/games/catalog.ts`
11. `packages/api-worker/src/games/catalog.ts`
12. `packages/web/src/games/catalog.ts` (`CLIENT_GAMES`: the game's
    Home entry from `@/games/<id>/home`)
13. `packages/web/src/games/clientModules.tsx` (a statically imported
    `CLIENT_GAME_FACTORIES` entry, which also marks the game ported for
    the per-game web contracts, plus its module slot)
14. `packages/web/src/__tests__/botDispatchDiscipline.contract.test.ts`
15. `packages/web/src/__tests__/roomGuidanceMatrix.contract.test.ts`
16. `packages/web/src/__tests__/roomReview.contract.test.ts`
17. `contracts/architecture.contract.test.ts` (owned cumulative D1 table).

Edits are computed in memory first and only then written; a missing
anchor or ambiguous anchor aborts before the first write
(`generate.mjs` orchestration header; `edits.mjs` `fail()`). A run
refuses to overwrite any existing target (`generate.mjs`,
`Refusing to overwrite existing file`). After writing: a prettier pass
over created + edited files + the report, an `eslint --fix` pass over
created files, and a second prettier pass over created files
(`generate.mjs`, `formatGeneratedFiles` / `autofixGeneratedImports`).

## Template tree

`scripts/lib/new-game/templates/` currently holds 50 `.tmpl` files:
25 under `shared/` and 25 under `game/`. Both layers use the same
`FILE_CAPABILITY_GATES` when collected. The
client templates render under
`packages/web/src/games/<game>/` (home, module, session model,
navigation, rules screen, room screen and CSS, room adapter, guidance
matrix, room-state hook, command-failure message, review) plus the
review-round fixture `packages/web/src/test-utils/<game>State.ts`,
mirroring the hand-built web Demo in `packages/web/src/games/demo/`.
Four files are game-capability-gated (`FILE_CAPABILITY_GATES`):

| Template file                                                             | Gate                 |
| ------------------------------------------------------------------------- | -------------------- |
| `.../__tests__/phaseDeadlineProtocol.contract.test.ts`                    | `stageDeadline`      |
| `.../__tests__/identityViewingProtocol.contract.test.ts`                  | `identityViewing`    |
| `packages/web/src/games/<game>/components/<Game>RoleCardAdapter.ts`       | `identityViewing`    |
| `packages/web/src/games/<game>/room/hooks/use<Game>AudioOrchestration.ts` | `audioOrchestration` |

Eight additional files use the non-capability `businessStats` assembly
switch: engine `publicStats.ts` and its contract test; Worker
`dbSchema.ts`, `publicUserStats.ts` and its D1 test; web `StatsPanel`,
its UI test and statistics query service. This switch defaults on for
every preset and cannot be disabled for a newly generated formal game.

## Per-preset output counts

Templates rendered + 1 registration migration (the integration report
is an extra file in all cases, not counted here):

| Preset        | Excluded templates                                       | Files (templates + migration) |
| ------------- | -------------------------------------------------------- | ----------------------------- |
| `identity`    | phase-deadline test, audio hook (2)                      | 48 + 1 = **49**               |
| `stage`       | identity-viewing test, role-card adapter, audio hook (3) | 47 + 1 = **48**               |
| `demo-hybrid` | audio hook (1)                                           | 49 + 1 = **50**               |

All three presets keep `audioOrchestration` off, so the audio hook is
never rendered by the generator.

## Demo provenance

The shipped `demo` game was hand-built; the `demo-hybrid` pack is the
union demo was hand-built to (`generate.mjs` header comment). Demo is
a reference for the skeleton's shape, not generator output. Demo
contains files no template produces (`fullChain.test.ts`,
`roomCommands.contract.test.ts`, `effects.test.ts`) and the
demo-hybrid capability row mirrors demo's verified declaration
(`demo/engine.ts`, `capabilities`).

Demo deliberately has no business statistics. Its regression invokes
`generateNewGame({ gameId: 'demo', preset: 'demo-hybrid',
businessStats: false, production: false, ... })` explicitly; this is
an internal reference-only option, not a CLI flag. That comparison still
checks the shared room/game skeleton byte-for-byte with pinned reference
exceptions; ordinary `demo-hybrid` games include all eight stats files.

## Migration source and numbering

The next filename comes from the highest physical migration number,
not the latest registration number. Currently 74 SQL files end at
`0075_werewolf_camp_aggregation.sql`, while the latest registration
source remains `0065_demo.sql`; the next filename is `0076_<id>.sql`.
The registration rebuild body is bounded by the source PRAGMAs so a
previous game's appended owned tables are not copied into the next game.
The generator appends the new owned `<id>_user_stats` table; it does not
create a statistics history ledger or indexes.

Review the rebuild set against current migrations/schema, including
foreign-key dependents, indexes/triggers and copy costs. Derivation is not
permission to apply a stale table body. The isolated generation contracts
exercise migration application and preserve existing data; gameplay-specific
schema changes remain approved manual work.
