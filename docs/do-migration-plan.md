> ⚠️ Historical document — migration completed, for reference only

# DO Migration Plan: Game State → Durable Objects

> Migrate game/night D1 read-compute-write operations to Durable Object internal execution, eliminating optimistic locking.
>
> **Community reference**: [Rules of Durable Objects](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/) —
> "Use Durable Objects when you need: Coordination — Multiple clients need to interact with shared state (chat rooms, **multiplayer games**); Strong consistency — Operations must be **serialized** to avoid race conditions."

## 1. Current State Overview

```
Client  ──POST /game/*──▶  Worker handler
                              │
                    processGameAction()
                              │
                    ┌─── D1 SELECT ◄───┐
                    │   game-engine    │  ← optimistic lock retry ×3
                    └─── D1 UPDATE ───┘
                              │
                    broadcastIfNeeded()
                              │
                    POST /broadcast ──▶ DO (relay)
                              │
                         WebSocket push
```

**Problems**:

- Worker handler → D1 requires two network RTTs (SELECT + UPDATE); read-modify-write has a 50-150ms race window
- Relies on `state_revision` + 3 retries to simulate DO's single-threaded serialization
- Broadcast requires cross-network POST to DO, then uses `ctx.waitUntil` to keep alive

## 2. Target Architecture

```
Client  ──POST /game/*──▶  Worker (thin router: param validation + DO error handling)
                              │
                         DO RPC (typed)
                              │
                    ┌── DO GameRoom ──┐
                    │  SQLite read    │  ← single-threaded, zero contention
                    │  game-engine    │
                    │  SQLite write   │  ← atomic coalesce
                    │  WS broadcast   │  ← same instance, zero network
                    └─────────────────┘
```

**Key Invariants**:

- HTTP API paths unchanged (`/game/*`, `/game/night/*`) → **zero client changes**
- game-engine pure functions unchanged (handler + reducer + inlineProgression)
- Response format unchanged (`{ success, reason?, state?, revision? }`)
- WebSocket message format unchanged (`{ type: 'STATE_UPDATE', state, revision }`)

## 3. Migration Scope

### 3.1 Migrate to DO Internal (21 handlers)

| Category     | Handler                                                                                                                                         | Current File              |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Game Control | assign, seat, start, restart, clear-seats, fill-bots, mark-bots-viewed, set-animation, view-role, update-template, update-profile, share-review | `handlers/gameControl.ts` |
| Night        | action, audio-ack, audio-gate, end, progression, reveal-ack, wolf-robot-viewed, group-confirm-ack, mark-bots-group-confirmed                    | `handlers/night.ts`       |

### 3.2 Stays in D1 (Not Migrated)

| Route           | Reason                                       |
| --------------- | -------------------------------------------- |
| `/room/create`  | D1 metadata insert + DO initialization (4.5) |
| `/room/get`     | Cross-room metadata query, D1 is appropriate |
| `/room/delete`  | D1 metadata delete + DO `deleteAll()` (4.6)  |
| `/auth/*`       | Global relational data                       |
| `/avatar/*`     | R2 storage                                   |
| `/gemini-proxy` | External proxy                               |

### 3.3 Read Paths Changed to Read from DO

| Route                 | Change                      | Reason                                                  |
| --------------------- | --------------------------- | ------------------------------------------------------- |
| `POST /room/state`    | D1 → DO RPC `getState()`    | Authoritative source for game_state moves from D1 to DO |
| `POST /room/revision` | D1 → DO RPC `getRevision()` | Same — `ConnectionManager` revision poll needs this     |

## 4. Phased Implementation

### Phase 1: DO Refactoring (Server-side only, no client changes)

#### Step 4.1 — `GameRoom` Extends `DurableObject` Base Class + SQLite Initialization

Current `GameRoom` doesn't extend `DurableObject`, preventing RPC usage. Must change to extend it.

