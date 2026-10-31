---
name: new-game
description: 'Add a new party minigame end to end: run the new-game generator, dispose of all 8 integration-report steps, fill gameplay, wire capabilities and word supply, then verify. Use when adding a game; never for a new role, board, or change to an existing game.'
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

1. `references/generator.md` — 15 shared edits, 39 templates,
   per-preset counts, demo provenance.
2. `references/registration-checklist.md` — the 15 registration items.
3. `references/presets-and-report.md` — preset choice and the 8
   report steps.
4. `references/skeleton-and-wiring.md` — skeleton modules,
   capabilities, identity viewing, word supply, confirmations.
5. The generated design-doc skeleton's 10-item requirements table
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
supply, or both).

### 2. Present the design

Write the full proposal — design doc draft covering gameplay,
player counts and setup, lobby behaviour, config items, the complete
state machine, every command's input/output/permission/failure copy,
timing, scoring, automated-player behaviour, word library if any,
settlement and rewards, and the test plan; plus the change points,
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
writes the skeleton, edits the 15 shared files, derives the
registration migration from the latest registration migration
(64 migration files exist; the latest registration migration is
`0065_demo.sql`, via `findLatestRegistrationMigration` in
`scripts/lib/new-game/migration.mjs`), and writes the integration
report. If the run aborts, read its output first: edits are computed
in memory and written only after validation (`generate.mjs`
orchestration header), so a failed run leaves no half-registered game.

### 5. Dispose of all 8 report steps

Work through the report's 8 steps in order
(`references/presets-and-report.md`; `report.mjs`,
`buildIntegrationReport`): finalise the design, fill every
`TODO(gameplay)`, confirm reward numbers, review the migration by
hand, keep the E2E skeleton inactive unless Step 7 applies, register
word supply in all three places if needed, re-run the gates, and
perform the go-live step. Keep the report file until every step is
disposed of.

### 6. Fill gameplay into the skeleton

Fill the 11 skeleton modules
(`references/skeleton-and-wiring.md`): state machine and commands in
the engine, privacy projection per viewer, worker schemas and
effects, client screens and room state modules. Reuse the shared room
shell, host-management builders, config form, and shared components
first.

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
When a spec is activated, it uses real multi-context seats and no
automated players to fill seats (generated skeleton header).

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
pnpm exec tsc --noEmit
pnpm --filter @game-judge/game-engine run test
pnpm --filter @game-judge/api-worker run test
pnpm exec jest --no-coverage --forceExit
pnpm run knip
```

Full quality verification runs in CI (`.github/workflows/ci.yml`);
the commands above are the local scoped checks. Run formatting and
lint checks on the changed files as well.

## Pitfalls

1. Copying the old counts (13 shared edits; 40/40 files) — the
   verified counts are 15 edits and 38/37/39 files by preset
   (`check-new-game.sh`; `generate.mjs`, `SHARED_EDITS`).
2. Calling the hand-built `demo` game generator output — it is a
   reference the `demo-hybrid` pack mirrors, not a generated game
   (`generate.mjs` header comment; demo files no template produces).
3. Hand-editing a contract expectation list to align it — a failure
   naming the game means wiring is missing
   (`engineSkeleton.contract.test.ts` checks each game by name; fix
   the wiring, not the expectation list).
4. Registering word supply in only one or two of the three places —
   the `wrangler.toml` binding has no contract test (`report.mjs`,
   step 6), so a missing binding fails only at deploy time.
5. Filling seats with automated players in a new spec — automated
   players are test scaffolding only (generated skeleton header;
   `identityViewing.ts`, `planMarkBotsViewed`).
