# Skeleton and wiring — verified surfaces only

## Engine skeleton: 11 modules

`REQUIRED_MODULES` in
`packages/game-engine/src/platform/__tests__/engineSkeleton.contract.test.ts`
(line 39): `engine.ts`, `public.ts`, `commands/types.ts`,
`domain/decision.ts`, `domain/evolve.ts`, `domain/visibility.ts`,
`state/codec.ts`, `state/parseState.ts`, `state/normalize.ts`,
`state/types.ts`, `state/version.ts`. Registered exceptions only, in
`REGISTERED_EXCEPTIONS` in the same test: werewolf (`domain/evolve.ts`
→ `domain/reducer/gameReducer.ts`, `domain/visibility.ts` →
`domain/playerHelpers.ts`, `state/normalize.ts` →
`domain/state/normalize.ts`, `state/types.ts` →
`domain/protocol/types.ts`) and storyrelay (`domain/visibility.ts` →
`domain/relay.ts`). A deviation is registered as an entry in
`REGISTERED_EXCEPTIONS`; a game with no entry must provide all 11
modules.

Layers: engine (`packages/game-engine/src/games/<game>/`) owns pure
logic and is the sole authority; the worker module owns routes,
`z.strictObject` schemas, and workflows, and writes no gameplay
logic; the client (`packages/web/src/games/<game>/`) renders and reports intent
only. The state shape carries a version (`state/version.ts` template);
a shape change writes a `migratePersisted*State` (defined in
`state/parseState.ts`, exported via `public.ts`) and registers it in
the worker module (`module.ts` template, `migratePersistedState`).

## Capabilities: wiring first, declaration second

The only declaration site is `capabilities` in the game's `engine.ts`.
To change one: (1) wire or remove the underlying capability, (2)
change the declaration, (3) update the game's expectation row in
`packages/game-engine/src/platform/engine/__tests__/capabilities.contract.test.ts`.
The contract checks declaration against wiring in both directions
(`capabilities.contract.test.ts`, 'game capabilities wiring welds');
changing only one side fails.

## Identity viewing and the test scaffold

Identity games use the platform protocol in
`packages/game-engine/src/platform/room/identityViewing.ts`
(`haveAllViewed`, `buildIdentityViewingParticipants`,
`planMarkBotsViewed` / `decideMarkBotsViewed`). The checkpoint
requires every seat's viewing record, including seats filled by
automated players (`haveAllViewed` checks every participant;
participants carry `isBot`). The command vocabulary is
`<game>.bots.markAllBotsViewed` (verified in the generator
templates). Automated players are test scaffolding
(`botTestScaffold` capability; `planMarkBotsViewed` in
`identityViewing.ts`).

Roster and takeover use the platform structures:
`packages/game-engine/src/platform/room/seating/` (roster decisions
and selectors) and the shared `useBotTakeover` assembly in
`packages/web/src/features/room/controllers/`. Read the platform files before
implementing and preserve each game's in-game click and lifecycle policies.

## Statistics and settlement

Every formal generated game ships a truthful completed-games baseline:

- Engine `publicStats.ts` owns its typed public DTO/parser and exact v2
  completion schema. `public.ts` is the only cross-package export.
- The terminal seam first evolves terminal events, then builds facts
  using `buildGameCompletionPayloadV2`. The minimum-human gate counts
  pre-filter humans in seat order; anonymous humans count toward the
  threshold, bots do not. Creative games must freeze their roster and
  apply author filtering after counting, mapping facts to the same
  filtered ordered recipients. Host-controlled bot actions belong to bots.
- Worker `effects.ts` accepts a union of two strict shapes: old completion
  payload (original rewards only), or complete v2 facts. Partial/malformed
  v2 cannot downgrade to legacy. Do not remove compatibility without
  reviewing in-flight and replayable effects and explicit approval.
- `<id>_user_stats` is a game-owned cumulative table declared once in
  `dbSchema.ts`, created by the registration migration, keyed by user,
  with account-delete cascade and a nonnegative integer count. It has no
  `game_type` constraint or per-game history ledger.
- `publicUserStats.ts` supplies `countGameStats` to `publishGameRewards`.
  The existing account helpers apply game counters and rewards in the
  same D1 batch/`stats_applied` boundary; only registered reward recipients
  accumulate and retries do not recount. Do not create a second deduper.
- Worker module hooks `parsePublicUserStats` / `getPublicUserStats` bind
  the existing authenticated `/api/games/:gameType/users/:userId/stats`
  route; no additional game HTTP route is required.
