---
name: new-role
description: 'Add a werewolf role within first-night, dawn, and sheriff-election scope: define its role module and full card, register first-night steps, wire tests and assets, then verify. Later-night rules stay in descriptions unless the user explicitly expands scope.'
---

# New role

Add a werewolf role across the engine runtime, existing role catalog,
client surfaces, and assets. Night behavior is declared in role modules;
the role catalog remains a separate source for existing selection and
presentation consumers.

## Product scope

Werewolf automates the first night, dawn, and sheriff election only.
Later nights and subsequent daytime play belong to the in-person host.
Keep complete rules in role descriptions, but implement only effects
that occur within this scope. A second-night-only active ability has no
first-night action or placeholder confirmation step. Do not add round
counters, multi-night resources, or full-game settlement to support it.
Do not ask whether to expand to multiple nights merely because the
role text mentions them; only an explicit user request reopens scope.
Ask about ambiguous first-night interactions instead.

## When to use

Use when adding a new role id to the werewolf game.

Do not use when:

- only a preset board changes (use the new-board skill);
- only an existing role's copy, balance, or art changes;
- a new game is being added (use the new-game skill);
- only audio for an existing role is regenerated (follow the audio
  script instructions in `references/audio-badge-avatar.md`).

## Must-read references

1. `references/role-index.md` — the current role list, read from the
   role modules through `roles/catalog.ts`.
2. `references/role-definition.md` — runtime role and step definitions.
3. `references/night-step-order.md` — the centralized night execution order.
4. `references/audio-badge-avatar.md` — narration, badge, and avatar surfaces.

## Steps

### 1. Plan

Agree on the role id, display name, faction and team, abilities,
night steps and their execution positions, effects on other roles,
copy, and required client and asset changes. Ask when a rule or
interaction is ambiguous; do not present proposals as confirmed rules.

### 2. Define runtime behavior

Create `packages/game-engine/src/games/werewolf/roles/<roleId>.ts`
using `defineRole` from `roles/role.ts`. Follow
`references/role-definition.md` and a nearby role with similar behavior.
Declare step actions and resolution in the role definition; use shared
step helpers from `roles/roleSteps.ts` when they fit. If the role needs
the night flow, the report, or another role's step to behave
differently, declare that on the role and have the flow read the
declaration; do not name the role in flow code
(`roles/__tests__/roleOwnership.contract.test.ts` fails on it).

### 3. Register the role and its steps

- Import the new definition and add it to `WEREWOLF_ROLE_DEFINITIONS`
  in `roles/index.ts`. Put genuinely shared behavior, such as the wolf
  attack step, in the shared-step declaration rather than duplicating it.
- Add each new step id to `NIGHT_STEP_IDS` in
  `roles/nightStepOrder.ts` at its execution position.
  The runtime plan is built in `roles/nightPlan.ts`.
- Give the role its full card in the same module: name, short name,
  icon, description, the description `sections`, and `tags`. The flat
  description must equal the sections joined in render order;
  `roles/__tests__/roleCards.contract.test.ts` enforces it. Role
  selection, templates, and display read the card through
  `roles/catalog.ts`; there is no second place to register a role.
- Update role-id expectations in
  `roles/__tests__/roleSteps.contract.test.ts` and the relevant catalog
  contracts. Add a played-night scenario for each situation the role
  introduces and regenerate the step-by-step list
  (`references/role-definition.md`). Add focused behavior tests for
  rules not already covered.

### 4. Update client surfaces and counts

The web client is present. Update role-specific client maps, config or
presentation data, and their contract tests where they enumerate role
ids. Search cited role totals in the readmes and skill references, then
update them from the current catalog. Update `references/role-index.md`
for the new catalog entry so the new-board skill can use it.

### 5. Register narration, badge, and avatar

Follow `references/audio-badge-avatar.md`. Declare narration for every
audio key used by the runtime steps and register the clips with the
current client audio registry. Add badge configuration and, when art is
provided, the avatar id, rarity, and web portrait. Use the existing
asset-generation scripts and their documented options.

### 6. Play every situation and report the list's diff

List the in-scope first-night situations the role introduces before writing scenarios:
each action used and skipped, each reason a card or seat is
unavailable, the actor feared, the actor converted, the target
swapped, the role as a bottom card, and the step on a night with and
without a wolf attack. Add a played night for each to
`__tests__/boards/nightScenarios.ts` and regenerate the list
(`references/role-definition.md`). No check can tell that a situation
is missing; one nobody plays never reaches review.

Then report every changed line of
`__snapshots__/night-steps.catalogue.txt` to the user. A new or
reworded sentence, or a rule the user has not decided, needs the
user's confirmation before it is committed. Ask one question at a
time, with a recommendation.

### 7. Verify

Run the engine tests and build, including the role-step contract and
relevant Night-1 integration coverage. Run the web tests and typecheck
when client data or assets change. Fix failures in the role definition,
catalog, registrations, or affected client surfaces.

For an independent read-only drift audit, use the review-werewolf-addition
skill; implementation checks do not replace its rule and approval review.

## Acceptance commands

```sh
corepack pnpm --filter @game-judge/game-engine run test
corepack pnpm --filter @game-judge/game-engine run build
corepack pnpm --filter @game-judge/web run test
corepack pnpm --filter @game-judge/web run typecheck
```

## Pitfalls

1. Looking for a second role table. A role's display data and its night
   behavior both come from its module in `WEREWOLF_ROLE_DEFINITIONS`
   and the shared-step declarations.
2. Forgetting to add runtime step ids to `NIGHT_STEP_ORDER` in
   `roles/nightStepOrder.ts`; role definitions do not determine their
   own execution order.
3. Inferring team from faction. Set both explicitly; for example,
   `hiddenWolf` has faction `Wolf` and team `Good`.
4. Assuming `shortName` values must be unique. Existing roles can share
   a short name; follow the current catalog contract.
5. Leaving audio declarations without matching narration and client
   clips; validate them with the current audio registry contract.
6. Regenerating the step-by-step list with `-u` and committing it
   unread. The test only knows the text changed, not whether the change
   is right; the diff is what the user reviews.
7. Writing the reason a card is unavailable where the actor cannot see
   it. A hand card prints no reason: put it in the status line. When
   every skill is locked the mechanism writes that line from the lock;
   a step that greys its own cards writes it with `renderBlockedPrompt`.
