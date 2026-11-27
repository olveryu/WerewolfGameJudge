# Capabilities and integration report

## Feature profile and derived capabilities

The generator takes a complete, explicit profile using repeated
`--feature <key=value>` arguments. Every field is required exactly once:

```sh
corepack pnpm new-game <gameId> \
  --feature identity=private --feature night=narrated \
  --feature guidedNarration=none --feature stageDeadline=enabled \
  --feature wordSupply=none --feature bots=enabled \
  --feature stats=enabled --feature rewards=flat
```

| Feature           | Allowed values                          | Derived capabilities and required behavior                                                                                        |
| ----------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `identity`        | `none`, `private`                       | `private` derives `identityViewing` and `revealAnimation`, plus `botBulkViewing` with `bots=enabled`; every seat must view.       |
| `night`           | `none`, `narrated`                      | `narrated` derives night steps, shared interaction, narration and catalogue acceptance; no separate step opt-in.                  |
| `guidedNarration` | `none`, `narrated`                      | `narrated` derives `audioOrchestration` but does not invent a night phase.                                                        |
| `stageDeadline`   | `none`, `enabled`                       | `enabled` derives deadline wiring and protocol tests. Identity viewing delays arming until play begins.                           |
| `wordSupply`      | `none`, `in-game`, `background`, `both` | Any supplied mode derives `wordLibrary`; the report requires the matching workflow and deployment integration.                    |
| `bots`            | `enabled`, `none`                       | `enabled` derives `botsAndTakeover`: bot seats, host takeover and their tests. `none` seats humans only; the Worker rejects bots. |
| `stats`           | `enabled`, `none`                       | `enabled` derives `businessStats`: owned stats table, completion stats payload and profile panel. Requires `rewards=flat`.        |
| `rewards`         | `flat`, `none`                          | `flat` derives `completion` settlement and flat rewards. `none` registers `{ policy: 'none' }` and emits no completion effect.    |

Unknown, missing, duplicate and invalid declarations fail during preflight,
before files are written. There is no CLI for choosing derived capabilities.
`hostConfig` is always wired by the base skeleton. Nearly every game declares
`bots=enabled`, `stats=enabled` and `rewards=flat`; declare `none` only for an
approved design reason recorded in the design document. Identity games with
bots automatically add bulk bot identity handling rather than relying on a
separately remembered option. `--xp`, `--draws` and `--daily-target` require
`rewards=flat`.

The generator's behavior-test contract is part of this mapping: base games
require host-only confirmed abort and bot setup tests; identity requires
all-bot viewing-gate, host bulk-view, and terminal review task tests;
narration requires engine queue, host-ack and client privacy/recovery tests;
deadlines require host/actor/expiry boundary tests. `FEATURE_TEST_REQUIREMENTS` names these files and cases;
generation fails if a required file or case disappears, and the generator
Vitest suite runs representative generated packages through their tests.

Every generated game includes host-only abort, resetting to the lobby without
settlement and preserving seats/configuration; the UI requires confirmation.
Audio-enabled games keep the narration lock and expose music settings in setup
and viewing phases. Add game-specific bot night-confirmation tools when the
rules require them; do not generate a fake night phase for games without one.

`identityViewing` also selects the role-game room layout: seats stay visible
after dealing, with one shared `RoomGameSummary` card, `BoardInfoContent` and public role
previews; identity actions remain in the bottom model. It does not generate
a second identity workspace. With this capability off, the existing
non-identity workspace remains; do not invent a role board for drawing or
other stage-based play. Special gameplay layouts still require design approval.
At the end, identity games mark review as pending for the host and seated
players until they close it; spectators have no pending task, and the host can
still restart after confirmation without viewing it. Other games keep review
optional.
Both branches generate the same single game-name/count and guide header;
collapse controls appear only when public content exists. Games without roles
still have a configuration card in the lobby.
Fill actual public parameters through `RoomGameSummary.settings`; do not
reintroduce a concatenated configuration subtitle or game introduction.

The capabilities contract checks each generated declaration against its
wiring. Change a capability only with its corresponding wiring and contract
expectation. Statistics are always generated and are not a capability.
With `audioOrchestration`, the generator creates the clip registry, AudioService
player, module injection and hook; it never binds `audio: null`. Approved cue
text and generated MP3s remain game-specific work, with explicit missing-cue
errors and no batch acknowledgement on playback failure.
It also wires the shared orchestration hook, rejoin resume dialog, and host
music/volume controls. Games must extend the narrated-phase/music predicate to
cover their real steps, including waits for player confirmation. Rejoin replay
must preserve all required cues; it must not acknowledge a partly replayed batch.

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
   example commands reject as not implemented. Add engine tests for every
   approved transition, invariant, boundary and rejection; keep the
   `notImplemented` regression until real gameplay replaces the scaffold.
