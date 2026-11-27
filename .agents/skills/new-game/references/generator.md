# Generator

Generator: `scripts/new-game.mjs` (command `corepack pnpm new-game`) with
implementation in `scripts/lib/new-game/` (`generate.mjs`, `edits.mjs`,
`migration.mjs`, `render.mjs`, `report.mjs`).

## Command

```
corepack pnpm new-game <gameId> --feature <key=value> ... [--production]
  [--name <text>] [--subtitle <text>] [--icon <ionicon-name>]
  [--tier main|mini] [--xp <n>] [--draws <n>] [--daily-target <n>]
```

Declare all eight features exactly once; there are no implicit defaults:

| Feature           | Allowed values                          | Derived behavior                                                                                               |
| ----------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `identity`        | `none`, `private`                       | `private` enables identity viewing and reveal animation, plus bulk bot identity handling when bots are on.     |
| `night`           | `none`, `narrated`                      | `narrated` enables shared night steps, client interaction, narration, formal scenarios and catalogue coverage. |
| `guidedNarration` | `none`, `narrated`                      | `narrated` enables audio orchestration without implying a night phase.                                         |
| `stageDeadline`   | `none`, `enabled`                       | `enabled` adds the deadline protocol; identity-viewing games arm it when play begins.                          |
| `wordSupply`      | `none`, `in-game`, `background`, `both` | Any non-`none` mode enables `wordLibrary`; the report requires the matching manual workflow wiring.            |
| `bots`            | `enabled`, `none`                       | `enabled` wires bot seats and host takeover; `none` seats humans only.                                         |
| `stats`           | `enabled`, `none`                       | `enabled` wires completed-games statistics and the profile panel; requires `rewards=flat`.                     |
| `rewards`         | `flat`, `none`                          | `flat` wires completion settlement with flat rewards; `none` registers `{ policy: 'none' }`.                   |

Example profile:

Narrated-night output includes an explicitly incomplete example step and an
empty `nightScenarios.ts`. Its catalogue tests must fail until approved gameplay
and formal scenarios replace them. The generator registers the catalogue and
unified docs entry, not a baseline. The generator's own real-toolchain test
proves this intentional failure separately from its scaffold wiring tests;
normal game verification never excludes the catalogue.

```sh
corepack pnpm new-game <gameId> \
  --feature identity=private --feature night=narrated \
  --feature guidedNarration=none --feature stageDeadline=enabled \
  --feature wordSupply=none --feature bots=enabled \
  --feature stats=enabled --feature rewards=flat
```

Missing, repeated, unknown or invalid feature declarations fail before any
generated file is written, as does `stats=enabled` with `rewards=none`. The
base skeleton always wires `hostConfig`. Normal games declare
`bots=enabled`, `stats=enabled` and `rewards=flat`; `none` needs an approved
reason in the design document. Identity games with bots automatically include
host bulk bot identity handling so every seat, including bots, satisfies the
identity-viewing gate.

Defaults: display name = game id, tier `mini`, rewards 5 XP / 1 draw /
daily target 5 (`DEFAULT_REWARDS` in `generate.mjs`); reward options fail with
`rewards=none`. The game id must satisfy `GAME_ID_PATTERN` (a lowercase
letter, then lowercase letters or digits, 2-32 characters) and category ids and
names `wordCategoryListProblems`, both in
`packages/game-engine/src/platform/protocol/catalogIds.ts`, the one rule that
`defineWordCategoryCatalog` and the 0095 `game_types` / `word_categories`
CHECKs also enforce. The generator imports that file directly (Node type
stripping, Node `>=22.18.0`); class names derive from the game id.
Directory visibility is printed by the CLI and report: the default remains
registered-but-hidden. Explicit `--production` updates both the registry and
the Home production contract; it does not deploy or certify the gameplay.
The generated design is automatically indexed in `docs/README.md`.

## Shared edits

`SHARED_EDITS` in `generate.mjs` is the authoritative list of shared
registrations and contract edits; the individual targets are listed in
`registration-checklist.md`. The generator prepares templates, shared-file
updates, migration and report in memory, then checks every output path before
writing. Missing anchors, invalid tokens and existing targets abort before the
first write.

