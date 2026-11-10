# Presets and the integration report

## Presets

`PRESET_CAPABILITIES` in `scripts/lib/new-game/generate.mjs` (line 60).
Only the four rows below differ between presets; the other six are the
same in all three (`botsAndTakeover` on, `hostConfig` on,
`nightPhase` / `audioOrchestration` / `wordLibrary` / `gallery` off).

| Capability        | `identity` | `stage` | `demo-hybrid` |
| ----------------- | ---------- | ------- | ------------- |
| `identityViewing` | on         | off     | on            |
| `revealAnimation` | on         | off     | on            |
| `stageDeadline`   | off        | on      | on            |
| `botTestScaffold` | on         | off     | on            |

Choose by the game's main shape, fixed at design time:

- Secret identities, dealing, and an identity-viewing checkpoint →
  `identity`.
- No secret identity; rounds advance on a stage deadline → `stage`.
- Secret identity and viewing checkpoint, plus a deadline that is
  armed when play begins and settles only through the internal
  settle channel → `demo-hybrid`
  (`PACK_SEGMENT_SWITCHES`, line 112: `armDeadlineAtBegin: true`).

Expiry channel (`PACK_SEGMENT_SWITCHES`, line 112): every
stage-deadline pack settles system-only through the internal settle
channel — there is no public `phase.expire` command in any preset
(D3). `stage` and `demo-hybrid` differ only in `armDeadlineAtBegin`:
`demo-hybrid` arms the deadline when play begins (after the viewing
checkpoint); `stage` does not. A hybrid that
matches neither preset starts from the nearer preset and changes
capability declarations one at a time with wiring (see
`references/skeleton-and-wiring.md`).

## Integration report: 9 steps

The generator writes `new-game-<gameId>-report.md` at the repo root
(`report.mjs`, `buildIntegrationReport`). It always has 9 numbered
manual steps. Do not delete the report until every step is disposed
of; record the disposition in the PR description.

1. Finalise the design: fill the 10-item requirements table in the
   generated design doc with the approved design. Display name,
   subtitle, icon, and default player counts in the skeleton are
   placeholders. Identity presets also replace the `TODO_IDENTITY`
   placeholder identities with the real identity table.
2. Fill gameplay: grep `TODO(gameplay)` inside the new game's three
   directories and fill each one — state machine in
   `domain/decision.ts` / `engine.ts`, privacy projection in
   `domain/visibility.ts`. Unfilled example commands reject as not
   implemented (`engine.test.ts.tmpl`; `commands/types.ts.tmpl`).
3. Fill the review: the review (本局复盘) is wired end to end — module
   `review`, the ended bottom entry for every viewer, the host sheet
   action and the ended choice task (review / next round / return to
   lobby); the dialog and image sharing are the platform's. The
   skeleton document holds only the ended hero and the participant
   roster: put the round's facts (outcome, identities, scores,
   course) into `packages/web/src/games/<gameId>/review/to<Game>ReviewDocument.ts`,
   set availability and sharing in `review/<gameId>Review.ts`, and
   update `review/__tests__/<gameId>Review.test.ts` with them. The
   block vocabulary is closed (`packages/web/src/features/room/review/types.ts`):
   extend the platform vocabulary first; a game writes no review JSX.
4. Confirm reward numbers: the three flat amounts are placeholders;
   change them in `product/rewards/earnings.ts` (the registry entry
   references the same constants).
5. Review the migration: the generated file is mechanically derived
   from the latest registration migration. Verify the rebuild set
   against the current schema by hand; add game-owned tables to the
   same file at its TODO.
6. E2E activation: the spec skeleton is
   `e2e/specs/<gameId>.spec.ts.tmpl` and is not in CI by default.
   Activating it means renaming it to `<gameId>.spec.ts` and adding
   the filename to the e2e shard matrix in `.github/workflows/ci.yml`;
   until then, it stays a `.tmpl`.
7. Word supply, if needed: three registrations (see
   `references/skeleton-and-wiring.md`). The skeleton carries no
   workflow body.
8. Re-run the gates: root `tsc --noEmit`, the `packages/web`
   `tsc --noEmit`, engine / worker / web vitest, `pnpm run knip`, and
   prettier/eslint on the changed files — all green before opening a PR.
9. Go live: if generated with `--production`, add the id to
   `PRODUCTION_GAME_TYPES` in
   `packages/web/src/games/__tests__/homeProductionFilter.contract.test.ts` in
   `GAME_TYPES` order. Otherwise, in the same PR, flip
   `isProduction` to `true` in the registry entry AND add the id to
   that list. Changing only one is caught by the contract test
   (`homeProductionFilter.contract.test.ts` expects the production
   list to equal the `isProduction` games exactly).