> Community reference: [Use RPC methods instead of the fetch() handler](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/#use-rpc-methods-instead-of-the-fetch-handler) —
> "RPC is more ergonomic, provides better **type safety**, and eliminates manual request/response parsing."

```typescript
// durableObjects/GameRoom.ts
import { DurableObject } from 'cloudflare:workers';

export class GameRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS room_state (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          game_state TEXT NOT NULL,
          revision INTEGER NOT NULL DEFAULT 0
        )
      `);
    });
  }

  // ...RPC methods + fetch handler coexist (WebSocket still uses fetch)
}
```

**Key points**:

- `extends DurableObject<Env>` unlocks RPC + preserves `fetch()` for WebSocket upgrade
- SQLite-backed DO (wrangler.toml already configured `new_sqlite_classes = ["GameRoom"]`)
- Single-row table `room_state`, `id=1` CHECK constraint ensures only one row
- `blockConcurrencyWhile` executes only once in constructor ([community recommendation](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/#use-blockconcurrencywhile-sparingly): use only for initialization, not for request handling)

#### Step 4.2 — DO Internal `#processAction` (Replaces `gameStateManager.ts`)

**Old `processGameAction`**: D1 SELECT → game-engine → D1 UPDATE (WHERE revision=N) → retry on conflict
**New `#processAction`**: SQLite read → game-engine → SQLite write → broadcast, single-threaded no conflicts

```typescript
/**
 * Core read-compute-write flow (DO internal private method)
 *
 * Semantically identical to old processGameAction, but:
 * - No retry loop (DO single-threaded guarantee eliminates concurrent conflicts)
 * - SQLite sql.exec is synchronous; multiple SQL statements auto-coalesce into atomic transaction
 * - Broadcast completes within same instance, zero network overhead
 */
#processAction(
  processFn: (state: GameState, revision: number) => HandlerResult,
  inlineProgression?: { enabled: boolean; nowMs?: number },
): GameActionResult {
  // 1. Read SQLite (synchronous, zero network)
  const rows = this.ctx.storage.sql
    .exec('SELECT game_state, revision FROM room_state WHERE id = 1')
    .toArray();

  if (rows.length === 0) {
    return { success: false, reason: 'ROOM_NOT_FOUND' };
  }

  const state: GameState = JSON.parse(rows[0].game_state as string);
  const revision = rows[0].revision as number;

  // 2. Call game-engine pure function
  const result = processFn(state, revision);

  // error: precondition/infrastructure failure → don't persist
  if (result.kind === 'error') {
    return { success: false, reason: result.reason };
  }

  // success | rejection: both have actions to apply + persist + broadcast
  const isSuccess = result.kind === 'success';

  // 3. Apply actions → new state
  let newState = state;
  let totalActionsApplied = 0;
  for (const action of result.actions) {
    newState = gameReducer(newState, action);
    totalActionsApplied++;
  }

  // 3.5. Inline progression (optional, only on success)
  if (isSuccess && inlineProgression?.enabled) {
    const prog = runInlineProgression(
      newState, newState.hostUid, inlineProgression.nowMs,
    );
    for (const action of prog.actions) {
      newState = gameReducer(newState, action);
      totalActionsApplied++;
    }
  }

  // No-op guard
  if (totalActionsApplied === 0) {
    return {
      success: isSuccess,
      reason: isSuccess ? undefined : result.reason,
      state,
      revision,
    };
  }

  newState = normalizeState(newState);
  const newRevision = revision + 1;

  // 4. Write SQLite (auto-coalesces with above read into atomic transaction)
  this.ctx.storage.sql.exec(
    'UPDATE room_state SET game_state = ?, revision = ? WHERE id = 1',
    JSON.stringify(newState),
    newRevision,
  );

  // 5. In-place broadcast — output gate ensures write completes before sending
  const shouldBroadcast =
    result.sideEffects?.some((e) => e.type === 'BROADCAST_STATE') ?? true;
  if (shouldBroadcast) {
    this.#broadcast(newState, newRevision);
  }

  return {
    success: isSuccess,
    reason: isSuccess ? undefined : result.reason,
    state: newState,
    revision: newRevision,
    sideEffects: result.sideEffects,
  };
}
```

**Key differences vs old `processGameAction`**:

|                   | Old (D1)                                      | New (DO SQLite)                                          |
| ----------------- | --------------------------------------------- | -------------------------------------------------------- |
| Concurrency guard | optimistic lock + 3× retry                    | Single-threaded serialization, no protection needed      |
| Atomicity         | Two independent I/O ops, no transaction       | sql.exec auto-coalesces into implicit transaction        |
| Broadcast         | Cross-network POST /broadcast + ctx.waitUntil | Same-instance this.#broadcast(), output gate guaranteed  |
| Output safety     | N/A                                           | DO output gate = response sent only after write persists |

