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
implementing; details beyond these names were not verified for this
draft.

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
re-export check in `architecture.contract.test.ts`; the third has no
contract test and fails silently at deploy time if missed
(`report.mjs`, step 7). The workflow body is hand-written at
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