- Web query service uses `publicGameStatsOptions`, and `CLIENT_GAMES`
  binds `AccountStats` to the game-owned shared `GameStatsPanel`.
  Settings resolve that catalog contribution; the room hook calls
  `useGameProfileDetails` and its screen binds the same panel through
  `profileDetailsRenderer`. The
  callback supplies unknown on pending/error and the actual count on
  success, without changing existing item-unlock/equipment permissions. The account inbox
  invalidates this query key on rewards; do not add another cache channel.

The baseline counts one terminal completion, not wins/scores or a promise
of complete gameplay metrics. Before go-live approve and implement metric
sources/ownership, units (including round-settled labels), denominators,
time precision, history gaps/backfill, state/payload/D1 migration policy
and immediate/delayed visibility. Default is immediate and no invented
historical facts; delay requires explicit visible-time/cache wiring.
Tests must cover terminal/repeated/restart/abort, threshold boundaries,
anonymous/bot/author ownership, strict legacy/v2, D1 atomic rollback/replay/
cascade/cost, HTTP and profile/settings loading/error/empty/count states.
Demo alone remains the explicit non-production/no-business-stat reference.

## Word supply: three registrations, no fewer

When `wordLibrary` is turned on, a word-supply workflow must be
registered in all three places (report step 7; the three existing
workflows — fibking, undercover, drawguess — are the examples):

1. Registry entry `workerWorkflows` in
   `packages/game-engine/src/games/registry.ts`.
2. Workflow re-export in `packages/api-worker/src/index.ts`.
3. `[[workflows]]` binding in `packages/api-worker/wrangler.toml`.

The first is pinned by the wordLibrary weld in
`capabilities.contract.test.ts`; the second by the workflow
re-export check in `architecture.contract.test.ts`; also inspect the
third's actual binding and generated Env types, rather than treating a
registry test as deployment evidence. The workflow body is hand-written at
`packages/api-worker/src/games/<game>/wordSupplyWorkflow.ts`. The
in-game preparation protocol
(`packages/game-engine/src/platform/room/preparation.ts`) and the
supply runtime (`packages/api-worker/src/platform/wordSupply/`) are
the existing mechanisms; read them before wiring either.

## Relay games

The shared relay machine lives in
`packages/game-engine/src/platform/room/relay/` (`assignment`,
`clock`, `evolve`, `gallery`, `tasks`, `types`) and is used by
pictionary and storyrelay. The `stage` preset does not pre-wire it.
A chain-style game wires it through a `domain/relay.ts` binding
module (pictionary, storyrelay).

## Review (本局复盘)

Every game declares its review once: `review` is a required field of
`defineClientGameModule` (`packages/web/src/games/model/defineClientGameModule.ts`),
and the bound room screen receives exactly that contribution. The
generator ships it wired in every preset (report step 3; demo is the
reference):

- `packages/web/src/games/<game>/review/to<Game>ReviewDocument.ts` — the pure
  `state → RoomReviewDocument` builder; the skeleton page is the
  ended hero plus the participant roster, built from the spectator
  view model, and a game that has not ended is a construction error.
- `packages/web/src/games/<game>/review/<game>Review.ts` — the contribution:
  `notEnded` before the end, then `available` to every viewer,
  shareable, with no confirmation.
- `review/__tests__/<game>Review.test.ts` — data assertions on the
  document and availability per phase and viewer, from a game played
  to the engine's terminal seam by the round builders in
  `packages/web/src/test-utils/<game>State.ts`.
- `packages/web/src/test-utils/<game>State.ts` also declares `<GAME>_REVIEW_ROUNDS`
  (lobby, ended, next round), which the generator registers in the
  cross-game contract `packages/web/src/__tests__/roomReview.contract.test.ts`.
- Room wiring: the room state hook calls `useRoomReview` and hands
  the overlay to the screen's `gameOverlays`; the adapter adds
  `buildReviewBottomButton(entry, 'secondary')` for every viewer
  while a review exists, `buildReviewHostAction(entry)` to the ended
  host section, and `hostReviewClosingTask()` as the ended task.

The block vocabulary is closed (`packages/web/src/features/room/review/types.ts`;
the renderer, export and share flow live in
`packages/web/src/features/room/review/`). The platform owns the dialog title, the
share title and the generated-by footer (`reviewCopy.ts`); a game
declares only its kicker, file stem, footer choice and pages. A game maps its facts onto blocks and
semantic tones; content the vocabulary cannot express is a platform
vocabulary extension first, never game-side review JSX.

## Confirmations

Confirmations use `showAlert` / `showPrompt` from
`packages/web/src/utils/alert.ts`, a queue rendered by the single
`AlertHost` dialog (`packages/web/src/components/AlertHost.tsx`)
mounted in `packages/web/src/app/AppRoot.tsx`. Toasts use the sonner
`Toaster` mounted there.
