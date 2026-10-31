# First-check map

First-check paths by symptom branch. Every path below was verified to exist at drafting time. Paths that appeared in the previous version of this skill but do not exist are listed at the end as removed, with their replacements, so a reader can see why they are gone.

## Branch A — Client UI anomaly

| First-check path                                                      | Investigation focus                                                                     |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/games/<game>/screens/`, `src/games/<game>/room/`, `src/screens/` | Game-owned UI, policy hooks, conditional rendering                                      |
| `src/features/room/components/RoomEntryBoundary.tsx`                  | Resolved-room session boundary; children render only when the entry controller is ready |
| `src/features/room/controllers/useReadyRoomSession.ts`                | Authenticated, ready session: authoritative state and revision, single-flight submit    |
| `src/features/room/controllers/useRoomEntryController.ts`             | Entry controller behind the boundary                                                    |
| `src/contexts/`                                                       | Context provider mounting and value passing (`AuthContext.tsx`, `ServiceContext.tsx`)   |
| `src/components/`, `src/features/room/components/`                    | Shared controls, room surfaces, props and layout                                        |

Common root causes: a selector returning a new reference causing repeated rendering, a context not mounted, a conditional render missing a state.

## Branch B — Realtime / network issue

| First-check path                                                                                                                | Investigation focus                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/platform/realtime/RoomLink.ts`                                                                                             | Link implementation: snapshot, dispatch, connect, close                                     |
| `src/platform/realtime/linkReducer.ts`                                                                                          | Pure connection state machine and backoff; no I/O, timers, or date reads inside the reducer |
| `src/platform/realtime/LinkRuntime.ts`                                                                                          | Imperative shell around the reducer; timers and effects live here                           |
| `src/platform/realtime/RoomLinkFactory.ts`                                                                                      | Link factory; the single production instantiation site is the app service composition point |
| `src/platform/realtime/SocketChannel.ts`                                                                                        | Socket adapter                                                                              |
| `src/platform/realtime/CommandOutbox.ts`, `src/platform/realtime/outboxStorage.ts`, `src/platform/realtime/commandTransport.ts` | Durable dispatch, local persistence, and the single HTTP command send                       |
| `src/platform/realtime/types.ts`                                                                                                | Link interface, snapshot phases, dispatch outcomes and options                              |
| `packages/api-worker/src/app/GameRoom.ts`, `packages/api-worker/src/platform/room/`                                             | Worker entry, WebSocket handling, shared room coordination                                  |
| `docs/realtime-link-redesign.md`                                                                                                | Current-system design record only; its pre-redesign status tables describe the old system.  |

Common root causes: token refresh not happening, a cold-start race, a revision gap on reconnect.

## Branch C — Game logic bug

| First-check path                                                            | Investigation focus                                                             |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `packages/game-engine/src/games/<game>/`                                    | Game-owned commands and logic; werewolf resolvers are under `domain/resolvers/` |
| `packages/game-engine/src/games/werewolf/domain/models/roles/spec/`         | Step order and schema constraints                                               |
| `packages/api-worker/src/app/GameRoom.ts`, `packages/api-worker/src/games/` | Worker game dispatch and persistence                                            |
| `src/features/room/controllers/useReadyRoomSession.ts`, `src/games/<game>/` | Client snapshots and game-owned interpretation                                  |

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

| First-check path                                              | Investigation focus                                   |
| ------------------------------------------------------------- | ----------------------------------------------------- |
| `src/screens/`, `src/games/`, `src/features/room/components/` | Large lists not virtualised, unnecessary re-rendering |
| `src/services/`                                               | Frequent state updates, un-debounced operations       |
| `src/features/*/controllers/`                                 | Memo and callback dependency breadth                  |
| Worker network inspection                                     | Request waterfall, oversized payloads                 |

Common root causes: a selector returning a new object each time, list items without memoisation, audio preload blocking rendering.

## Removed paths (do not use)

| Removed path                                               | Why                                                                                                                                                                 | Replacement                                                                                                                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/room/session/RoomSession.ts`                 | The directory does not exist; there is no shared `RoomSession` module. Per-game session models exist under `src/games/<game>/model/` as type aliases over the link. | `src/features/room/components/RoomEntryBoundary.tsx`, `src/features/room/controllers/useReadyRoomSession.ts`, `src/features/room/controllers/useRoomEntryController.ts` |
| `src/services/connection/ConnectionManager.ts`             | The directory does not exist.                                                                                                                                       | `src/platform/realtime/` (see Branch B)                                                                                                                                 |
| `src/services/cloudflare/CFRealtimeService.ts`             | The file does not exist. The cloudflare service directory holds the auth, avatar-upload, and room-directory adapters.                                               | `src/platform/realtime/` (see Branch B)                                                                                                                                 |
| `src/games/werewolf/components/RoleRevealEffects/types.ts` | The file does not exist at that game-owned path.                                                                                                                    | `src/features/room/components/RoleRevealEffects/` (`types.ts` and `themes.ts` live there)                                                                               |
