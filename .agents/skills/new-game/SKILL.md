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
   capability selection and output counts.
2. `references/registration-checklist.md` — registration and statistics wiring.
3. `references/capabilities-and-report.md` — capability selection and the 9
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
decisions now, not during implementation: the capability selection (see Step 3)
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

### 3. Select capabilities

Enable only the capabilities the design requires, using
`references/capabilities-and-report.md`. All capabilities default off.
`botBulkViewing` requires `identityViewing`; deadline arming behavior is
derived from `identityViewing` together with `stageDeadline`.

### 4. Run the generator, once

```sh
pnpm new-game <gameId> --capability identityViewing --capability stageDeadline --name <中文名> --subtitle <一句话玩法>
```

See `references/generator.md` for the remaining options. One run
writes the engine, worker, and web client skeleton (the client under
`packages/web/src/games/<gameId>/`, mirroring the generator's game templates, and
registered in `packages/web/src/games/catalog.ts` and the static factories
of `packages/web/src/games/clientModules.tsx`, so the new game counts
as ported), edits the shared files, and creates completed-games
statistics end to end: strict v2 completion facts, owned cumulative
D1 table/schema, atomic reward-and-stat settlement, public DTO/parser/getter,
and a catalog-registered compact statistics panel for settings and
room profiles. It numbers the registration migration after the latest
physical SQL migration, independently deriving the rebuild body from
the latest registration migration (`nextMigrationName` and
`findLatestRegistrationMigration` in `migration.mjs`; historical
registration migrations remain immutable), and writes the integration
report. Preflight validation fails before writing. Read any failure
output first: formatting/lint run after writing, so those failures
leave the complete generated game in place. Fix the reported files;
do not rerun the generator against an already registered id.

### 5. Dispose of all 9 report steps

Work through the report's 9 steps in order
(`references/capabilities-and-report.md`; `report.mjs`,
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
Wire room-image preload before go-live: declare the role-portrait
asset list in `assets/roleAvatars.ts` (public board only — never from
a player's secret assignment) and call the shared
`useRoomImagePreload` hook in `use<Game>RoomState` with the full
room-image list (portraits plus any other room art, such as
vote/quest illustrations). If the game has audio, complete the generated registry/player and provide the
preload-audio list (`get<Game>PreloadAudio` form: per-board-role
clips like werewolf or a fixed set like avalon) and wire it into the
audio binding's `prepareQueue`; games without audio (fibking,
undercover) state that explicitly and wire nothing.
For narrated games, follow `scripts/README-audio.md`: add the game's
cue text and output mapping to `scripts/generate_audio_edge_tts.py`,
generate and bundle canonical MP3 assets, and resolve engine audio keys
through a game-owned `AudioClip` registry/player using the shared
`AudioService` (see `packages/web/src/games/avalon/audio/AvalonAudioPlayer.ts`).
Do not substitute browser `SpeechSynthesis` for this asset pipeline;
verify both the generator dry-run and the generated files.
The audio capability must keep its generated module-to-hook runtime injection;
do not replace it with `null`. Missing cues and playback errors surface through
the shared error pipeline and never acknowledge required narration as successful.
Reuse `useRoomAudioOrchestration`, `useRoomAudioResume`, `RoomAudioResumeDialog`,
and `useRoomBgmControl`; do not recreate their lifecycle in a game hook.
Define each narrated step's cue, eligible actors, private information, pending
and confirmed guidance, and completion gate together. Verify the actual MP3s,
role/count variants, interruption recovery, music/volume controls and both
confirmation/ack arrival orders; nonempty copy and audio-file existence are not acceptance.
Count actual player-action/confirmation steps, not audio clips: opening, closing,
and dawn cues belong in audio batches around those steps. Assert the exact
current/total against the action plan. If closing narration runs after the phase
changes, keep subsequent actions locked and resume playback on rejoin until its batch is acknowledged.
Round-settled games must choose and change the label/unit; never silently
interpret rounds as games. Follow the statistics section of
`references/skeleton-and-wiring.md` for eligibility and compatibility.

Before implementing the HUD or ended screen, inspect the corresponding
production screens in existing games and the shared room components.
For `identityViewing`, preserve `RoomShell` seats throughout viewing, play
and ended, following Werewolf/Avalon: one `RoomGameSummary` configuration
card with public `BoardInfoContent` (collapsed after dealing), compact `RoomStatusSummary`
in the `seats.bottomSummary` slot when match records exist, and game details
in `RoomDialog`. The shared bottom action card renders the summary first,
then existing progress/messages and personal actions. Games own the summary's
phase visibility; keep it hidden during private identity/narration phases
unless the game design explicitly requires otherwise. Identity and personal actions belong to bottom actions;
private information belongs in explicit overlays, not a public header. When a night step reveals
other seats, use shared avatar color highlights (`resolveHighlight`, `danger` for known evil peers),
following Werewolf, not extra identity text badges. Derive highlights from the current viewer's
private projection and clear them after confirmation or leaving the step.
Test unauthorized viewers, spectators, role/count variants, and switching controlled bot seats.
Werewolf's sheriff HUD, Avalon and Secret Hitler use the same summary
presentation; supply game-owned content and visibility rather than
forking its markup or CSS. Preserve each game's detail-surface behavior.
Do not replace the board with a workspace or stack a large stage panel
above it. Without `identityViewing`, retain the generated workspace;
choose any specialized stage layout from the approved gameplay.
Every game, including non-identity games, uses the same configuration card:
game name/count, guide and available tools share its header, and public
configuration lives inside its disclosure. Do not add a separate game title,
another configuration frame or a nested header button. Preserve live status
outside the disclosure and do not invent unavailable strategy/notepad actions.
Reuse the matching shared surface, not merely its outer frame; extract
common presentation rather than copying CSS or importing another game's
components. A bare heading and ranking list is
not a completed ended screen: verify its ranking hierarchy, player/self
labels, reward eligibility copy, review/restart entry points, and mobile
layout alongside the in-play screen. Record the reused components and
ended-screen browser evidence in the integration report.

### 7. Wire capabilities, word supply, and E2E deliberately

Change a capability only wiring-first, declaration second, contract
row third (`capabilities.contract.test.ts` welds each declaration to
its wiring). Register a word-supply workflow in all three places
(registry `workerWorkflows`, `packages/api-worker/src/index.ts`
re-export, `wrangler.toml` `[[workflows]]` binding; see
`references/skeleton-and-wiring.md`). For E2E: the generated spec
skeleton stays a `.tmpl` and out of CI until activated (rename it to
`<gameId>.spec.ts` and add the filename to the e2e shard matrix in
`.github/workflows/ci.yml`; see `references/capabilities-and-report.md`).
Use the new-e2e-spec skill for activation and verify a single spec via
`e2e-single-spec.yml` and the actions API (`e2e/AGENTS.md`). When a spec is activated, it uses real multi-context seats and no
automated players to fill seats (`createPlayerContexts`, `e2e/fixtures/app.fixture.ts`).

### 8. Verify and open the PR

Run the check script beside this skill (see Acceptance commands)
and the acceptance commands. The PR
description lists: the generation command and selected capabilities, the report
steps' dispositions (including E2E not enabled, if so), capability
capability wiring, the design
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
the isolated fixtures exercise default, individual, combined, and all-on
capability selections. The check script imports `generatorFacts()` and `REPORT_STEP_COUNT`;
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
