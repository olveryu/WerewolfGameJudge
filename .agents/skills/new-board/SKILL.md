---
name: new-board
description: 'Add a werewolf preset board within first-night, dawn, and sheriff-election scope: verify roles, register the preset, update counts, add board UI and Night-1 coverage, then verify. Later-night rules do not expand automation. Use for a preset, never a new role or game.'
---

# New board

Add one preset board to `PRESET_TEMPLATES`. A board is a name, a
category, and a role list — the player count is derived, and the
contract tests check the rest. User-facing output is in Chinese.

## Product scope

Werewolf automates the first night, dawn, and sheriff election only;
later nights and subsequent daytime play belong to the in-person host.
A board's complete rules can mention later abilities without requiring
multi-night state or UI. Add only in-scope scenarios and interactions.
Do not ask whether to support multiple nights merely because the board
includes a second-night ability. Only an explicit user request reopens
scope; clarify actual first-night rule ambiguities instead.

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

1. `references/role-index.md` — current 48-role catalog index; every
   role is declared in its module under `roles/`.
2. `references/preset-rules.md` — schema, categories, seat-count
   rule, bottom cards, contract checks, count surfaces.
3. `references/board-test.md` — the web board UI tests, the Night-1
   engine integration tests, and their coverage contracts.

## Steps

### 1. Collect and verify the board

Get the board name, category, and full role list from the requester.
Verify every role id in `references/role-index.md` (or in
`WEREWOLF_ROLE_DEFINITIONS` in `roles/index.ts` directly). A missing role stops the work: add the role
first, do not invent an id. Agree the category using the enum meanings in
`references/preset-rules.md`.

### 2. Check the design

Derive the seat count with `getPlayerCount`: `roles.length` minus
bottom cards (`treasureMaster` 3, `thief` 2). Check faction balance
against the contract bounds (wolves 1–4; no duplicated special
roles), bottom-card legality via `getValidBottomCardDeals`, and that
the name carries no player-count suffix. All current presets seat 12
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

Derive the new total from `PRESET_TEMPLATES.length` (one more than
before for one addition) and update every surface that cites it: `README.md`,
`README.en.md`, `docs/PRESET_BOARDS.md` (including its board table
row), `EXPECTED_TEMPLATE_NAMES` in `Template.contract.test.ts`, and the
fail-fast preset count in `getAll12PBoards`
(`packages/web/src/games/werewolf/room/__tests__/harness/boardDialogCoverage.ts`).
There is no step for the non-existent guide-content file.

### 5. Add the board UI test

Add `packages/web/src/games/werewolf/room/__tests__/boards/<key>.12p.board.ui.test.tsx`,
modeled on the nearest board with the same roles, and map the board
name to it in `BOARD_TEST_FILE_MAP` (same `boardDialogCoverage.ts`).
The contract
`packages/web/src/games/werewolf/room/__tests__/contracts/boardUICoverage.contract.test.ts`
requires one file per preset, `recordAlerts(harness)`, a real room
mount and interaction, and one literal `harness.assertCoverage([...])`
holding every `getRequiredUiDialogTypes(board)` type; nightmare and
wolf-robot boards have extra checks (`references/board-test.md`).

### 6. Record the Night-1 scenario and add board-specific scenarios

`packages/game-engine/src/games/werewolf/__tests__/boards/night1.scenarios.integration.test.ts`
plays one ordinary night on every entry of `PRESET_TEMPLATES` through
production commands, so a new preset is picked up without
registration. Run it and `night1.catalogue.integration.test.ts` once
with `-u` to record the new `<board name> preset: ordinary night`
snapshot and the step-by-step list, then read the recorded
entry: steps visited, unavailable options with their reasons, private
views, review sentences, deaths, and daytime announcements must all
match the board's rules.

If the board introduces a role interaction no existing scenario
plays, add role-keyed scenarios for it to `nightScenarios.ts` in the
same directory (details in `references/board-test.md`). The suite
fails when a declared night step is reached by no scenario.

Report every changed line of
`__snapshots__/night-steps.catalogue.txt` to the user. A new board
normally changes only the counts; a new or changed sentence is a
user-facing change and needs the user's confirmation before it is
committed.

### 7. Verify

Run the acceptance commands. If the board introduces a role
combination no existing spec covers, report whether an E2E spec is
proposed before writing one (see the new-e2e-spec skill).

For an independent read-only drift audit, use the review-werewolf-addition
skill; ordinary-night coverage alone does not prove every interaction.

## Acceptance commands

```sh
pnpm --filter @game-judge/game-engine exec vitest run Template.contract night1.scenarios night1.catalogue
pnpm --filter @game-judge/web exec vitest run boardUICoverage.contract <key>.12p.board.ui
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
3. Accepting the recorded Night-1 snapshot without reading it — the
   snapshot is the expectation; a wrong sentence or death recorded
   with `-u` becomes the baseline.
4. Claiming the board is covered end to end — only the engine
   template contract, its Night-1 scenarios, and its board UI test
   run for it.
5. Updating a non-existent guide-content file, or copying the old
   "27 → 28" count example — derive the count from the template
   list at the time of the change.
