# Board tests and contracts

## Night-1 integration tests: not in the repository now

The Night-1 board integration harness (`gameFactory`, `gameContext`,
`stepByStepRunner`), its per-board tests, and the 12-seat coverage
contract `night1.boards.coverage.contract.test.ts` lived in the
removed React Native client's test tree (last present in commit
`ccedf18b5`) and were not ported. No test now drives a preset
through a full first night, and the coverage contract's
`REQUIRED_12P_TEMPLATES` list no longer exists. Record the missing
Night-1 test for a new board as a gap in the PR description; do not
recreate the old harness under a new path without a plan the user has
approved. To see what the old tests asserted, read them in that
commit (`git show ccedf18b5:<path>`).

## Contract tests that exist

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
