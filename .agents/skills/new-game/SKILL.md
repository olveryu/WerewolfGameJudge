---
name: new-game
description: 'Add a new party minigame end to end: run the new-game generator, dispose of all 9 integration-report steps, fill gameplay, wire capabilities, rewards, statistics and word supply, then verify. Use when adding a game; never for a new role, board, or change to an existing game.'
---

# New game

A new game grows from the generator. Design first, generation second,
completion after. Start from the generator: registration edits are
`SHARED_EDITS` in `scripts/lib/new-game/generate.mjs`, checked by the
contract tests listed in `references/registration-checklist.md`.
User-facing output is in Chinese.

## When to use

Use when adding a new playable game to the platform.

Do not use when:

- adding a werewolf role (use the new-role skill) or a preset board
  (use the new-board skill);
- changing gameplay in an existing game — that is an ordinary feature
  change, not a new game;
- the request is only a design discussion with no build approval yet —
  stop after Step 2;
- the game id already exists or the generator has already run for it —
  the generator refuses to overwrite an existing target
  (`generate.mjs`, `Refusing to overwrite existing file`).

## Must-read references

1. `references/generator.md` — generator-derived shared edits and templates,
   feature declarations, derived capabilities, test obligations and output counts.
2. `references/registration-checklist.md` — registration and statistics wiring.
3. `references/capabilities-and-report.md` — feature-derived capabilities and the 9
   report steps.
4. `references/skeleton-and-wiring.md` — skeleton modules,
   capabilities, identity viewing, word supply, confirmations.
5. The generated design-doc skeleton's 11-item requirements table
   (created by the generator; see Step 2).

Also read, before design, the room-shell contract
(`docs/room-shell-contract.md`).

## Requirement authority

- Do not add product restrictions on starting, participating, identity
  assignment, or directory visibility without a cited game rule, an applicable
  repository contract, or explicit user confirmation. A reward/statistics
  eligibility threshold is not a gameplay or start gate.
- Implementation difficulties do not authorize new gameplay rules or hidden
  entry points. Ask before making behavior-changing tradeoffs; do not silently
  restrict the product to simplify implementation.
- In the design and integration report, distinguish sourced rules, explicitly
  confirmed user decisions, and proposals awaiting confirmation. Cite the source
  or confirmation for restrictions; never label an implementation assumption
  as approved. Keep registration and directory visibility distinct, and dispose
  of the go-live step rather than silently leaving the game hidden.

## Steps

### 1. Gather the design inputs

Collect, asking for anything missing: game name, one-sentence
gameplay, player-count range and default, core loop, round structure,
timing and timeout behaviour, exact scoring formula, end conditions
and ranking, automated-player policy, and word-library need. Fix two
decisions now, not during implementation: the complete feature profile (see Step 3)
and the word-library shape (none, in-game preparation, background
supply, or both). Host-controlled bot seats and host takeover are a
platform baseline for every game, not selectable features. Also specify reward policy (flat or levelRoll) and
numbers, terminal settlement unit, statistics facts/ownership, units,
denominators and zero-denominator display, timestamp precision,
history gaps/backfill and payload/D1 migration policy (game state has no
compatibility migration unless explicitly requested), immediate
or delayed visibility and cache revalidation. Do not invent wins,
scores or a default metric from unrelated games.

### 2. Present the design

Write the full proposal — design doc draft covering gameplay,
player counts and setup, lobby behaviour, config items, the complete
state machine, every command's input/output/permission/failure copy,
timing, scoring, automated-player behaviour, word library if any,
settlement and rewards, and game statistics and the test plan; plus the change points,
impact scope, and alternatives. The design doc enters the repo with
the PR and stays in sync with later copy/semantics changes.

When the user requests a UI mock, follow the mock-to-production flow in
[game-ui-mock-design.md](../../../docs/game-ui-mock-design.md):

1. **Mock.** Use the local game preview (`packages/web/preview/`) and its
   coverage checklist. Reuse production pages and shared room components with
   offline scenario data; list excluded checklist items with reasons. Write the
   game's own UI as promotable components (props in, callbacks out, theme
   tokens, accessible names), never as one-off page copies.
2. **Promote.** Once the user confirms the mock, production moves or reuses
   those components and their interaction structure (hand card → dialog,
   dialog titles and button names). Any deviation from the confirmed mock needs
   the user's approval first; do not redraw a confirmed component.
3. **Shared names and builders.** Use the shared room builders and wording
   rather than game-specific copies: `buildClearSeatsAction` (清空座位),
   `buildResetToLobbyAction` (重新开始), `buildStartGameAction`,
   `GameSettingsStepper`, `RoomDialog` opened from the action hand,
   `RoomGameSummary` / `BoardInfoContent` / `RoleCardDialog` for public info.
4. **Preview the real game.** After implementation, the preview renders the
   real config and room screens through `createPreviewRoomLink` with the real
   engine and the server's per-user projection; scenarios are built by
   engine commands. Delete the mock copies, and compare against the confirmed
   mock screenshots before delivery.

Previewing a design does not implement its rules or replace tests.

### 3. Declare game features

Complete every feature field explicitly using
`references/capabilities-and-report.md`: identity (`none|private`),
night (`none|narrated`), guided narration (`none|narrated`), stage deadline
(`none|enabled`), word supply (`none|in-game|background|both`), bots
(`enabled|none`), statistics (`enabled|none`) and rewards (`flat|none`).
Nearly every game declares `bots=enabled`, `stats=enabled` and
`rewards=flat`; `none` needs an approved reason in the design document, and
statistics require rewards.
The generator derives capabilities and required behavior tests from this
profile. Private identities automatically require per-seat identity viewing,
bulk bot identity handling and reveal animation; narrated night actions
automatically require `nightPhase`, shared engine steps, shared client
interaction, audio orchestration, and reviewed-catalogue coverage; other guided
narration requires audio orchestration without inventing a night phase.
Every profile must declare all eight fields. Do not select or edit derived
capabilities directly.

