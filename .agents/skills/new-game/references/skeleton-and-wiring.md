# Skeleton and wiring — verified surfaces only

## Engine skeleton: 11 modules

`REQUIRED_MODULES` in
`packages/game-engine/src/platform/__tests__/engineSkeleton.contract.test.ts`
(line 39): `engine.ts`, `public.ts`, `commands/types.ts`,
`domain/decision.ts`, `domain/evolve.ts`, `domain/visibility.ts`,
`state/codec.ts`, `state/parseState.ts`, `state/normalize.ts`,
`state/types.ts`, `state/version.ts`. Registered exceptions only:
werewolf (reducer architecture; evolve, normalize, and state types
live in `domain/` subdirectories) and storyrelay (viewer projection
in `domain/relay.ts`, because it runs on the shared relay machine).
A new game does not claim an exception: to deviate, register it in
the contract first and get it reviewed, then write code.

Layers: engine (`packages/game-engine/src/games/<game>/`) owns pure
logic and is the sole authority; the worker module owns routes,
`z.strictObject` schemas, and workflows, and writes no gameplay
logic; the client (`src/games/<game>/`) renders and reports intent
only. The state shape carries a version; any shape change bumps the
version, writes a `migratePersisted*State`, and registers it in the
worker module — an unregistered migration bricks stored rooms.

## Capabilities: wiring first, declaration second

The only declaration site is `capabilities` in the game's `engine.ts`.
To change one: (1) wire or remove the underlying capability, (2)
change the declaration, (3) update the game's expectation row in
`packages/game-engine/src/platform/engine/__tests__/capabilities.contract.test.ts`.
The contract checks declaration against wiring in both directions;
changing only one side fails, and that failure is the contract
working — never edit the contract to pass.

## Identity viewing and the test scaffold

Identity games use the platform protocol in
`packages/game-engine/src/platform/room/identityViewing.ts`
(`haveAllViewed`, `buildIdentityViewingParticipants`,
`planMarkBotsViewed` / `decideMarkBotsViewed`). The checkpoint
requires every seat's viewing record, including seats filled by
automated players. The command vocabulary is
`<game>.bots.markAllBotsViewed` (verified in the generator
templates). Automated players are test scaffolding only: never
mention them in player-facing copy, guidance, or remediation text,
and never give the scaffold a product gate.

Roster and takeover use the platform structures:
`packages/game-engine/src/platform/room/seating/` (roster decisions
and selectors) and the shared `useBotTakeover` assembly in
`src/features/room/controllers/`. Do not build a per-game roster or
takeover mechanism. Details beyond these names were not verified for
this draft; read the platform files before implementing.

## Word supply: three registrations, no fewer

When `wordLibrary` is turned on, a word-supply workflow must be
registered in all three places (report step 6; the three existing
workflows — fibking, undercover, drawguess — are the examples):

1. Registry entry `workerWorkflows` in
   `packages/game-engine/src/games/registry.ts`.
2. Workflow re-export in `packages/api-worker/src/index.ts`.
3. `[[workflows]]` binding in `packages/api-worker/wrangler.toml`.

The first two are contract-pinned; the third has no contract test and
fails silently at deploy time if missed. The workflow body is
hand-written at `packages/api-worker/src/games/<game>/wordSupplyWorkflow.ts`.
Do not ship an empty word table. The in-game preparation protocol
(`packages/game-engine/src/platform/room/preparation.ts`) and the
supply runtime (`packages/api-worker/src/platform/wordSupply/`) are
the existing mechanisms; read them before wiring either, and do not
build a second supply chain.

## Relay games

The shared relay machine lives in
`packages/game-engine/src/platform/room/relay/` (`assignment`,
`clock`, `evolve`, `gallery`, `tasks`, `types`) and is used by
pictionary and storyrelay. The `stage` preset does not pre-wire it.
A chain-style game wires it through a `domain/relay.ts` binding
module and does not copy the machine into the game directory.

## Confirmations

Confirmations use `showAlert` / `showPrompt` from `src/utils/alert.ts`
(which drives `AlertModal` when a listener is set) or render
`AlertModal` (`src/components/AlertModal.tsx`) directly. Never call
the platform `Alert.alert` directly from UI code: on web it is a
no-op, and the only production caller is the fallback inside
`alert.ts` itself. Failure copy is Chinese, with the title naming the
specific action.