After writing, generated files are formatted with Prettier and lint-fixable
imports are sorted with ESLint. A formatting/lint failure leaves a complete
generated game in place; fix the reported files instead of rerunning because
the duplicate guard will reject the existing game id.

## Templates and counts

Templates are under `scripts/lib/new-game/templates/{shared,game}`.
`FILE_CAPABILITY_GATES` controls whole-file inclusion; `//#cap` segments
control in-file variants. Completed-games statistics files are gated on
`businessStats` (`stats=enabled`).
The integration report is an additional output for every selection.

Use `generatorFacts()` and `.agents/skills/new-game/scripts/check-new-game.sh`
for current shared-file/template counts, feature keys and required test cases.
Do not copy counts into another checklist. `scripts/new-game.test.mjs` checks
representative feature profiles, requires the generated behavior-test files and
named assertions for every enabled feature, and runs representative generated
packages through formatting, lint, typecheck and package tests. Each profile's
report also names its manual workflow and gameplay verification obligations.

## Registration migration and numbering

The next filename comes from the highest physical migration number. The
generator never derives SQL from an earlier migration. It replays every
file under `packages/api-worker/migrations` in order into an in-memory
`node:sqlite` database (one transaction per file, foreign keys on) and
judges the schema that results against the code's `GAME_TYPES`:

- it refuses, before writing anything, when the id is already in
  `game_types`, `<id>_user_stats` already exists, a lookup table is missing,
  `game_types` drifts from `GAME_TYPES`, or any CHECK hard-codes a game list
  (that would need a constraint change, i.e. a table rebuild);
- it also refuses a `--word-category` list that breaks the engine rule in
  `catalogIds.ts` (malformed or repeated id or name); that is an input error,
  reported under its own heading: fix the arguments and run again;
- otherwise it emits inserts only: one `game_types` row appended after the
  current maximum `sort_order`; with `stats=enabled` a brand-new
  `<id>_user_stats` table. No `DROP`, `ALTER`, `RENAME`, `PRAGMA` or `_next`;
- it applies the generated SQL to the replayed database and verifies the
  resulting rows and `PRAGMA foreign_key_check` before writing.

A word library (`wordSupply` other than `none`) needs the approved
categories as `--word-category <id>=<name>` (required exactly then, in
display order). They become the generated `wordCategories.ts`, not
registration rows: `word_games` / `word_categories` are the D1 projection
of `GAME_WORD_GAMES` / `WORD_CATEGORY_CATALOGS`, which the generator does
not edit, so the generated tree keeps `contracts/d1Catalog.contract.test.ts`
green (the tooling-present case in `scripts/new-game.test.mjs` runs it).
The report's word-supply step renders the matching inserts
(`wordLibraryRowsSql` in `migration.mjs`) for the supply migration that
joins code and rows in one change.

The same run appends the new file's sha256 to
`contracts/d1MigrationManifest.json` (a `SHARED_EDITS` entry). A schema refusal
means the migration is hand-written under the D1 rules in
`packages/api-worker/AGENTS.md` (rebuild with every descendant and trigger,
write estimate, reset window, manifest). The generated migration is a
starting point, not a template: review it against the current schema and
this game's requirements before committing, and never copy it or an
earlier migration mechanically. The same run generates the game's
`defineWordCategoryCatalog` catalog (`packages/game-engine/src/games/<id>/wordCategories.ts`,
exported from `public.ts`) from the same `--word-category` list as the
word rows the report renders for the supply migration. `GAME_WORD_GAMES` and `WORD_CATEGORY_CATALOGS`
(`packages/game-engine/src/games/wordCategoryCatalogs.ts`, the map
`contracts/d1Catalog.contract.test.ts` pins against D1) are not edited: joining
them requires every `GameWordGame`-keyed adapter, so it stays manual (report step 7,
`references/registration-checklist.md` item 7). Draw rows are not generated:
only a pool using the shared draw needs `word_draw_index` / `word_draw_ordinals`
rows (see report step 7).
