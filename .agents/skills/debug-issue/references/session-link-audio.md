# Session, link, and audio-lock pointers

This reference holds the detail behind the three one-line pointers in Step 2 of `SKILL.md`. It states only what was verified against deciding code at drafting time. For any behaviour beyond this page, read the cited file; do not extend these summaries from memory.

## State identity

Each game owns its state identity: a version constant and an identity object in `packages/game-engine/src/games/<game>/state/version.ts`, a strict parser in `state/parseState.ts` that accepts only the current version, an invariant checker in `state/normalize.ts`, and a codec in `state/codec.ts`. Persisted states are upgraded by that game's `migratePersisted*State` function, exported through the game's public entry point and wired into its worker module. The worker-side reader upgrades an older stored state in place at read time and throws on a newer or unsupported version.

Current versions at drafting time (verify again before citing a number in a report):

| Game       | Current version |
| ---------- | --------------- |
| werewolf   | 16              |
| avalon     | 10              |
| fibking    | 8               |
| pictionary | 9               |
| undercover | 5               |
| storyrelay | 2               |
| drawguess  | 2               |
| demo       | 1               |

The upgrade ranges each `migratePersisted*State` accepts are defined per game in its `state/parseState.ts`. Never state an upgrade range from this table alone; read the migration function for the game in question. Older versions outside the accepted range are rejected by the strict parser. The werewolf version history includes hard cuts at versions 10, 11, and 12; do not assume an upgrade chain exists for versions below a game's accepted range.

Deciding files: `packages/game-engine/src/games/<game>/state/version.ts`, `packages/game-engine/src/games/<game>/state/parseState.ts`, `packages/game-engine/src/platform/protocol/roomSnapshot.ts`, `packages/api-worker/src/platform/commands/RoomStateStore.ts`.

## Realtime link (RoomLink)

The link implementation lives in `src/platform/realtime/`, not under `src/features/room/`. Its parts:

- `RoomLink.ts` — the link implementation class and the room lease.
- `linkReducer.ts` — the pure connection state machine (six statuses: idle, connecting, syncing, live, waiting, closed), full-jitter exponential backoff capped at 10,000 ms, unbounded reconnection, terminal close codes only stop it.
- `LinkRuntime.ts` — the imperative shell that executes the reducer's effects.
- `RoomLinkFactory.ts` — the factory; one production instantiation site.
- `types.ts` — the link interface (`getSnapshot`, `subscribe`, `connect`, `dispatch`, `retryNow`, `close`), snapshot phases (idle, entering, ready, closed), and dispatch outcomes (committed, rejected, unavailable, undelivered, cancelled).
- `commandTransport.ts` — one HTTP command send per dispatch; no retry at this layer.
- `CommandOutbox.ts` and `outboxStorage.ts` — delivery and replay policy, including durable commands that persist locally and replay until the server decides.
- `SocketChannel.ts` — the socket adapter.

The wire protocol is version 2, defined in `packages/game-engine/src/platform/realtime/protocol.ts`. Client-to-server frames carry only a sync request with a known revision; server-to-client frames carry sync results, state updates, presence, and inbox hints. Snapshot payloads decode through the game's state codec. Close codes are defined in `packages/game-engine/src/platform/realtime/closeCodes.ts`; only terminal codes stop reconnection.

Entry into a room goes through `src/features/room/components/RoomEntryBoundary.tsx`, which requires an authenticated user, runs `src/features/room/controllers/useRoomEntryController.ts`, and renders children only when the controller is ready. Game room code starts from `src/features/room/controllers/useReadyRoomSession.ts`, which fails fast on a non-ready snapshot and exposes the authoritative state, the revision, the last command, the link session, and single-flight submit.

## Audio-playback lock

One predicate decides the lock: `isAudioPlaybackLocked(isAudioPlaying)` in `src/features/room/model/audioPlaybackLock.ts` returns its input. One combinator applies it to an assembled host-management model: `applyAudioPlaybackLock` flips every enabled non-exempt action to disabled with the single lock reason and drops its press handler, so the press is unreachable, not only greyed; already-disabled actions keep their own reason; exempt actions pass through; when audio is idle the model returns unchanged.

Each game declares its own exemption set where it assembles its host-management model. Werewolf declares an empty exemption set in `src/games/werewolf/room/createWerewolfHostManagement.ts`: no host-management action is exempt. The test an action must pass to be exempt is the read-only predicate stated in that file: it sends no server command, writes no flow progress, and starts no capture or share. Do not carry an exemption claim for any game without reading that game's assembly file.

The werewolf bottom layout collapses to empty while audio plays, for every audience. The night interaction policy checks the audio lock before the pending-command lock. The engine backstop rejects commands while narration plays. The audio flag itself is owned by audio-queue events only; UI code never sets it. There is no action named as the sole modification path for a playing flag; the queue events are the `SET_PENDING_AUDIO_EFFECTS` / `CLEAR_PENDING_AUDIO_EFFECTS` actions in the werewolf reducer, fed by the engine audio queue.

Avalon has one deliberate, game-specific deviation: its night confirm-information button stays enabled during audio. Name it as Avalon-specific. Do not generalise it into an exemption mechanism.

Deciding files: `src/features/room/model/audioPlaybackLock.ts`, `src/games/werewolf/room/createWerewolfHostManagement.ts`, `src/games/werewolf/room/werewolfRoomAdapter.ts`, `src/games/werewolf/room/night/resolveNightInteraction.ts`, `src/features/room/audio/useRoomAudioOrchestration.ts`, `packages/game-engine/src/games/werewolf/domain/handlers/actionGuards.ts`.
