---
name: new-role
description: 'Add a werewolf role end to end: declare it once in ROLE_SPECS, place its night step in NIGHT_STEP_ORDER, wire its resolver, confirm pipeline, config entry, audio, badge, and avatar, then verify with the spec contract tests. Use when adding a new role id to the werewolf game.'
---

# New role

Add one werewolf role. The role is declared once, in `ROLE_SPECS`; the
schema registry and the night-step registry are derived from that
declaration. User-facing output is in Chinese.

## When to use

Use when a genuinely new role id is being added to the werewolf game.

Do not use when:

- only a preset board changes (use the new-board skill);
- only an existing role's text, balance, or art changes and no new role
  id, step, or resolver is involved — change that role's spec entry
  directly and run the same contract tests;
- a new game is being added (use the new-game skill);
- the change is audio-only regeneration for an existing role — follow
  the audio script's own usage in `references/audio-badge-avatar.md`
  instead of this procedure.

## Must-read references

Read these before editing, in this order:

1. `references/role-index.md` — current 47-role index, regenerated from
   `ROLE_SPECS`.
2. `references/night-step-order.md` — current 37-step `NIGHT_STEP_ORDER`.
3. `references/spec-shape.md` — `RoleSpec` / `NightStepDef` fields.
4. `references/resolver-map.md` — generic vs standalone resolver for
   every step.
5. `references/confirm-pipeline.md` — only if the role has a confirm step.
6. `references/audio-badge-avatar.md` — narration, badge, avatar surfaces.

## Steps

### 1. Plan, then get approval before editing

Present the plan and wait for explicit approval: role id, display name,
faction and team, night step(s) and their position relative to existing
steps, resolver kind (generic or standalone, with the reason), whether
it is a confirm role, and which audio/badge/avatar work it needs. Do
not start editing on a direction alone. If any answer is unknown, ask
instead of guessing.

### 2. Declare the role in `ROLE_SPECS`

Add one entry to `ROLE_SPEC_DEFINITIONS` in
`packages/game-engine/src/games/werewolf/domain/models/roles/spec/specs.ts`,
in the faction block the role belongs to. Follow `references/spec-shape.md`
and the nearest existing role. Set `id` equal to the registry key,
`faction`, and `team` explicitly — team is never inferred from faction
(`hiddenWolf` is faction `Wolf`, team `Good`). Declare the ability and
its `nightSteps` in the same entry. Never edit `schemas.ts` or
`nightSteps.ts` by hand: both are derived builders.

### 3. Place a new step in `NIGHT_STEP_ORDER`

If the role introduces a new step id, insert it into `NIGHT_STEP_IDS`
in `.../roles/spec/nightStepIds.ts` at its execution position, and
nowhere else. The exported name is `NIGHT_STEP_ORDER`. The name
`NIGHT_STEP_ORDER_INTERNAL` does not exist — never write it, and never
paste an order list from older text; read `references/night-step-order.md`
or the file itself. Every step id in the order must have a declaring
role entry, or `buildNightSteps()` throws at module init.

### 4. Wire the resolver

Give the step a `RESOLVERS` entry in
`packages/game-engine/src/games/werewolf/domain/resolvers/index.ts`.
Use `createGenericResolver('<roleId>')` when the step matches a row in
`references/resolver-map.md`. Write a standalone resolver file only
when the logic cannot be expressed declaratively, and say so in the
plan first. A step with no resolver entry is incomplete even if the
spec compiles.

### 5. Handle a confirm role, if any

Only the five roles in `references/confirm-pipeline.md` are confirm
roles. If the new role is one of them in behaviour, read
`confirmContext.ts` before writing anything: the confirm mapping is
derived from the specs, and the client reads schema text through the
night-interaction resolver. Do not invent a second confirm mechanism.

### 6. Register the role in config and count surfaces

Add a slot for the role in `FACTION_GROUPS`
(`src/games/werewolf/screens/ConfigScreen/configData.ts`), following
the existing `RoleSlot` shape (`roleId`, optional `count`, `isBulk`,
`variants`). Then search the repo for the new role count and for every
place that cites the role total (for example the readme role/board
counts): update each cited count to the new total, derived from
`ROLE_SPECS` at that moment, and update any expected-name list that
enumerates roles or boards the role joins. Do not copy a number from
older text.

### 7. Register audio, badge, and avatar

Follow `references/audio-badge-avatar.md`: add narration text for every
audio key the steps use, using the canonical voice parameters; make
every `audioKey` resolve in the audio registry; add an `EMOJI_MAP`
entry; add the avatar id and rarity if the role gets hand-drawn art.
Art and narration are assets: get them approved before they land, and
do not state generation commands or output filenames that were not
verified from the scripts at run time.

### 8. Verify

Run the check script beside this skill (see Acceptance commands),
then the acceptance commands below. Fix failures in the declaration or wiring — never
weaken a contract test to reach green. A role with no night steps is
valid only if it truly declares none: derive that from the spec entry,
never from an older no-action role list.

## Acceptance commands

```sh
.agents/skills/new-role/scripts/check-new-role.sh .
pnpm --filter @game-judge/game-engine run test -- src/games/werewolf/domain/models/roles/spec/__tests__/specs.contract.test.ts src/games/werewolf/domain/models/roles/spec/__tests__/nightSteps.contract.test.ts src/games/werewolf/domain/models/roles/spec/__tests__/schemas.contract.test.ts
```

Full quality verification runs in CI; before pushing, also run the
targeted typecheck and format checks for the changed files.

## Pitfalls

1. Editing `schemas.ts` / `nightSteps.ts` by hand instead of declaring
   in `ROLE_SPECS` — the builders overwrite the intent and the next
   regeneration diverges.
2. Writing `NIGHT_STEP_ORDER_INTERNAL` or pasting a stale step order —
   the constant does not exist and older lists omit steps.
3. Claiming `shortName` must be globally unique — it is not: `gargoyle`
   and `awakenedGargoyle` both use `石`. The contract checks non-empty
   only; check existing values before choosing one.
4. Copying an old "roles without night actions" list — derive it from
   `nightSteps` in the spec file; the old list omits roles.
5. Leaving an `audioKey` unregistered — resolution throws at runtime
   with no fallback, so an untested step fails in a real game.
