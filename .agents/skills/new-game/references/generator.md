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
`rewards=none`. The game id must match `/^[a-z][a-z0-9]*$/` (`render.mjs`,
`assertValidGameId`); class names derive from it.
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

## Migration source and numbering

The next filename comes from the highest physical migration number,
not the latest registration number. The latest registration migration
is used as the rebuild source; historical migration files remain immutable.
The registration rebuild body is bounded by the source PRAGMAs so a
previous game's appended owned tables are not copied into the next game.
With `stats=enabled` the generator appends the new owned `<id>_user_stats` table; it does not
create a statistics history ledger or indexes.

Review the rebuild set against current migrations/schema, including
foreign-key dependents, indexes/triggers and copy costs. Derivation is not
permission to apply a stale table body. The isolated generation contracts
exercise migration application and preserve existing data; gameplay-specific
schema changes remain approved manual work.
