# First-check map

First-check paths by symptom branch. Every path below was verified to exist at drafting time. The client is `packages/web/src/`; the React Native client in the repository-root `src/` was removed (last present in commit `ccedf18b5`). Only games with a loader in `CLIENT_GAME_LOADERS` (`packages/web/src/games/clientModules.tsx`) have web room UI; the others report unsupported by design until their port (`docs/web-client-rewrite.md` §8.2). Names that appeared in earlier versions of this skill but do not exist are listed at the end, with their replacements.

## Branch A — Client UI anomaly

| First-check path                                                             | Investigation focus                                                                     |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `packages/web/src/games/<game>/room/`, `packages/web/src/routes/`            | Game-owned room UI, policy hooks, route pages, conditional rendering                    |
| `packages/web/src/features/room/components/RoomEntryBoundary.tsx`            | Resolved-room session boundary; children render only when the entry controller is ready |
| `packages/web/src/features/room/controllers/useReadyRoomSession.ts`          | Authenticated, ready session: authoritative state and revision, single-flight submit    |
| `packages/web/src/features/room/controllers/useRoomEntryController.ts`       | Entry controller behind the boundary                                                    |
| `packages/web/src/contexts/`                                                 | Context provider mounting and value passing (`AuthContext.tsx`, `ServiceContext.tsx`)   |
| `packages/web/src/components/`, `packages/web/src/features/room/components/` | Shared controls, room surfaces, props, layout, and CSS                                  |
| `packages/web/src/app/AppRoot.tsx`, `packages/web/src/app/routes.tsx`        | Provider order, route tree, `RoomLinkScope`                                             |

Common root causes: a selector returning a new reference causing repeated rendering, a context not mounted, a conditional render missing a state.

## Branch B — Realtime / network issue

| First-check path                                                                                                                                                       | Investigation focus                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `packages/web/src/platform/realtime/RoomLink.ts`                                                                                                                       | Link implementation: snapshot, dispatch, connect, close                                     |
| `packages/web/src/platform/realtime/linkReducer.ts`                                                                                                                    | Pure connection state machine and backoff; no I/O, timers, or date reads inside the reducer |
| `packages/web/src/platform/realtime/LinkRuntime.ts`                                                                                                                    | Imperative shell around the reducer; timers and effects live here                           |
| `packages/web/src/platform/realtime/RoomLinkFactory.ts`                                                                                                                | Link factory; the single production instantiation site                                      |
| `packages/web/src/platform/realtime/SocketChannel.ts`                                                                                                                  | Socket adapter                                                                              |
| `packages/web/src/platform/realtime/CommandOutbox.ts`, `packages/web/src/platform/realtime/outboxStorage.ts`, `packages/web/src/platform/realtime/commandTransport.ts` | Durable dispatch, local persistence, and the single HTTP command send                       |
| `packages/web/src/platform/realtime/types.ts`                                                                                                                          | Link interface, snapshot phases, dispatch outcomes and options                              |
| `packages/web/src/app/AppRoot.tsx` (`RoomLinkScope`)                                                                                                                   | Room links released when the route leaves the room or the user changes                      |
| `packages/api-worker/src/app/GameRoom.ts`, `packages/api-worker/src/platform/room/`                                                                                    | Worker entry, WebSocket handling, shared room coordination                                  |
| `docs/realtime-link-redesign.md`                                                                                                                                       | Current-system design record only; its pre-redesign status tables describe the old system.  |

Common root causes: token refresh not happening, a cold-start race, a revision gap on reconnect.

## Branch C — Game logic bug

| First-check path                                                                                      | Investigation focus                                                             |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `packages/game-engine/src/games/<game>/`                                                              | Game-owned commands and logic; werewolf resolvers are under `domain/resolvers/` |
| `packages/game-engine/src/games/werewolf/domain/models/roles/spec/`                                   | Step order and schema constraints                                               |
| `packages/api-worker/src/app/GameRoom.ts`, `packages/api-worker/src/games/`                           | Worker game dispatch and persistence                                            |
| `packages/web/src/features/room/controllers/useReadyRoomSession.ts`, `packages/web/src/games/<game>/` | Client snapshots and game-owned interpretation                                  |

Common root causes: a resolver not handling a skip case, a step-order error, a write race in the worker.

## Branch D — API / worker error

| First-check path                                                                    | Investigation focus                                                          |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `packages/api-worker/src/features/`, `packages/api-worker/src/games/`               | Feature and game endpoints, request validation                               |
| `packages/api-worker/src/platform/http/`                                            | Shared HTTP handling and middleware                                          |
| `packages/api-worker/src/app/GameRoom.ts`, `packages/api-worker/src/platform/room/` | Worker calls and room persistence                                            |
| `packages/api-worker/src/db/index.ts`                                               | Typed database access layer over the relational store                        |
| `packages/api-worker/migrations/`                                                   | Hand-written SQL migrations; trace a column to the migration that created it |

Common root causes: a schema mismatch with the request body, a room identity construction error, a migration missing a column.

## Branch E — End-to-end test failure

| First-check path              | Investigation focus                                 |
| ----------------------------- | --------------------------------------------------- |
| `e2e/specs/<failing-spec>.ts` | Selector changes, wait logic                        |
| `e2e/helpers/night-driver.ts` | Role action helpers matching current UI             |
| `e2e/helpers/waits.ts`        | Wait conditions and their sufficiency               |
| `e2e/helpers/diagnostics.ts`  | Whether diagnostic data captures useful information |

Common root causes: a test identifier changed without a matching update, the socket not ready before an action, an insufficient timeout.

## Branch F — Performance issue

| First-check path                                                                                    | Investigation focus                                       |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `packages/web/src/routes/`, `packages/web/src/games/`, `packages/web/src/features/room/components/` | Unnecessary re-rendering, oversized lists                 |
| `packages/web/src/scene/`                                                                           | PixiJS scene layer frame time                             |
| `packages/web/src/services/`                                                                        | Frequent state updates, un-debounced operations           |
| `packages/web/scripts/check-bundle-size.mjs`                                                        | Per-route gzip budgets enforced by the web `build` script |
| Worker network inspection                                                                           | Request waterfall, oversized payloads                     |

Common root causes: a selector returning a new object each time, a large route chunk, audio preload blocking rendering.

## Removed names (do not use)

| Removed name                              | Why                                                                                                                                 | Replacement                                                                                                                                                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The repository-root `src/` client         | The React Native client was removed; the only client is the web package.                                                            | `packages/web/src/`                                                                                                                                                                                            |
| A shared `RoomSession` module             | There is no shared session module.                                                                                                  | `packages/web/src/features/room/components/RoomEntryBoundary.tsx`, `packages/web/src/features/room/controllers/useReadyRoomSession.ts`, `packages/web/src/features/room/controllers/useRoomEntryController.ts` |
| `ConnectionManager`, `CFRealtimeService`  | Old realtime services; neither exists. The cloudflare service directory holds the auth, avatar-upload, and room-directory adapters. | `packages/web/src/platform/realtime/` (see Branch B)                                                                                                                                                           |
| A game-owned `RoleRevealEffects/types.ts` | Reveal-effect types are shared room code.                                                                                           | `packages/web/src/features/room/components/RoleRevealEffects/types.ts`                                                                                                                                         |
