# Capabilities and integration report

## Capability selection

Selectable capabilities are chosen independently with repeated
`--capability <key>` arguments; those choices default off:

```sh
pnpm new-game <gameId> --capability identityViewing --capability stageDeadline
```

The selectable keys are `identityViewing`, `stageDeadline`,
`audioOrchestration`, and `botTestScaffold`. Unknown keys are rejected.
`botsAndTakeover` and `hostConfig` are always wired by the base skeleton;
`revealAnimation` follows `identityViewing`. `botTestScaffold` requires
`identityViewing`. When both `identityViewing` and `stageDeadline` are
enabled, deadline arming is deferred until play begins; otherwise a
selected stage deadline is armed as the stage begins.

The capabilities contract checks each generated declaration against its
wiring. Change a capability only with its corresponding wiring and contract
expectation. Statistics are always generated and are not a capability.

## Integration report: 9 steps

The generator writes `new-game-<gameId>-report.md` at the repo root
(`report.mjs`, `buildIntegrationReport`). It always has 9 numbered manual
steps. Do not delete the report until every step is disposed of; record the
disposition in the PR description.

1. Finalise the design: fill the 11-item requirements table in the
   generated design doc with the approved design. Display name, subtitle,
   icon, and default player counts in the skeleton are placeholders. When
   `identityViewing` is enabled, replace the `TODO_IDENTITY` placeholder
   identities with the real identity table.
2. Fill gameplay: grep `TODO(gameplay)` inside the new game's three
   directories and fill each one — state machine in `domain/decision.ts` /
   `engine.ts`, privacy projection in `domain/visibility.ts`. Unfilled
   example commands reject as not implemented.
3. Fill the review: the review (本局复盘) is wired end to end — module
   `review`, the ended bottom entry for every viewer, the host sheet action
   and the ended choice task (review / next round / return to lobby); the
   dialog and image sharing are the platform's. Put the round's facts
   (outcome, identities, scores, course) into
   `packages/web/src/games/<gameId>/review/to<Game>ReviewDocument.ts`, set
   availability and sharing in `review/<gameId>Review.ts`, and update the
   associated tests. The block vocabulary is closed:
   `packages/web/src/features/room/review/types.ts`; extend the platform
   vocabulary first, and do not write game-specific review JSX.
4. Confirm reward policy/numbers and statistics semantics. The generator
   keeps flat rewards; approve flat or levelRoll explicitly, and confirm
   values in `packages/game-engine/src/product/rewards/earnings.ts` (the
   registry references the same constants). Generated statistics provide
   one completed game per eligible terminal completion. Approve and
   implement gameplay metrics or explicitly approve count-only; specify
   units/round labels, facts/ownership, denominators, time precision,
   missing history, migration, and visibility/cache policy.
5. Review the migration: the generated file is mechanically derived from
   the latest registration migration. Verify the rebuild set against the
   current schema by hand; the cumulative completed-games table is already
   generated. No extra history or index is implied.
6. E2E activation: the spec skeleton is
   `e2e/specs/<gameId>.spec.ts.tmpl` and is not in CI by default. Activating
   it means renaming it to `<gameId>.spec.ts` and adding the filename to the
   e2e shard matrix in `.github/workflows/ci.yml`.
7. Word supply, if needed: make all three registrations described in
   `references/skeleton-and-wiring.md`. The skeleton carries no workflow
   body.
8. Re-run scoped engine/Worker/web tests and affected contracts, root
   `tsc --noEmit`, changed-package typechecks, `knip`, the skill check, and
   changed-file prettier/eslint. Full suites/quality/E2E belong to CI.
   Include statistics eligibility, strict legacy/v2, atomic rollback/replay,
   HTTP/profile/settings/count/unlock/cache, and D1 cost evidence.
9. Go live: if generated with `--production`, add the id to
   `PRODUCTION_GAME_TYPES` in
   `packages/web/src/games/__tests__/homeProductionFilter.contract.test.ts`
   in `GAME_TYPES` order. Otherwise, in the same PR, flip `isProduction`
   to `true` in the registry entry and add the id to that list. Changing
   only one is caught by the contract test.

Each step's disposition is implementation plus verification, or an
explicitly approved not-applicable reason. Matching the production list
and green contracts is not sufficient: unapproved semantics, unimplemented
metrics, missing migration review, or incomplete verification block go-live.
