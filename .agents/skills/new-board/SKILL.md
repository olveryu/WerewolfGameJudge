---
name: new-board
description: 'Add a preset board to PRESET_TEMPLATES: verify every role id in ROLE_SPECS, add the entry with its category and role list, update the cited preset count, then verify with the engine template and night-plan contracts and record the missing Night-1 board test as a gap. Use when adding a preset board; never for a new role or game.'
---

# New board

Add one preset board to `PRESET_TEMPLATES`. A board is a name, a
category, and a role list — the player count is derived, and the
contract tests check the rest. User-facing output is in Chinese.

## When to use

Use when adding a preset board (a named, reusable role composition)
to the werewolf game.

Do not use when:

- a role does not exist yet — add it first with the new-role skill,
  then return here;
- only a custom (non-preset) template is needed for one room — that
  is a room configuration, not a preset;
- the change is a new game — use the new-game skill;
- anyone proposes updating a guide-content count file — no such file
  exists in the repository; there is no such step.

## Must-read references

1. `references/role-index.md` — current 47-role index, regenerated
   from `ROLE_SPECS`, with faction and night steps per role.
2. `references/preset-rules.md` — schema, categories, seat-count
   rule, bottom cards, contract checks, count surfaces.
3. `references/board-test.md` — which board tests exist now and the
   missing Night-1 harness.

## Steps

### 1. Collect and verify the board

Get the board name, category, and full role list from the requester.
Verify every role id in `references/role-index.md` (or in `specs.ts`
directly). A missing role stops the work: add the role first, do not
invent an id. Agree the category using the enum meanings in
`references/preset-rules.md`.

### 2. Check the design

Derive the seat count with `getPlayerCount`: `roles.length` minus
bottom cards (`treasureMaster` 3, `thief` 2). Check faction balance
against the contract bounds (wolves 1–4; no duplicated special
roles), bottom-card legality via `getValidBottomCardDeals`, and that
the name carries no player-count suffix. All 26 current presets seat 12
players — that is the current list's property, not a requirement;
a different seat count is allowed by the code.

### 3. Add the `PRESET_TEMPLATES` entry

Add the entry in `packages/game-engine/src/games/werewolf/domain/models/Template.ts`,
in the block for its category, following the observed ordering
(villagers, wolves, special wolves/gods, special roles, bottom-card
actor last):

```ts
{
  name: '<board name>',
  category: TemplateCategory.Advanced,
  roles: ['villager', 'wolf', /* ... */],
},
```

### 4. Update the cited preset count

Derive the new total from `PRESET_TEMPLATES.length` (26 becomes 27
for one addition) and update every surface that cites it: `README.md`,
`README.en.md`, `docs/PRESET_BOARDS.md` (including its board table
row), and `EXPECTED_TEMPLATE_NAMES` in `Template.contract.test.ts`.
There is no step for the non-existent guide-content file.

### 5. Record the Night-1 test gap

The Night-1 board integration harness and its 12-seat coverage
contract were removed with the React Native client and not ported
(`references/board-test.md`). Record in the PR description that the
new board has no Night-1 integration test, and name the role
combination it introduces. The werewolf web client, its board UI,
and the werewolf E2E specs land in P3 of
`docs/web-client-rewrite.md` §8.2.

### 6. Verify

Run the acceptance commands. If the board introduces a role
combination no existing spec covers, report whether an E2E spec is
proposed before writing one (see the new-e2e-spec skill).

## Acceptance commands

```sh
pnpm --filter @game-judge/game-engine exec vitest run Template.contract nightPlanSchemas.contract
```

Then run the read-only count check beside this skill:

```sh
sh .agents/skills/new-board/scripts/check-new-board.sh .
```

Full quality verification runs in CI; also run format and lint
checks on the changed files before pushing.

## Pitfalls

1. Writing "12 players" as a hard rule from `roles.length` — seat
   count subtracts bottom cards; `thief`/`treasureMaster` boards
   have 14/15 `roles` entries for 12 seats.
2. Adding a board name with a player-count suffix — `models/__tests__/Template.contract.test.ts` rejects names matching `/\d+人$/`.
3. Recreating the old Night-1 harness or coverage contract under a
   new path without an approved plan — record the gap instead.
4. Claiming the board is covered end to end — only the engine
   template and night-plan contracts run for it now.
5. Updating a non-existent guide-content file, or copying the old
   "27 → 28" count example — derive the count from the template
   list at the time of the change.
