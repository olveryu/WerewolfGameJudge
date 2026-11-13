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
   per-preset counts, demo provenance.
2. `references/registration-checklist.md` — registration and statistics wiring.
3. `references/presets-and-report.md` — preset choice and the 9
   report steps.
4. `references/skeleton-and-wiring.md` — skeleton modules,
   capabilities, identity viewing, word supply, confirmations.
5. The generated design-doc skeleton's 11-item requirements table
   (created by the generator; see Step 2).

Also read, before design, the room-shell contract
(`docs/room-shell-contract.md`).

## Steps

### 1. Gather the design inputs

Collect, asking for anything missing: game name, one-sentence
gameplay, player-count range and default, core loop, round structure,
timing and timeout behaviour, exact scoring formula, end conditions
and ranking, automated-player policy, and word-library need. Fix two
decisions now, not during implementation: the preset (see Step 3)
and the word-library shape (none, in-game preparation, background
supply, or both). Also specify reward policy (flat or levelRoll) and
numbers, terminal settlement unit, statistics facts/ownership, units,
denominators and zero-denominator display, timestamp precision,
history gaps/backfill and state/payload/D1 migration policy, immediate
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

### 3. Choose the preset

Choose by main shape using `references/presets-and-report.md`. If the
game matches neither preset exactly, start from the nearer one and
change capability declarations one at a time with their wiring.

### 4. Run the generator, once

```sh
pnpm new-game <gameId> --preset identity|stage|demo-hybrid --name <中文名> --subtitle <一句话玩法>
```

See `references/generator.md` for the remaining options. One run
writes the engine, worker, and web client skeleton (the client under
`packages/web/src/games/<gameId>/`, mirroring the web Demo, and
registered in `packages/web/src/games/catalog.ts` and the static factories
of `packages/web/src/games/clientModules.tsx`, so the new game counts
as ported), edits the shared files, and creates completed-games
statistics end to end: strict v2 completion facts, owned cumulative
D1 table/schema, atomic reward-and-stat settlement, public DTO/parser/getter,
and a catalog-registered compact statistics panel for settings and
room profiles. It numbers the registration migration after the latest
physical SQL migration, independently deriving the rebuild body from
the latest registration migration (`nextMigrationName` and
`findLatestRegistrationMigration` in `migration.mjs`; currently
74 migration files, latest physical `0075_werewolf_camp_aggregation.sql`,
registration source `0065_demo.sql`), and writes the integration
report. Preflight validation fails before writing. Read any failure
output first: formatting/lint run after writing, so those failures
leave the complete generated game in place. Fix the reported files;
do not rerun the generator against an already registered id.

### 5. Dispose of all 9 report steps

Work through the report's 9 steps in order
(`references/presets-and-report.md`; `report.mjs`,
`buildIntegrationReport`): finalise the design, fill every
`TODO(gameplay)`, fill the review document, confirm reward policy/numbers and statistics semantics,
review the migration by hand, keep the E2E skeleton inactive unless
Step 7 applies, register word supply in all three places if needed,
re-run the gates, and perform the go-live step. Keep the report file
until every step is disposed of. Record implementation plus verification
or an explicitly approved not-applicable reason; generated wiring and
green contracts alone are not proof that the gameplay metrics are done.

### 6. Fill gameplay into the skeleton

Fill the 11 skeleton modules
(`references/skeleton-and-wiring.md`): state machine and commands in
the engine, privacy projection per viewer, worker schemas and
effects, client screens and room state modules. Fill the review
document with the round's facts in the closed block vocabulary (see
`references/skeleton-and-wiring.md`, Review). Reuse the shared room
shell, host-management builders, config form, and shared components
first. Statistics default to one completed game per eligible terminal
completion, not arbitrary outcomes. Before go-live implement and verify
every approved gameplay metric, or explicitly approve completed-games-only.
Round-settled games must choose and change the label/unit; never silently
interpret rounds as games. Follow the statistics section of
`references/skeleton-and-wiring.md` for eligibility and compatibility.

### 7. Wire capabilities, word supply, and E2E deliberately

Change a capability only wiring-first, declaration second, contract
row third (`capabilities.contract.test.ts` welds each declaration to
its wiring). Register a word-supply workflow in all three places
(registry `workerWorkflows`, `packages/api-worker/src/index.ts`
re-export, `wrangler.toml` `[[workflows]]` binding; see
`references/skeleton-and-wiring.md`). For E2E: the generated spec
skeleton stays a `.tmpl` and out of CI until activated (rename it to
`<gameId>.spec.ts` and add the filename to the e2e shard matrix in
`.github/workflows/ci.yml`; see `references/presets-and-report.md`).
Use the new-e2e-spec skill for activation and verify a single spec via
`e2e-single-spec.yml` and the actions API (`e2e/AGENTS.md`). When a spec is activated, it uses real multi-context seats and no
automated players to fill seats (`createPlayerContexts`, `e2e/fixtures/app.fixture.ts`).

### 8. Verify and open the PR

Run the check script beside this skill (see Acceptance commands)
and the acceptance commands. The PR
description lists: the generation command and preset, the report
steps' dispositions (including E2E not enabled, if so), capability
differences from the preset defaults with their wiring, the design
review conclusions, and acceptance evidence. After merging, check
the main-branch CI result before closing the work.

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
`corepack pnpm run test contracts/newGameGenerator.contract.test.ts`:
the isolated fixtures exercise every preset and explicit Demo regeneration.
The check script imports `generatorFacts()` and `REPORT_STEP_COUNT`;
it has no drift-prone literal template/shared-edit counts.

## Pitfalls

1. Copying old counts — use `generatorFacts()` / the read-only check
   script, not duplicated literals. New formal games have statistics
   in every preset; `businessStats: false` is an internal, guarded
   non-production Demo reference-regeneration option, not a CLI escape hatch.
2. Calling the hand-built `demo` game generator output — it is a
   reference the `demo-hybrid` pack mirrors, not a generated game
   (`generate.mjs` header comment; demo files no template produces).
3. Hand-editing a contract expectation list to align it — a failure
   naming the game means wiring is missing
   (`engineSkeleton.contract.test.ts` checks each game by name; fix
   the wiring, not the expectation list).
4. Registering word supply in only one or two of the three places —
   verify workflow binding names and generated Env types as well as
   registry/re-export contracts; do not assume a contract proves deployment.
5. Filling seats with automated players in a new spec — automated
   players are test scaffolding only (`createPlayerContexts` in
   `e2e/fixtures/app.fixture.ts`; `planMarkBotsViewed`, the host
   scaffold in `packages/game-engine/src/platform/room/identityViewing.ts`).
6. Treating the minimum-human gate or `xpSettled` as gameplay completion:
   use the post-terminal state, count frozen humans before authorship
   filtering, and test abort/expiry/replay/restart separately. Legacy
   effects remain strictly reward-only; malformed v2 is an error, not legacy.
7. Marking all report steps “done” because the production list matches —
   approved metric semantics, real implementation, migration review/costs,
   and scoped acceptance evidence are also mandatory before go-live.
