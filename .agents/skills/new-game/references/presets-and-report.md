# Presets and the integration report

## Presets

`PRESET_CAPABILITIES` in `scripts/lib/new-game/generate.mjs` (line 59).
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
  settle channel (no public `phase.expire` channel) → `demo-hybrid`
  (`PACK_SEGMENT_SWITCHES`, line 111: `armDeadlineAtBegin: true`,
  `internalSettleOnly: true`, `publicExpire: false`).

Expiry-channel difference (`PACK_SEGMENT_SWITCHES`, line 111): `stage`
ships the dual channel (public `phase.expire` client acceleration
plus internal settle); `demo-hybrid` ships the internal settle
channel only and arms the deadline when play begins. A hybrid that
matches neither preset starts from the nearer preset and changes
capability declarations one at a time with wiring (see
`references/skeleton-and-wiring.md`).

## Integration report: 8 steps

The generator writes `new-game-<gameId>-report.md` at the repo root
(`report.mjs`, `buildIntegrationReport`). It always has 8 numbered
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
3. Confirm reward numbers: the three flat amounts are placeholders;
   change them in `product/rewards/earnings.ts` (the registry entry
   references the same constants).
4. Review the migration: the generated file is mechanically derived
   from the latest registration migration. Verify the rebuild set
   against the current schema by hand; add game-owned tables to the
   same file at its TODO.
5. E2E activation: the spec skeleton is
   `e2e/specs/<gameId>.spec.ts.tmpl` and is not in CI by default.
   Activating it means renaming it to `<gameId>.spec.ts` and adding
   the filename to the e2e shard matrix in `.github/workflows/ci.yml`;
   until then, it stays a `.tmpl`.
6. Word supply, if needed: three registrations (see
   `references/skeleton-and-wiring.md`). The skeleton carries no
   workflow body.
7. Re-run the gates: `tsc --noEmit`, engine and worker vitest, root
   jest, `pnpm run knip`, and prettier/eslint on the changed files —
   all green before opening a PR.
8. Go live: if generated with `--production`, add the id to
   `PRODUCTION_GAME_TYPES` in
   `src/games/__tests__/homeProductionFilter.contract.test.ts` in
   `GAME_TYPES` order. Otherwise, in the same PR, flip
   `isProduction` to `true` in the registry entry AND add the id to
   that list. Changing only one is caught by the contract test
   (`homeProductionFilter.contract.test.ts` expects the production
   list to equal the `isProduction` games exactly).