Narrated-night generation registers its catalogue and documentation entry,
but never generates an approved baseline. Replace the TODO step and add formal
command scenarios; empty scenarios and unfinished copy deliberately fail the
catalogue tests. Review differences through `catalogue:check`, get confirmation,
then explicitly run `catalogue:update --reviewed <gameId>-night`.

### 4. Run the generator, once

```sh
corepack pnpm new-game <gameId> --feature identity=none --feature night=none --feature guidedNarration=none --feature stageDeadline=none --feature wordSupply=none --feature bots=enabled --feature stats=enabled --feature rewards=flat --name <中文名> --subtitle <一句话玩法>
```

Replace each feature value with the approved profile; all eight declarations
are required and duplicate/unknown fields fail before writing. See
`references/generator.md` for options and generated outputs. Preflight computes
all templates, shared edits and the migration
before writing; a duplicate game id is never overwritten. Formatting/lint errors
after writing leave the game in place—fix those files rather than rerunning.

### 5. Dispose of all 9 report steps

Complete the generated report in order using
`references/capabilities-and-report.md`. Keep it until every step has
implementation and verification evidence, or an explicitly approved
not-applicable reason. Generated wiring and green contracts alone do not prove
gameplay or statistics are complete.

### 6. Fill gameplay into the skeleton

Follow `references/skeleton-and-wiring.md` for the 11 modules, layer boundaries,
shared room UI, privacy, audio, review, statistics, and required evidence.
Implement the approved design—not the generated examples—and resolve every
`TODO(gameplay)`. Reuse shared room components and record the required gameplay
and ended-screen verification in the integration report. Do not treat generated
wiring or passing contracts as proof that the game is complete.

### 7. Wire capabilities, word supply, and E2E deliberately

Wire capabilities before changing their declaration and contract row. Register
word supply in all three required locations only when approved. Keep E2E out of
CI until deliberately activated; use the `new-e2e-spec` skill and real
multi-context seats. See `references/capabilities-and-report.md` and
`references/skeleton-and-wiring.md`.

### 8. Verify and open the PR

Run the check script and scoped acceptance commands below, plus formatting
and lint for changed files. The PR records the generation command, selected
capabilities, report dispositions, design decisions and verification evidence.
After merging, check main-branch CI before closing the work.

## Acceptance commands

```sh
.agents/skills/new-game/scripts/check-new-game.sh .
corepack pnpm exec tsc --noEmit
corepack pnpm --filter @game-judge/web run typecheck
corepack pnpm --filter @game-judge/api-worker run typecheck
corepack pnpm --filter @game-judge/game-engine run test src/games/<gameId> src/platform/__tests__/engineSkeleton.contract.test.ts src/platform/__tests__/gameRegistry.contract.test.ts src/platform/__tests__/phaseDeadlineVariants.contract.test.ts src/platform/engine/__tests__/capabilities.contract.test.ts
corepack pnpm --filter @game-judge/api-worker run test src/games/<gameId> src/games/__tests__/catalog.test.ts
corepack pnpm --filter @game-judge/web run test src/games/<gameId> src/__tests__/roomReview.contract.test.ts src/__tests__/roomGuidanceMatrix.contract.test.ts src/games/__tests__/homeProductionFilter.contract.test.ts
corepack pnpm run test contracts/architecture.contract.test.ts contracts/ciE2eCoverage.contract.test.ts
corepack pnpm run knip
```

Full quality verification runs in CI (`.github/workflows/ci.yml`);
the commands above are the local scoped checks. Run formatting and
lint checks on the changed files as well. Replace `<gameId>` with the
actual id; include other affected contracts rather than running local
full suites. Generator changes additionally run
`corepack pnpm run test scripts/new-game.test.mjs`:
the Vitest suite checks representative feature profiles, required named behavior
tests, CLI preflight, and generated outputs with the real toolchain. The check script
imports `generatorFacts()` and `REPORT_STEP_COUNT`;
it has no drift-prone literal template/shared-edit counts.

## Pitfalls

1. Copying old counts — use `generatorFacts()` / the read-only check
   script, not duplicated literals. Every generated game includes the
   completed-games statistics baseline.
2. Hand-editing a contract expectation list to align it — a failure
   naming the game means wiring is missing
   (`engineSkeleton.contract.test.ts` checks each game by name; fix
   the wiring, not the expectation list).
3. Registering word supply in only one or two of the three places —
   verify workflow binding names and generated Env types as well as
   registry/re-export contracts; do not assume a contract proves deployment.
4. Filling seats with automated players in a new spec — automated
   players are test scaffolding only (`createPlayerContexts` in
   `e2e/fixtures/app.fixture.ts`; `planMarkBotsViewed`, the host
   scaffold in `packages/game-engine/src/platform/room/identityViewing.ts`).
5. Treating the minimum-human gate or `xpSettled` as gameplay completion:
   use the post-terminal state, count frozen humans before authorship
   filtering, and test abort/expiry/replay/restart separately. Legacy
   effects remain strictly reward-only; malformed v2 is an error, not legacy.
6. Marking all report steps “done” because the production list matches —
   approved metric semantics, real implementation, migration review/costs,
   and scoped acceptance evidence are also mandatory before go-live.
