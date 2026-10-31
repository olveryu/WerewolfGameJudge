# Spec shape — one declaration, derived registries

Source files are under
`packages/game-engine/src/games/werewolf/domain/models/roles/spec/`.

## The one rule

`ROLE_SPECS` in `specs.ts` is the single source. `SCHEMAS` (`schemas.ts`,
`buildSchemas()`) and `NIGHT_STEPS` (`nightSteps.ts`, `buildNightSteps()`)
are derived from it at module init. Never hand-edit either derived file to
add a role or a step: add the declaration to `ROLE_SPECS` (and, for a new
step, its id to `NIGHT_STEP_ORDER`) and let the builders derive the rest.

## `RoleSpec` fields

From `roleSpec.types.ts` (`RoleSpec` interface). Only fields a new role
normally sets are listed; read the interface before using any other field.

| Field                                                     | Meaning                                                                                                                               |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                      | Role id; must equal the registry key.                                                                                                 |
| `displayName`, `shortName`, `emoji`                       | Player-facing name, one-character abbreviation, emoji.                                                                                |
| `faction`                                                 | `Faction`: `Wolf`, `God`, `Villager`, or `Special`.                                                                                   |
| `team`                                                    | `Team`: `Wolf`, `Good`, or `Third`. Team is not inferred from faction.                                                                |
| `abilities`                                               | Ability declarations (see below). Empty array when the role has no ability.                                                           |
| `nightSteps`                                              | Optional. Each entry becomes one derived night step. Omit it (or use an empty list) for a role with no night step.                    |
| `description`, `structuredDescription`                    | Full and structured description text.                                                                                                 |
| `displayAs`                                               | Optional disguised identity shown to players.                                                                                         |
| `immunities`, `recognition`, `resources`, `deathCalcRole` | Only when the role needs them; copy the field shape from the nearest existing role that uses the same field, and check the type file. |

## `NightStepDef` fields

From `roleSpec.types.ts` (`NightStepDef`). `stepId` must be a member of
`NightStepId` (i.e. listed in `NIGHT_STEP_ORDER`). `audioKey` defaults to
the role id when omitted; `audioEndKey` defaults to `audioKey`. The `ui`
block carries the step's prompt/confirm/reveal text; for the common
seat-action pattern it is a `seatAction: { verb }` declaration and the
schema builder composes the sentences (see `schemas.ts`).

## Ability shape (common active ability)

Verified against the `seer` / `mirrorSeer` entries in `specs.ts`:

- `type: 'active'`, `timing: 'night'`, `actionKind` (for example
  `'chooseSeat'`).
- `target: { count: { min, max }, constraints: [...] }` when the ability
  takes a target.
- `canSkip: true` when the player may skip.
- `effects: [{ kind, ... }]` declaring what the action does.
- `activeOnNight1: true` when the ability runs on the first night.

`TargetConstraint` has exactly three members: `NotSelf`,
`NotWolfFaction`, `AdjacentToWolfFaction` (`schema.types.ts`). Do not
present a shorter list as exhaustive. A constraint is declared in the
spec; the resolver enforces it. Do not add a constraint the spec does not
declare, and do not declare one the resolver ignores.

## What is not stated here

Effect vocabularies beyond the shapes above, passive/triggered ability
forms, and `structuredDescription` field rules were not verified
line-by-line for this draft. Read the nearest existing role and the type
files, and list any unverified claim in the work notes instead of
asserting it.
