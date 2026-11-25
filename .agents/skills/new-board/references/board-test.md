# Board tests and contracts

## Board UI tests (web client)

Each preset has one board UI test under
`packages/web/src/games/werewolf/room/__tests__/boards/` (`<key>.12p.board.ui.test.tsx`).
It mounts the production werewolf room screen on a fake room link
through the harness in
`packages/web/src/games/werewolf/room/__tests__/harness/`
(`createWerewolfRoomMock` writes the real `GameState` for one night
step; `recordAlerts(harness)` records every alert the room publishes;
`tapSeat` / `pressText` click through userEvent) and drives the
board's dialogs: action prompt, wolf vote and empty vote, witch
save/poison/no-kill, confirm triggers, skips and seat confirms.

`boardDialogCoverage.ts` in the harness owns `BOARD_TEST_FILE_MAP`
(board name → file), the fail-fast preset count in `getAll12PBoards`,
and the role → required dialog types (`ROLE_UI_DIALOG_REQUIREMENTS`;
a new role's dialogs are declared there). The contract
`packages/web/src/games/werewolf/room/__tests__/contracts/boardUICoverage.contract.test.ts`
fails unless every preset has its mapped file, each file records
alerts through the harness, mounts the room, interacts for real and
lists every required type in one literal `harness.assertCoverage([...])`;
nightmare boards must also drive blocked → `actionRejected` with
`BLOCKED_UI_DEFAULTS`, and wolf-robot boards must press through the
hunter gate with `assertNoLoop`.

## Night-1 engine scenarios

The suite lives in
`packages/game-engine/src/games/werewolf/__tests__/boards/` (Vitest,
engine imports only):

- `gameFactory.ts` — `createGame(templateNameOrRoles, roleAssignment, options)`
  seats every player, assigns the fixed roles, and begins the night
  through engine commands; `gameContext.ts` is the `GameContext` it
  returns.
- `nightDriver.ts` — drives the night through `werewolf.step.submit`
  using only what each seat's step presentation offers.
  `playScenarioNight(context, choices, randomSeed)` takes role-keyed
  choices and returns a `NightRun`: the `NightOutcome` plus what each
  actor was shown at every step; `driveNight` and
  `executeStepsUntil` take step-keyed choices for tests that inspect
  one step.
- `nightScript.ts` — the role-keyed choice shapes (`NightActions`:
  a seat, `null` to skip, `{ save, poison }`, `{ targets }`,
  `{ confirmed }`, `{ cardIndex }`; `wolf` is the pack vote).
- `nightScenarios.ts` — `NIGHT_SCENARIOS`, the named scenarios grouped
  by board theme.
- `nightCases.ts` — `NIGHT_CASES`, every played night: one ordinary
  night per preset in `PRESET_TEMPLATES`, every entry of
  `NIGHT_SCENARIOS`, and the bottom-card and spirit-knight /
  cursed-fox variants.

`night1.scenarios.integration.test.ts` snapshots the `NightOutcome` of
every entry of `NIGHT_CASES`. A `NightOutcome` lists the steps visited,
the status line each actor saw, each unavailable action, seat, or card
with its reason
and the seats that saw it, the private views grouped by text, the
review sentences, the deaths with their causes, and the daytime
announcements. The same file fails when a declared night step is
reached by no case or when two cases share a name.

`night1.catalogue.integration.test.ts` renders the same nights into
`__snapshots__/night-steps.catalogue.txt`: per step, every distinct
status line, hand, confirmation, result, and review sentence, each with
the number of nights it appears in. A new preset changes those counts,
so regenerate it together with the scenario snapshot.

`specNight.integration.test.ts` holds the tests that assert one
behaviour directly (vote revision, stale submissions, persisted state
round trips) rather than a whole night.

## Engine contract tests that exist

- `Template.contract.test.ts` — preset self-consistency and the
  expected-name list (see `references/preset-rules.md`), under
  `packages/game-engine/src/games/werewolf/domain/models/__tests__/`.

## E2E

A board change does not automatically need a new E2E spec. If one is
proposed, see the new-e2e-spec skill; werewolf specs join the CI
matrix only after the P3 werewolf web port. The board picker page
object exposes `selectTemplate(name)` / `selectDefaultTemplate()`;
there is no `selectPreset` method.
