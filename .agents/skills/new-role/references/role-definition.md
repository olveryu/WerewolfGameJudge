# Runtime role and step definitions

Night execution is declared in one module per role under
`packages/game-engine/src/games/werewolf/roles/`. Read `role.ts`,
`roleSteps.ts`, and a nearby role with similar mechanics before editing.

## Role declaration

Use `defineRole` from `role.ts` to declare the role's:

- stable role id and `card` display metadata;
- `traits`, including explicit faction and team;
- runtime `steps`;
- optional night schedule, resources, announcement, and passive death effects.

The type contract is `WerewolfRoleDefinition`. Step declarations use
`WerewolfRoleStepDefinition`, based on the shared platform
`StepDefinition` and the werewolf-specific step context, facts, results,
and audio.

## Step behavior

- Use the shared platform step-action kinds for seat selection, direct
  actions, viewing information, and card selection. Do not introduce a
  role-specific client interaction model.
- Use helpers from `roles/roleSteps.ts` where they match the rule, such
  as single-target, group-confirm, and card-selection steps. Keep custom
  rules in the role's own module.
- Step resolution records declared facts and results; it does not
  mutate the game state directly. The runtime applies role facts through
  the engine's step pipeline.
- Declare player-facing copy with the shared step-copy helpers and
  role audio with the werewolf audio helpers. Keep user-facing text out
  of ad hoc client branches.

## Registration and order

- Register role modules in `roles/index.ts` in
  `WEREWOLF_ROLE_DEFINITIONS`; genuinely shared steps are registered in
  `WEREWOLF_SHARED_STEPS`.
- Declare step execution order in
  `domain/models/roles/spec/nightStepIds.ts`. `roles/nightPlan.ts`
  assembles the runtime plan from the definitions and this order.
- Keep `ROLE_SPECS` metadata in sync for existing catalog, selection,
  template, and projection consumers. It does not replace the runtime
  role definition.

`roles/__tests__/roleSteps.contract.test.ts` checks the role registry,
generated step output, and representative night behavior. Update its
expected role ids and snapshots when those outputs intentionally change.
