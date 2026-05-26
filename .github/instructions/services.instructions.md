---
name: 'Services'
description: 'Service layer standards: facade/transport/infra/feature services, resolvers, state management, audio orchestration. Use when: editing services, audio orchestration, connection management, game facade, realtime transport'
applyTo: 'src/services/**'
---

# Service Layer Standards

## Source Code Location

Game logic: `@werewolf/game-engine` (see `game-engine.instructions.md`). Client services: `facade/`, `transport/`, `infra/`, `feature/`.

## Feature Services

High-level facades combining infra/transport services to provide business capabilities externally.

| Service               | File                                        | Responsibility                                                  |
| --------------------- | ------------------------------------------- | --------------------------------------------------------------- |
| **StatsService**      | `src/services/feature/StatsService.ts`      | User growth data query (XP/level/unlocked items)                |
| **GachaService**      | `src/services/feature/GachaService.ts`      | Gacha status query, draw execution, daily login reward claiming |
| **ShareImageService** | `src/services/feature/ShareImageService.ts` | Share image upload to R2, returns public URL                    |
| **CFStorageService**  | `src/services/infra/CFStorageService.ts`    | Custom avatar upload to Cloudflare R2                           |

## Core Rules

- Resolvers / calculators / validators are pure functions. IO/UI is forbidden.
- Server-side business logic (night flow / death calc / state transition / reducer) is executed by Cloudflare Worker (Durable Objects).
- Client facade handles: HTTP API submission + Realtime receive + audio orchestration. Client running resolvers / reducers / death calculation is forbidden.
- Facade methods return `Promise<ActionResult>` (imported from `@werewolf/game-engine/protocol/ActionResult`). Returning bare `boolean` or loose `{ success: boolean; reason?: string }` type is forbidden.
- Infra services may use platform APIs (MMKV / Platform / expo-audio etc.).
- Pure type files (`src/services/types/**`) may be `import type`'d by any layer.
- Cross-night state (`previousActions` / `lastNightTarget` etc.) is forbidden.
- SRP ~400 line split signal (see `screens.instructions.md`). When exceeding threshold, first evaluate whether independent reuse/test/modification scenarios exist — don't mechanically apply.
- Wire protocol (`PlayerMessage` / `GameState`) must maintain compatibility.

## Resolver Standards

- Input `ActionInput` + `ResolverContext` (contains `currentNightResults`), output `{ valid, rejectReason?, updates?, result? }`.
- Must check nightmare block: `blockedSeat === actorSeat` → `{ valid: true, result: {} }` (valid but no effect).
- Validation must be bidirectionally consistent with `SCHEMAS[*].constraints`: schema specifies `notSelf` → resolver rejects; schema allows → resolver must not reject.
- Resolver is the sole source of validation and calculation logic. Host does no "secondary calculation"; reveal results must be read from resolver return value.

## State Management & Anti-drift

- `GameState` is the single source of truth. `HostOnlyState` or non-broadcast fields are forbidden. Host/Player state shape is completely identical.
- New fields must sync `normalizeState` (see `game-engine.instructions.md` Handler Rules).
- Derived fields calculated from same state copy or written only once. Dual-write/drift is forbidden.

## Night Flow

- `nightFlowHandler` / `stepTransitionHandler` is the single source of truth for advancement. Manual index advancement is forbidden.
- Night-1 order comes from `NIGHT_STEPS` (table-driven), step id = stable `SchemaId`. Re-introducing `night1.order` or parallel `ACTION_ORDER` is forbidden.
- Auto-advancement centralized in night flow handler (server-side), must be idempotent (same `{revision, currentStepId}` advances at most once). Facade only initiates intent — calculating "should advance" on its own is forbidden.
- Phase-mismatch events must be idempotent no-op. Plan builder encountering invalid `roleId` / `schemaId` must fail-fast.

## Room Transition Cleanup

Services holding mutable state (flags / players / subscriptions) must reset **all** mutable fields on `createRoom` / `joinRoom` / `leaveRoom`. AudioService must `stop()` first then `clearPreloaded()`. Omission = previous game's state leaks into next game.

## HTTP Response Defense

After `fetch`, must first check `res.ok` + `content-type` contains `application/json` before calling `.json()`. Non-JSON responses (502/503 HTML) return structured error (`{ success: false, reason: 'SERVER_ERROR' }`). Don't let `SyntaxError` propagate to Sentry.

## Native Resource Lifecycle

expo-audio `AudioPlayer` and similar native resources: when replaced, must track old instance, collectively `remove()` in `cleanup()` / `clearPreloaded()`. `pause()` alone doesn't release native memory. Web `HTMLAudioElement` is GC'd by browser — clearing references suffices.

## Promise Must Settle

`new Promise()` constructor must guarantee all paths (success/error/cancel/stop) either `resolve` or `reject`. Interrupt operations like `stopCurrentPlayer()` must settle in-progress playback promises. Dangling promises are forbidden.

## Persisted Data Validate + Clamp

UI state loaded from MMKV / DB (coordinates, enums, config values) must validate type + clamp to current valid range. Cannot trust directly. E.g., screen coordinates need clamping to current viewport.

## Audio Orchestration

Single orchestration source: Handler declares → Facade executes → UI read-only.

- **Handler** (server-side): writes `pendingAudioEffects`, `audioKey` / `audioEndKey` comes from `NIGHT_STEPS` — dual-writing in specs/steps is forbidden. Audio IO is forbidden.
- **Facade** (client-side): reactively watches store's `pendingAudioEffects` → plays → `postAudioAck` releases gate. Wolf vote deadline expires → `postProgression` triggers advancement (one-time guard prevents re-entry).
- **UI**: reads `isAudioPlaying` only. useEffect playing audio is forbidden. UI toggling `setAudioPlaying` is forbidden.
- `isAudioPlaying` is factual state; sole modification path: `SET_AUDIO_PLAYING` action. Other actions "incidentally" setting it is forbidden.
- **Rejoin recovery**: `joinRoom(isHost=true)` recovers from DB → continue game AlertModal user gesture (Web autoplay needs gesture unlock) → `resumeAfterRejoin()` replays current step audio → `postAudioAck`. useEffect auto-triggering is forbidden.
- **Audio-ack disconnect retry** (two-layer mutual exclusion):
  - **L1: Status listener** — WebSocket truly disconnects, SDK reconnects → `ConnectionStatus.Live` → retry `postAudioAck`. Covers real network disconnect.
  - **L2: Browser `online` event** — `window.addEventListener('online', ...)` zero-delay network recovery detection → retry `postAudioAck`. Covers scenario where WebSocket hasn't disconnected but HTTP has (e.g., Playwright `setOffline`, brief DNS failure). Web platform only (`typeof globalThis.window?.addEventListener === 'function'` capability check); native covered by L1.
  - Whichever layer triggers first clears the other. `leaveRoom` / `createRoom` / `joinRoom` clean up uniformly.

## JSDoc Standards

- **Service class**: class header `@remarks` explains core design decisions (re-entry guard, lock strategy, cleanup order).
- **Connect / init methods**: annotate `@pre` (e.g., roomCode already set) and `@remarks` (timeout, retry strategy).
- **Public methods**: methods with IO or async side effects annotate `@throws` (network error, token expiration).
- **FSM context / options interfaces**: fields with non-obvious semantics get inline `/** ... */` comments (null meaning, counter upper limit, etc.).
