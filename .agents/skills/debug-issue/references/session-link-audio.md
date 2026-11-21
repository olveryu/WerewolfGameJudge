# Session, link, and audio-lock pointers

This reference holds the detail behind the three one-line pointers in Step 2 of `SKILL.md`. It states only what was verified against deciding code at drafting time. For any behaviour beyond this page, read the cited file; do not extend these summaries from memory.

## State identity

Each game owns a strict parser in `state/parseState.ts` and a codec in `state/codec.ts`. The codec validates the current state shape and game identity at the protocol and persistence boundaries. There is no per-game state version or persisted-state migration; invalid stored state fails fast when the worker reads it.

Deciding files: `packages/game-engine/src/games/<game>/state/parseState.ts`, `packages/game-engine/src/games/<game>/state/codec.ts`, `packages/game-engine/src/platform/protocol/roomSnapshot.ts`, and `packages/api-worker/src/platform/commands/RoomStateStore.ts`.

## Realtime link (RoomLink)

The link implementation lives in `packages/web/src/platform/realtime/`, not under `packages/web/src/features/room/`. Its parts:

- `RoomLink.ts` — the link implementation class and the room lease.
- `linkReducer.ts` — the pure connection state machine (six statuses: idle, connecting, syncing, live, waiting, closed), full-jitter exponential backoff capped at 10,000 ms, unbounded reconnection, terminal close codes only stop it.
- `LinkRuntime.ts` — the imperative shell that executes the reducer's effects.
- `RoomLinkFactory.ts` — the factory; one production instantiation site.
- `types.ts` — the link interface (`getSnapshot`, `subscribe`, `connect`, `dispatch`, `retryNow`, `close`), snapshot phases (idle, entering, ready, closed), and dispatch outcomes (committed, rejected, unavailable, undelivered, cancelled).
- `commandTransport.ts` — one HTTP command send per dispatch; no retry at this layer.
- `CommandOutbox.ts` and `outboxStorage.ts` — delivery and replay policy, including durable commands that persist locally and replay until the server decides.
- `SocketChannel.ts` — the socket adapter.

The wire protocol is version 2, defined in `packages/game-engine/src/platform/realtime/protocol.ts`. Client-to-server frames carry only a sync request with a known revision; server-to-client frames carry sync results, state updates, and inbox hints. Snapshot payloads decode through the game's state codec. Close codes are defined in `packages/game-engine/src/platform/realtime/closeCodes.ts`; only terminal codes stop reconnection.

Entry into a room goes through `packages/web/src/features/room/components/RoomEntryBoundary.tsx`, which requires an authenticated user, runs `packages/web/src/features/room/controllers/useRoomEntryController.ts`, and renders children only when the controller is ready. Game room code starts from `packages/web/src/features/room/controllers/useReadyRoomSession.ts`, which fails fast on a non-ready snapshot and exposes the authoritative state, the revision, the last command, the link session, and single-flight submit. `RoomLinkScope` in `packages/web/src/app/AppRoot.tsx` keeps a room's link alive across the room page and its subpages and releases it when the route leaves the room or the user changes.

## Audio-playback lock

One predicate decides the lock: `isAudioPlaybackLocked(isAudioPlaying)` in `packages/web/src/features/room/model/audioPlaybackLock.ts` returns its input. One combinator applies it to an assembled host-management model: `applyAudioPlaybackLock` flips every enabled non-exempt action to disabled with the single lock reason and drops its press handler, so the press is unreachable, not only greyed; already-disabled actions keep their own reason; exempt actions pass through; when audio is idle the model returns unchanged. The test an action must pass to be exempt is the read-only predicate stated in that file: it sends no server command, writes no flow progress, and starts no capture or share.

No ported game wires the lock yet: `demo` has no narration, and the generator emits the wiring only for a pack with `audioOrchestration` on (the `//#cap audioOrchestration` segments of the room-state hook template under `scripts/lib/new-game/templates/game/packages/web/src/games/`). The audio core a game binds to is `packages/web/src/features/room/audio/RoomAudioOrchestrator.ts`. Werewolf (P3) and Avalon (P4) wire the lock when their web clients land; in the removed client (last present in commit `ccedf18b5`) both applied it at the host-management factory exit with an empty exemption set, and Avalon kept its night confirm-information button enabled during audio as an Avalon-only deviation — do not generalise that into an exemption mechanism.

The engine backstop rejects commands while narration plays (`packages/game-engine/src/games/werewolf/domain/handlers/actionGuards.ts`). The audio flag itself is owned by audio-queue events only. The queue events are the `SET_PENDING_AUDIO_EFFECTS` / `CLEAR_PENDING_AUDIO_EFFECTS` actions in the werewolf reducer (`packages/game-engine/src/games/werewolf/domain/reducer/gameReducer.ts`), fed by the engine audio queue.

Deciding files: `packages/web/src/features/room/model/audioPlaybackLock.ts`, `packages/web/src/features/room/audio/RoomAudioOrchestrator.ts`, `packages/game-engine/src/games/werewolf/domain/handlers/actionGuards.ts`, `packages/game-engine/src/platform/audio/__tests__/audioGate.contract.test.ts`.