#### Step 4.3 — Type-Safe RPC Methods (Replaces string dispatch)

> Community reference: [Use RPC methods instead of the fetch() handler](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/#use-rpc-methods-instead-of-the-fetch-handler) —
> "Define public methods on your Durable Object class, and call them **directly** from stubs with **full TypeScript support**."

**Don't** use `dispatch(string, payload)` — no compile-time guarantees.
**Do** use independent typed RPC methods. 21 handlers grouped into three categories by RPC characteristics:

##### (A) No-parameter RPC (roomCode already routes Worker to correct DO)

```typescript
// Handlers that only need roomCode → no-param RPC
async assignRoles(): Promise<GameActionResult> {
  return this.#processAction((state) => {
    const ctx = buildHandlerContext(state, state.hostUid);
    return handleAssignRoles({ type: 'ASSIGN_ROLES' }, ctx);
  });
}

async restartGame(): Promise<GameActionResult> { /* same pattern */ }
async clearAllSeats(): Promise<GameActionResult> { /* same pattern */ }
async fillWithBots(): Promise<GameActionResult> { /* same pattern */ }
async markAllBotsViewed(): Promise<GameActionResult> { /* same pattern */ }
```

##### (B) Parameterized RPC

```typescript
async seat(
  action: 'sit' | 'standup' | 'kick',
  uid: string,
  seat: number | null,
  displayName?: string,
  avatarUrl?: string,
  avatarFrame?: string,
  targetSeat?: number,
): Promise<GameActionResult> {
  return this.#processAction((state) => {
    const ctx = buildHandlerContext(state, uid);
    if (action === 'sit') {
      return handleJoinSeat({
        type: 'JOIN_SEAT',
        payload: { seat: seat!, uid, displayName: displayName ?? '', avatarUrl, avatarFrame },
      }, ctx);
    }
    if (action === 'kick') {
      return handleKickPlayer({
        type: 'KICK_PLAYER',
        payload: { targetSeat: targetSeat! },
      }, ctx);
    }
    return handleLeaveMySeat({ type: 'LEAVE_MY_SEAT', payload: { uid } }, ctx);
  });
}

async submitAction(
  seat: number, role: RoleId, target: number | null, extra?: unknown,
): Promise<GameActionResult> {
  return this.#processAction(
    (state) => {
      const ctx = buildHandlerContext(state, state.hostUid);
      return handleSubmitAction({
        type: 'SUBMIT_ACTION',
        payload: { seat, role, target, extra },
      }, ctx);
    },
    { enabled: true },  // inlineProgression
  );
}
// ... viewRole(uid, seat), setAnimation(animation), updateTemplate(roles),
//     updateProfile(uid, ...), shareReview(allowedSeats)
//     audioGate(isPlaying), groupConfirmAck(seat, uid),
//     markBotsGroupConfirmed(), wolfRobotViewed(seat)
```

##### (C) RPC with Post-processing (extractAudioActions)

```typescript
async startNight(): Promise<GameActionResult> {
  return this.#processAction((state) => {
    const ctx = buildHandlerContext(state, state.hostUid);
    const result = handleStartNight({ type: 'START_NIGHT' }, ctx);
    if (result.kind === 'error') return result;
    // extractAudioActions logic encapsulated within DO
    const extraActions = extractAudioActions(result.sideEffects);
    if (extraActions.length > 0) {
      return handlerSuccess([...result.actions, ...extraActions], result.sideEffects);
    }
    return result;
  });
}

async endNight(): Promise<GameActionResult> {
  // Same pattern as startNight
}
```

##### (D) Read Interfaces

```typescript
async getState(): Promise<{ state: GameState; revision: number } | null> {
  const rows = this.ctx.storage.sql
    .exec('SELECT game_state, revision FROM room_state WHERE id = 1')
    .toArray();
  if (rows.length === 0) return null;
  return {
    state: JSON.parse(rows[0].game_state as string),
    revision: rows[0].revision as number,
  };
}

async getRevision(): Promise<number | null> {
  const rows = this.ctx.storage.sql
    .exec('SELECT revision FROM room_state WHERE id = 1')
    .toArray();
  return rows.length > 0 ? (rows[0].revision as number) : null;
}
```

##### (E) Initialization + Cleanup

```typescript
async init(initialState: GameState): Promise<void> {
  this.ctx.storage.sql.exec(
    'INSERT OR REPLACE INTO room_state (id, game_state, revision) VALUES (1, ?, 1)',
    JSON.stringify(initialState),
  );
}

async cleanup(): Promise<void> {
  await this.ctx.storage.deleteAll();
}
```

##### WebSocket Keeps `fetch()` Handler

RPC and `fetch()` can coexist on the same DO class. WebSocket upgrade still goes through `fetch()`, unchanged.

#### Step 4.4 — Worker Handler Refactoring

Worker handler becomes a thin router: param validation → DO RPC → error handling → return response.

```typescript
// handlers/gameControl.ts — handleSeat after migration

export const handleSeat: HandlerFn = async (req, env, _ctx) => {
  const body = (await req.json()) as {
    roomCode?: string;
    action?: string;
    uid?: string;
    seat?: number;
    targetSeat?: number;
    displayName?: string;
    avatarUrl?: string;
    avatarFrame?: string;
  };
  const { roomCode, action, uid, seat, targetSeat, displayName, avatarUrl, avatarFrame } = body;

  // Param validation stays in Worker (fail fast, don't wake DO)
  if (!roomCode || !uid || !action) return missingParams(env);
  if (action !== 'sit' && action !== 'standup' && action !== 'kick') {
    return jsonResponse({ success: false, reason: 'INVALID_ACTION' }, 400, env);
  }
  if (action === 'sit' && (seat == null || !isValidSeat(seat))) {
    return jsonResponse({ success: false, reason: 'MISSING_SEAT' }, 400, env);
  }
  if (action === 'kick' && (targetSeat == null || !isValidSeat(targetSeat))) {
    return jsonResponse({ success: false, reason: 'MISSING_SEAT' }, 400, env);
  }

  // DO RPC — type-safe, direct call
  const stub = getGameRoomStub(env, roomCode);
  const result = await stub.seat(
    action,
    uid,
    seat ?? null,
    displayName,
    avatarUrl,
    avatarFrame,
    targetSeat,
  );

  return jsonResponse(result, resultToStatus(result), env);
};
```

##### `createSimpleHandler` Also Simplified

```typescript
export function createSimpleHandler(
  rpcMethod: (stub: DurableObjectStub<GameRoom>) => Promise<GameActionResult>,
): HandlerFn {
  return async (req: Request, env: Env) => {
    const body = (await req.json()) as { roomCode?: string };
    if (!body.roomCode) return missingParams(env);

    const stub = getGameRoomStub(env, body.roomCode);
    const result = await rpcMethod(stub);
    return jsonResponse(result, resultToStatus(result), env);
  };
}

// Usage
export const handleAssign = createSimpleHandler((stub) => stub.assignRoles());
export const handleRestart = createSimpleHandler((stub) => stub.restartGame());
export const handleClearSeats = createSimpleHandler((stub) => stub.clearAllSeats());
export const handleFillBots = createSimpleHandler((stub) => stub.fillWithBots());
export const handleMarkBotsViewed = createSimpleHandler((stub) => stub.markAllBotsViewed());
```

##### Worker-Level DO Error Handling

> Community reference: [Error handling](https://developers.cloudflare.com/durable-objects/best-practices/error-handling/) —
> "errors may include `.retryable` and `.overloaded` properties indicating whether the operation can be retried."

```typescript
// handlers/shared.ts — new helper
function getGameRoomStub(env: Env, roomCode: string): DurableObjectStub<GameRoom> {
  const id = env.GAME_ROOM.idFromName(roomCode);
  return env.GAME_ROOM.get(id);
}

/**
 * Wraps DO RPC calls, handling DO-specific error properties.
 * If err.retryable === true, returns 503 for client retry.
 * If err.overloaded === true, returns 429.
 */
async function callDO<T>(fn: () => Promise<T>, env: Env): Promise<T | Response> {
  try {
    return await fn();
  } catch (err: unknown) {
    const doErr = err as { retryable?: boolean; overloaded?: boolean; message?: string };
    if (doErr.retryable) {
      return jsonResponse({ success: false, reason: 'SERVICE_UNAVAILABLE' }, 503, env);
    }
    if (doErr.overloaded) {
      return jsonResponse({ success: false, reason: 'OVERLOADED' }, 429, env);
    }
    throw err; // Not a DO error, rethrow to global catch
  }
}
```

#### Step 4.5 — `/room/create`: D1 + DO Atomicity

**Problem**: Writing D1 first then initializing DO — if DO init fails, D1 already has a record but DO has no state.

**Solution**: Roll back D1 record if DO init fails.

```typescript
// roomHandlers.ts — handleCreateRoom modification
export async function handleCreateRoom(request: Request, env: Env): Promise<Response> {
  // ... validate token, roomCode ...

  // 1. D1 insert room metadata
  await env.DB.prepare(sql).bind(...params).run();

  // 2. Initialize DO state (if initialState provided)
  if (body.initialState) {
    try {
      const stub = getGameRoomStub(env, body.roomCode);
      await stub.init(body.initialState as GameState);
    } catch (err) {
      // DO init failed → rollback D1 record
      await env.DB.prepare('DELETE FROM rooms WHERE code = ?')
        .bind(body.roomCode)
        .run();
      throw err; // Rethrow to global catch → 500
    }
  }

  return jsonResponse({ room: { ... } }, 200, env);
}
```

#### Step 4.6 — `/room/delete`: D1 + DO Cleanup

```typescript
// roomHandlers.ts — handleDeleteRoom modification
export async function handleDeleteRoom(request: Request, env: Env): Promise<Response> {
  // ... validation ...
  const result = await env.DB.prepare('DELETE FROM rooms WHERE code = ? AND host_id = ?')
    .bind(body.roomCode, payload.sub)
    .run();
  if (!result.meta.changes) {
    return jsonResponse({ error: 'room not found or not authorized' }, 403, env);
  }

  // Clean up DO storage (non-critical path, failure doesn't block)
  try {
    const stub = getGameRoomStub(env, body.roomCode);
    await stub.cleanup();
  } catch {
    // DO cleanup failure doesn't affect delete result.
    // DO storage will be cleaned up by cron for expired rooms.
  }

  return jsonResponse({ success: true }, 200, env);
}
```

#### Step 4.7 — `/room/state` and `/room/revision` Changed to Read from DO

```typescript
export async function handleGetGameState(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as { roomCode?: string };
  if (!body.roomCode) return jsonResponse({ error: 'roomCode required' }, 400, env);

  const stub = getGameRoomStub(env, body.roomCode);
  const result = await stub.getState();

  if (!result) return jsonResponse({ state: null }, 200, env);
  return jsonResponse({ state: result.state, revision: result.revision }, 200, env);
}

export async function handleGetRevision(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as { roomCode?: string };
  if (!body.roomCode) return jsonResponse({ error: 'roomCode required' }, 400, env);

  const stub = getGameRoomStub(env, body.roomCode);
  const revision = await stub.getRevision();

  return jsonResponse({ revision }, 200, env);
}
```

**Regarding DO wake-up latency**: Revision poll calls periodically. If DO is in hibernation, RPC call automatically wakes it. Hibernation wake-up <50ms is acceptable for poll scenarios. In practice, as long as WebSocket connections are active, DO generally won't hibernate.

### Phase 2: Cleanup (After Phase 1 verification passes)

1. D1 `rooms` table: remove `game_state` / `state_revision` columns
2. Delete `lib/gameStateManager.ts` (entire file)
3. Delete `lib/broadcast.ts` (entire file)
4. Delete old `processGameAction` related imports from `handlers/shared.ts`

## 5. Detailed File Change List

### New Files

| File                              | Description                                                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `durableObjects/gameProcessor.ts` | `#processAction` + `buildHandlerContext` + `extractAudioActions` (extracted from DO class to keep it <400 lines) |

### Modified Files

| File                         | Changes                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `durableObjects/GameRoom.ts` | Extends `DurableObject<Env>`; add typed RPC methods; preserve WebSocket fetch handler                                     |
| `handlers/gameControl.ts`    | All handlers changed to DO RPC calls (param validation preserved, processGameAction/broadcastIfNeeded removed)            |
| `handlers/night.ts`          | Same as above                                                                                                             |
| `handlers/shared.ts`         | `createSimpleHandler` changed to receive `(stub) => stub.xxx()` lambda; add `getGameRoomStub` + `callDO`                  |
| `handlers/roomHandlers.ts`   | `handleCreateRoom` adds DO init + rollback; `handleDeleteRoom` adds DO cleanup; read paths changed to DO RPC              |
| `env.ts`                     | Unchanged (GAME_ROOM binding already exists)                                                                              |
| `index.ts`                   | Unchanged (route table unchanged)                                                                                         |
| `wrangler.toml`              | Unchanged (migration tag "v1" + `new_sqlite_classes` already exist; CREATE IF NOT EXISTS in constructor needs no new tag) |

### Phase 2 Deletions

| File                      | Description |
| ------------------------- | ----------- |
| `lib/gameStateManager.ts` | Entire file |
| `lib/broadcast.ts`        | Entire file |

### Unchanged

| File                       | Reason                                         |
| -------------------------- | ---------------------------------------------- |
| **All client files**       | HTTP paths + request/response format unchanged |
| **`game-engine` package**  | Pure functions, agnostic to caller             |
| `handlers/authHandlers.ts` | D1 direct access                               |
| `handlers/avatarUpload.ts` | R2 direct access                               |
| `handlers/geminiProxy.ts`  | External proxy                                 |
| `handlers/cronHandlers.ts` | D1 cleanup (can add DO stale cleanup)          |

## 6. Complete RPC Method List

| RPC Method                                 | Parameters                                                             | Handler Source                                              | inlineProgression |
| ------------------------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------- |
| `assignRoles()`                            | —                                                                      | `handleAssignRoles`                                         | No                |
| `seat(action, uid, seat, ...)`             | action, uid, seat, displayName?, avatarUrl?, avatarFrame?, targetSeat? | `handleJoinSeat` / `handleLeaveMySeat` / `handleKickPlayer` | No                |
| `startNight()`                             | —                                                                      | `handleStartNight` + extractAudioActions                    | No                |
| `restartGame()`                            | —                                                                      | `handleRestartGame`                                         | No                |
| `clearAllSeats()`                          | —                                                                      | `handleClearAllSeats`                                       | No                |
| `fillWithBots()`                           | —                                                                      | `handleFillWithBots`                                        | No                |
| `markAllBotsViewed()`                      | —                                                                      | `handleMarkAllBotsViewed`                                   | No                |
| `setAnimation(animation)`                  | animation: string                                                      | `handleSetRoleRevealAnimation`                              | No                |
| `viewRole(uid, seat)`                      | uid: string, seat: number                                              | `handleViewedRole`                                          | No                |
| `updateTemplate(roles)`                    | roles: RoleId[]                                                        | `handleUpdateTemplate`                                      | No                |
| `updateProfile(uid, ...)`                  | uid, displayName?, avatarUrl?, avatarFrame?                            | `handleUpdatePlayerProfile`                                 | No                |
| `shareReview(allowedSeats)`                | allowedSeats: number[]                                                 | `handleShareNightReview`                                    | No                |
| `submitAction(seat, role, target, extra?)` | seat, role, target, extra?                                             | `handleSubmitAction`                                        | **Yes**           |
| `audioAck()`                               | —                                                                      | inline logic                                                | **Yes**           |
| `audioGate(isPlaying)`                     | isPlaying: boolean                                                     | `handleSetAudioPlaying`                                     | No                |
| `endNight()`                               | —                                                                      | `handleEndNight` + extractAudioActions                      | No                |
| `progression()`                            | —                                                                      | status guard                                                | **Yes**           |
| `revealAck()`                              | —                                                                      | inline logic                                                | **Yes**           |
| `wolfRobotViewed(seat)`                    | seat: number                                                           | `handleSetWolfRobotHunterStatusViewed`                      | **Yes**           |
| `groupConfirmAck(seat, uid)`               | seat, uid                                                              | inline logic                                                | **Yes**           |
| `markBotsGroupConfirmed()`                 | —                                                                      | inline logic                                                | **Yes**           |
| `init(state)`                              | state: GameState                                                       | —                                                           | —                 |
| `getState()`                               | —                                                                      | —                                                           | —                 |
| `getRevision()`                            | —                                                                      | —                                                           | —                 |
| `cleanup()`                                | —                                                                      | —                                                           | —                 |

## 7. Testing Strategy

### 7.1 Existing Tests Unchanged

- `game-engine` unit tests: pure functions, no I/O dependency, 100% preserved
- Client `GameFacade` / `seatActions` tests: mock HTTP API, interface unchanged, 100% preserved
- E2E tests (Playwright): HTTP paths + response format unchanged, 100% preserved

### 7.2 New Tests

| Test                           | Framework                                  | Description                                                                              |
| ------------------------------ | ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `#processAction` unit test     | Vitest + `@cloudflare/vitest-pool-workers` | Verify read-process-write-broadcast full flow; verify NO-OP guard; verify ROOM_NOT_FOUND |
| RPC method integration tests   | Same                                       | Verify each RPC correctly calls game-engine handler                                      |
| Worker → DO end-to-end         | Same                                       | Verify Worker param validation → DO RPC → Response full chain                            |
| Concurrency serialization test | Same                                       | Two `seat('sit', ...)` concurrent calls to same seat → DO serializes → only one succeeds |
| DO error test                  | Same                                       | Verify `callDO` handling of retryable/overloaded                                         |

### 7.3 Verification Checklist

After Phase 1 completion, verify each item:

- [ ] `pnpm exec tsc --noEmit` type check passes
- [ ] `pnpm run test:all` all unit/integration tests pass
- [ ] `pnpm run e2e` all E2E tests pass
- [ ] Manual: create room → sit → assign → view role → start night → full night flow → end
- [ ] Manual: disconnect recovery (close tab → reopen → poll revision → fetchStateFromDB)
- [ ] Manual: concurrent seating (two devices tap same seat simultaneously → only one succeeds)
- [ ] Manual: Host restart game
- [ ] Manual: delete room then recreate with same code
- [ ] Confirm D1 `rooms.game_state` is no longer written to (verify with SELECT)

## 8. Rollback Strategy

During Phase 1, D1 `game_state` column is **preserved but no longer written to**.

| Scenario                      | Action                                                                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Bug found, need rollback      | `handlers/*.ts` restore `processGameAction(env.DB, ...)`; GameRoom reverts to relay-only                                   |
| Data recovery                 | During Phase 1, D1 column exists but data is frozen at pre-migration snapshot. New rooms have no D1 data; check DO storage |
| Cannot rollback after Phase 2 | Phase 2 must only execute after Phase 1 is sufficiently verified (≥1 week in production)                                   |

## 9. Risks and Mitigations

| Risk                               | Probability | Mitigation                                                                            |
| ---------------------------------- | ----------- | ------------------------------------------------------------------------------------- |
| DO wake-up latency                 | Low         | Hibernation wake-up <50ms; WebSocket active during game prevents hibernation          |
| DO RPC `.retryable` error          | Low         | Worker-level `callDO` handles uniformly, returns 503                                  |
| `/room/create` D1↔DO inconsistency | Low         | DO init failure rolls back D1 record                                                  |
| GameRoom.ts bloat                  | Medium      | Extract `gameProcessor.ts` module; DO class only handles RPC entry + WebSocket        |
| Active rooms during migration      | Low         | Room lifecycle <2h; deploy at night or notify users                                   |
| Wrangler migration tag             | None        | Already has v1 tag + `new_sqlite_classes`; `CREATE TABLE IF NOT EXISTS` is idempotent |
| DO evicted then revision poll      | None        | RPC call auto-wakes DO → blockConcurrencyWhile → read SQLite                          |

## 10. Effort Estimate

| Step    | Content                                         | Estimated Code Volume                           |
| ------- | ----------------------------------------------- | ----------------------------------------------- |
| 4.1     | GameRoom extends DurableObject + SQLite init    | ~30 lines modified                              |
| 4.2     | `#processAction` core flow                      | ~80 lines added                                 |
| 4.3     | 25 typed RPC methods                            | ~250 lines added (incl. gameProcessor.ts split) |
| 4.4     | Worker handler refactoring (21 handlers)        | ~net -100 lines (each handler simplified)       |
| 4.5-4.7 | roomHandlers adjustments + shared helpers       | ~60 lines modified                              |
| Tests   | Vitest DO tests + full regression               | ~200 lines added                                |
| Phase 2 | Delete gameStateManager + broadcast + D1 column | ~net -200 lines                                 |
