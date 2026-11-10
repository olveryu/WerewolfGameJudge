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

## Night-1 engine integration tests

The suite lives in
`packages/game-engine/src/games/werewolf/__tests__/boards/` (Vitest,
engine imports only). The harness: `gameFactory.ts` (`createGame(templateName,
roleAssignment)` seats every player, assigns the fixed roles, and
begins the night through engine commands; `cleanupGame`), `gameContext.ts` (the `GameContext` returned to tests:
state reads, `assertStep`, command helpers), and `stepByStepRunner.ts`
(`executeStepsUntil`, `executeRemainingSteps`, `executeFullNight`,
`submitActionOrThrow`).

`night1.boards.coverage.contract.test.ts` in that directory:

- A. every name in `REQUIRED_12P_TEMPLATES` has a
  `night1.*.12p.integration.test.ts` file containing its
  `TEMPLATE_NAME = '<name>'` (pattern in `TEMPLATE_TO_TEST_PATTERN`);
- B. every such file asserts at least one theme field (a reveal,
  `currentNightResults`, `convertedSeat`, `actions`), not only deaths;
- C. every step id in `NIGHT_STEPS` is reached or asserted by some
  boards test.

The list covers a subset of the presets (those registered so far);
a new 12-seat board is added to both maps. Bottom-card boards
(`night1.thiefCupid.14p`, `night1.treasureMaster.15p`) are named by
role count and sit outside the contract. The sibling
`packages/game-engine/src/games/werewolf/__tests__/night1RoleCoverage.contract.test.ts`
checks that every `NIGHT_STEPS` step has a schema, a resolver, and an
audio key.

## Engine contract tests that exist

- `Template.contract.test.ts` — preset self-consistency and the
  expected-name list (see `references/preset-rules.md`).
- `nightPlanSchemas.contract.test.ts` — every preset in
  `PRESET_TEMPLATES` produces a valid step sequence with valid step
  counts and audio keys.

Both live in the engine under
`packages/game-engine/src/games/werewolf/domain/models/`.

## E2E

A board change does not automatically need a new E2E spec. If one is
proposed, see the new-e2e-spec skill; werewolf specs join the CI
matrix only after the P3 werewolf web port. The board picker page
object exposes `selectTemplate(name)` / `selectDefaultTemplate()`;
there is no `selectPreset` method.
