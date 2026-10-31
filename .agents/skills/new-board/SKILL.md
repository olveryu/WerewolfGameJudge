---
name: new-board
description: 'Add a preset board to PRESET_TEMPLATES: verify every role id in ROLE_SPECS, add the entry with its category and role list, update the cited preset count, add a Night-1 integration test, and register 12-seat boards in the coverage contract. Use when adding a preset board; never for a new role or game.'
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
- anyone proposes updating a guide-content count file — the file
  `src/config/guideContent.ts` does not exist; there is no such step.

## Must-read references

1. `references/role-index.md` — current 47-role index, regenerated
   from `ROLE_SPECS`, with faction and night steps per role.
2. `references/preset-rules.md` — schema, categories, seat-count
   rule, bottom cards, contract checks, count surfaces.
3. `references/board-test.md` — harness imports, file naming, and
   the 12-seat coverage contract.

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
a different seat count is allowed by the code, but a non-12-seat
board has no coverage-contract entry (Step 5).

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

### 5. Add the Night-1 integration test

Create the test under `src/games/werewolf/__tests__/engine/boards/`
using the imports and naming in `references/board-test.md`, with a
fixed seat assignment and at least one topic-specific assertion. If
the board seats 12 players, also add its name to
`REQUIRED_12P_TEMPLATES` and its regex to
`TEMPLATE_TO_TEST_PATTERN` in the coverage contract. If it seats a
different number, do not add it to that list; note the gap.

### 6. Verify

Run the check script beside this skill (see Acceptance commands)
and the acceptance commands. If the board introduces a role
combination no existing spec covers, report whether an E2E spec is
proposed before writing one (see the new-e2e-spec skill).

## Acceptance commands

```sh
.agents/skills/new-board/scripts/check-new-board.sh .
pnpm exec jest --no-coverage --forceExit Template.contract night1.boards.coverage.contract nightPlanSchemas.contract
```

Full quality verification runs in CI; also run format and lint
checks on the changed files before pushing.

## Pitfalls

1. Writing "12 players" as a hard rule from `roles.length` — seat
   count subtracts bottom cards; `thief`/`treasureMaster` boards
   have 14/15 `roles` entries for 12 seats.
2. Adding a board name with a player-count suffix — `models/__tests__/Template.contract.test.ts` rejects names matching `/\d+人$/`.
3. Importing `executeFullNight` or `GameContext` from `gameFactory`
   — they live in `stepByStepRunner` and `gameContext`.
4. Registering a non-12-seat board in the 12-player coverage
   contract — the list is 12-seat only; the gap is recorded, not
   papered over.
5. Updating a non-existent guide-content file, or copying the old
   "27 → 28" count example — derive the count from the template
   list at the time of the change.
