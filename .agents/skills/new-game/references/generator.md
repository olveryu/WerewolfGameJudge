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

## Shared edits: 15

`SHARED_EDITS` in `generate.mjs` (line 137) has 15 entries, in this
order:

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
12. `src/games/catalog.ts`
13. `src/test-utils/clientGameCatalog.tsx`
14. `src/__tests__/botDispatchDiscipline.contract.test.ts`
15. `src/__tests__/roomGuidanceMatrix.contract.test.ts`

Edits are computed in memory first and only then written; a missing
anchor or ambiguous anchor aborts before the first write
(`generate.mjs` orchestration header; `edits.mjs` `fail()`). A run
refuses to overwrite any existing target (`generate.mjs`,
`Refusing to overwrite existing file`). After writing: a prettier pass
over created + edited files + the report, an `eslint --fix` pass over
created files, and a second prettier pass over created files
(`generate.mjs`, `formatGeneratedFiles` / `autofixGeneratedImports`).

## Template tree: 39 files

`scripts/lib/new-game/templates/` holds 39 `.tmpl` files: 19 under
`shared/` and 20 under `game/` (`collectTemplateFiles('shared')` /
`collectTemplateFiles('game', capabilities)` in `generate.mjs`). Four
files are capability-gated (`FILE_CAPABILITY_GATES` in `generate.mjs`,
line 126):

| Template file                                                | Gate                 |
| ------------------------------------------------------------ | -------------------- |
| `.../__tests__/phaseDeadlineProtocol.contract.test.ts`       | `stageDeadline`      |
| `.../__tests__/identityViewingProtocol.contract.test.ts`     | `identityViewing`    |
| `src/games/<game>/components/<Game>RoleCardAdapter.ts`       | `identityViewing`    |
| `src/games/<game>/room/hooks/use<Game>AudioOrchestration.ts` | `audioOrchestration` |

## Per-preset output counts

Templates rendered + 1 registration migration (the integration report
is an extra file in all cases, not counted here):

| Preset        | Excluded templates                                       | Files (templates + migration) |
| ------------- | -------------------------------------------------------- | ----------------------------- |
| `identity`    | phase-deadline test, audio hook (2)                      | 37 + 1 = **38**               |
| `stage`       | identity-viewing test, role-card adapter, audio hook (3) | 36 + 1 = **37**               |
| `demo-hybrid` | audio hook (1)                                           | 38 + 1 = **39**               |

All three presets keep `audioOrchestration` off, so the audio hook is
never rendered by the generator.

## Demo provenance

The shipped `demo` game was hand-built; the `demo-hybrid` pack is the
union demo was hand-built to (`generate.mjs` header comment). Demo is
a reference for the skeleton's shape, not generator output. Demo
contains files no template produces (`fullChain.test.ts`,
`roomCommands.contract.test.ts`, `effects.test.ts`,
`demoGuidanceMatrix.test.ts`, `demoConfigScreen.contract.test.tsx`)
and the demo-hybrid capability row mirrors demo's verified
declaration (`demo/engine.ts`, `capabilities`).