3. Fill the review: the review (本局复盘) is wired end to end — module
   `review`, the ended bottom entry for every viewer, the host sheet action
   and the ended choice task (review / next round / return to lobby); the
   dialog and image sharing are the platform's. Put the round's facts
   (outcome, identities, scores, course) into
   `packages/web/src/games/<gameId>/review/to<Game>ReviewDocument.ts`, set
   availability and sharing in `review/<gameId>Review.ts`, and update the
   associated tests with approved terminal facts, identity/score ownership,
   round identity and host/seated/spectator visibility. The block vocabulary is closed:
   `packages/web/src/features/room/review/types.ts`; extend the platform
   vocabulary first, and do not write game-specific review JSX.
4. Confirm reward policy/numbers and statistics semantics. The generator
   keeps flat rewards; approve flat or levelRoll explicitly, and confirm
   values in `packages/game-engine/src/product/rewards/earnings.ts` (the
   registry references the same constants). Generated statistics provide
   one completed game per eligible terminal completion. Approve and
   implement gameplay metrics or explicitly approve count-only; specify
   units/round labels, facts/ownership, denominators, time precision,
   missing history, migration, and visibility/cache policy. Add each
   approved metric's source, unit, ownership, denominator and zero-denominator
   assertions to engine `__tests__/publicStats.test.ts` and Worker
   `__tests__/publicUserStats.test.ts`; DTO shape and catalog wiring alone
   are not semantic coverage.
5. Review the migration: the generator planned it from the replayed
   current schema (`references/generator.md`); it inserts one `game_types`
   row, no word-library rows, and rebuilds no table. It is a starting point, not a template: check it
   against the current schema and this game's requirements, review the
   cumulative completed-games table it creates, and update its
   `contracts/d1MigrationManifest.json` sha256 if you edit it. No extra
   history or index is implied.
6. E2E activation: the spec skeleton is
   `e2e/specs/<gameId>.spec.ts.tmpl` and is not in CI by default. Activating
   it means renaming it to `<gameId>.spec.ts` and adding the filename to the
   e2e shard matrix in `.github/workflows/ci.yml`.
7. Word supply, if needed: make all three registrations described in
   `references/skeleton-and-wiring.md`, including the explicit
   `workflowName` and `binding` registry metadata, then regenerate
   `worker-configuration.d.ts`. The skeleton carries no workflow body.
   The word-library catalog (same entries as `--word-category`) is
   generated from that list by the generator; the registration migration
   seeds no `word_games` / `word_categories` rows
   (`references/registration-checklist.md` item 7). Joining the shared
   supply contract stays manual and lands with its adapters, code and D1
   projection in one change: the supply migration's `word_games` /
   `word_categories` inserts (the report renders them from the same
   list), the
   `GAME_WORD_GAMES` entry, the `WORD_CATEGORY_CATALOGS` entry
   (`packages/game-engine/src/games/wordCategoryCatalogs.ts`), and every
   map keyed by `GameWordGame` that typecheck then names; draw rows (`word_draw_index` / `word_draw_ordinals`) are
   only needed for a pool using the shared draw and land with the supply
   migration, not the registration migration.
8. Re-run scoped engine/Worker/web tests and affected contracts, root
   `tsc --noEmit`, changed-package typechecks, `knip`, the skill check, and
   changed-file prettier/eslint. Full suites/quality/E2E belong to CI.
   Include gameplay and privacy behavior, statistics eligibility, strict
   legacy/v2, atomic rollback/replay, HTTP/profile/settings loading/error/
   empty/count/unlock/cache, and D1 migration data/index/foreign-key evidence.
9. Go live: if generated with `--production`, the generator already adds the id to
   `PRODUCTION_GAME_TYPES` in
   `packages/web/src/games/__tests__/homeProductionFilter.contract.test.ts`
   in `GAME_TYPES` order and sets `isProduction: true`. Otherwise, in the same PR, flip `isProduction`
   to `true` in the registry entry and add the id to that list. Changing
   only one is caught by the contract test.
   The CLI and report state actual directory visibility; registration alone
   does not expose a game, and an explicit production selection is not deployment.

Each step's disposition is implementation plus verification, or an
explicitly approved not-applicable reason. Matching the production list
and green contracts is not sufficient: unapproved semantics, unimplemented
metrics, missing migration review, or incomplete verification block go-live.
