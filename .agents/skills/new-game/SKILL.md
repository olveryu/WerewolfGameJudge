---
name: new-game
description: 'Add a new party minigame end to end: approve the design first, run the new-game generator, dispose of all 8 integration-report steps, fill gameplay, wire capabilities and word supply, then verify. Use when adding a game; never for a new role, board, or change to an existing game.'
---

# New game

A new game grows from the generator. Design first, generation second,
completion after. Never start from a hand-copied game directory, and
never maintain the registration list by hand: the generator writes it
and contract tests check it. User-facing output is in Chinese.

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
  the generator refuses to overwrite; do not delete generated files to
  force a re-run.

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

Also read, before design: the room-shell contract
(`docs/room-shell-contract.md`) and at least one existing game's
design doc, to learn the expected granularity.

## Steps

### 1. Gather the design inputs

Collect, and ask for anything missing instead of guessing: game name
(2–6 characters, no player-count suffix), one-sentence gameplay,
player-count range and default, core loop, round structure, timing
and timeout behaviour, exact scoring formula, end conditions and
ranking, automated-player policy, and word-library need. Fix two
decisions now, not during implementation: the preset (see Step 3)
and the word-library shape (none, in-game preparation, background
supply, or both — the two shapes stack, with the supply chain
feeding the preparation protocol).

### 2. Present the design and wait for explicit approval

Write the full proposal — design doc draft covering gameplay,
player counts and setup, lobby behaviour, config items, the complete
state machine, every command's input/output/permission/failure copy,
timing, scoring, automated-player behaviour, word library if any,
settlement and rewards, and the test plan; plus the change points,
impact scope, and alternatives. The design doc enters the repo with
the PR and stays in sync with later copy/semantics changes. Do not
run the generator or write game code until the proposal is explicitly
approved. Approval of the direction alone does not approve unlisted
visible changes.

### 3. Choose the preset

Choose by main shape using `references/presets-and-report.md`. If the
game matches neither preset exactly, start from the nearer one and
change capability declarations one at a time with their wiring.
Never reshape the design to fit a preset.

### 4. Run the generator, once

```sh
pnpm new-game <gameId> --preset identity|stage|demo-hybrid --name <中文名> --subtitle <一句话玩法>
```

See `references/generator.md` for the remaining options. One run
writes the skeleton, edits the 15 shared files, derives the
registration migration from the latest registration migration
(64 migration files exist; the latest registration migration is
`0065_demo.sql`), and writes the integration report. If the run
aborts, read its output first; never edit generated output to work
around a generator failure.

### 5. Dispose of all 8 report steps

Work through the report's 8 steps in order
(`references/presets-and-report.md`): finalise the design, fill every
`TODO(gameplay)`, confirm reward numbers, review the migration by
hand, keep the E2E skeleton inactive unless its activation is
approved (Step 7), register word supply in all three places if
needed, re-run the gates, and perform the go-live step. Keep the
report file until every step is disposed of, and record each
disposition in the PR description.

### 6. Fill gameplay into the skeleton

Fill the 11 skeleton modules
(`references/skeleton-and-wiring.md`) without changing their shape:
state machine and commands in the engine, privacy projection per
viewer, worker schemas and effects, client screens and room state modules.
Reuse the shared room shell, host-management builders, config form,
and shared components first; do not build a second lobby, config
page, or room shell. Keep the design doc in sync with any copy or
semantics change.

### 7. Wire capabilities, word supply, and E2E deliberately

Change a capability only wiring-first, declaration second, contract
row third. Register a word-supply workflow in all three places or
not at all, and never ship an empty word table. For E2E: a new game
gets no new spec by default — updating an existing spec is the
normal case, and a new spec needs a report and approval first (see
the new-e2e-spec skill). When a spec is approved, it uses real
multi-context seats and no automated players to fill seats.

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

Full quality verification runs in CI; the commands above are the
local pre-push scope. Run formatting and lint checks on the changed
files as well.

## Pitfalls

1. Copying the old counts (13 shared edits; 40/40 files) — the
   verified counts are 15 edits and 38/37/39 files by preset.
2. Calling the hand-built `demo` game generator output — it is a
   reference the `demo-hybrid` pack mirrors, not a generated game.
3. Hand-editing a contract expectation list to align it — a failure
   naming the game means wiring is missing; fix the wiring.
4. Registering word supply in only one or two of the three places —
   the binding with no contract test fails silently at deploy time.
5. Activating the E2E skeleton without approval, or filling seats
   with automated players in a new spec — both need a report first,
   and automated players are test scaffolding, never player-facing.
