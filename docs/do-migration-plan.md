# DO Migration Plan: Game State → Durable Objects

> 将 game/night 的 D1 读-算-写 迁移到 Durable Object 内部执行，消除 optimistic locking。
>
> **社区依据**：[Rules of Durable Objects](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/) —
> "Use Durable Objects when you need: Coordination — Multiple clients need to interact with shared state (chat rooms, **multiplayer games**); Strong consistency — Operations must be **serialized** to avoid race conditions."

## 1. 现状概览

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

**问题**：

- Worker handler → D1 两次网络 RTT（SELECT + UPDATE），read-modify-write 存在 50-150ms 竞争窗口
- 靠 `state_revision` + 3 次 retry 模拟 DO 的单线程序列化
- 广播需要跨网络 POST 到 DO，再通过 `ctx.waitUntil` 保活

## 2. 目标架构

```
Client  ──POST /game/*──▶  Worker (thin router: 参数校验 + DO error handling)
                              │
                         DO RPC (typed)
                              │
                    ┌── DO GameRoom ──┐
                    │  SQLite read    │  ← 单线程，零竞争
                    │  game-engine    │
                    │  SQLite write   │  ← 原子 coalesce
                    │  WS broadcast   │  ← 同实例内，零网络
                    └─────────────────┘
```

**关键不变项**：

- HTTP API 路径不变（`/game/*`, `/game/night/*`）→ **客户端零改动**
- game-engine 纯函数不变（handler + reducer + inlineProgression）
- 响应格式不变（`{ success, reason?, state?, revision? }`）
- WebSocket 消息格式不变（`{ type: 'STATE_UPDATE', state, revision }`）

## 3. 迁移范围

### 3.1 迁移到 DO 内部（21 个 handler）

| 类别         | Handler                                                                                                                                         | 当前文件                  |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Game Control | assign, seat, start, restart, clear-seats, fill-bots, mark-bots-viewed, set-animation, view-role, update-template, update-profile, share-review | `handlers/gameControl.ts` |
| Night        | action, audio-ack, audio-gate, end, progression, reveal-ack, wolf-robot-viewed, group-confirm-ack, mark-bots-group-confirmed                    | `handlers/night.ts`       |

### 3.2 保持 D1（不迁移）

| 路由            | 原因                                       |
| --------------- | ------------------------------------------ |
| `/room/create`  | D1 插入元数据 + 初始化 DO（见 4.5）        |
| `/room/get`     | 跨房间元数据查询，D1 适合                  |
| `/room/delete`  | D1 元数据删除 + DO `deleteAll()`（见 4.6） |
| `/auth/*`       | 全局关系型数据                             |
| `/avatar/*`     | R2 存储                                    |
| `/gemini-proxy` | 外部代理                                   |

### 3.3 读路径改从 DO 读

| 路由                  | 变更                        | 原因                                         |
| --------------------- | --------------------------- | -------------------------------------------- |
| `POST /room/state`    | D1 → DO RPC `getState()`    | game_state 的权威源从 D1 移到 DO             |
| `POST /room/revision` | D1 → DO RPC `getRevision()` | 同上，`ConnectionManager` revision poll 需要 |

## 4. 分阶段实施

### Phase 1：DO 改造（纯服务端，不动客户端）

#### Step 4.1 — `GameRoom` 继承 `DurableObject` 基类 + SQLite 初始化

当前 `GameRoom` 不继承 `DurableObject`，无法使用 RPC。必须改为继承。

> 社区依据：[Use RPC methods instead of the fetch() handler](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/#use-rpc-methods-instead-of-the-fetch-handler) —
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

  // ...RPC methods + fetch handler 共存（WebSocket 仍走 fetch）
}
```

**要点**：

- `extends DurableObject<Env>` 解锁 RPC + 保留 `fetch()` 用于 WebSocket upgrade
- SQLite-backed DO（wrangler.toml 已配置 `new_sqlite_classes = ["GameRoom"]`）
- 单行表 `room_state`，`id=1` CHECK 约束保证只有一行
- `blockConcurrencyWhile` 仅在 constructor 中执行一次（[社区推荐](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/#use-blockconcurrencywhile-sparingly)：仅用于初始化，不用于请求处理）

#### Step 4.2 — DO 内部 `#processAction`（替代 `gameStateManager.ts`）

**旧 `processGameAction`**：D1 SELECT → game-engine → D1 UPDATE (WHERE revision=N) → retry on conflict
**新 `#processAction`**：SQLite read → game-engine → SQLite write → broadcast，单线程无冲突

```typescript
/**
 * 核心读-算-写流程（DO 内部 private 方法）
 *
 * 与旧 processGameAction 语义完全一致，但：
 * - 无 retry 循环（DO 单线程保证无并发冲突）
 * - SQLite sql.exec 是同步的，多条 SQL 自动 coalesce 为原子事务
 * - 广播在同实例内完成，零网络开销
 */
#processAction(
  processFn: (state: GameState, revision: number) => HandlerResult,
  inlineProgression?: { enabled: boolean; nowMs?: number },
): GameActionResult {
  // 1. 读 SQLite（同步，零网络）
  const rows = this.ctx.storage.sql
    .exec('SELECT game_state, revision FROM room_state WHERE id = 1')
    .toArray();

  if (rows.length === 0) {
    return { success: false, reason: 'ROOM_NOT_FOUND' };
  }

  const state: GameState = JSON.parse(rows[0].game_state as string);
  const revision = rows[0].revision as number;

  // 2. 调用 game-engine 纯函数
  const result = processFn(state, revision);

  // error: 前置条件/基础设施失败 → 不持久化
  if (result.kind === 'error') {
    return { success: false, reason: result.reason };
  }

  // success | rejection: 都有 actions 需要 apply + persist + broadcast
  const isSuccess = result.kind === 'success';

  // 3. apply actions → 新 state
  let newState = state;
  let totalActionsApplied = 0;
  for (const action of result.actions) {
    newState = gameReducer(newState, action);
    totalActionsApplied++;
  }

  // 3.5. inline progression（可选，仅 success 时）
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

  // 4. 写 SQLite（与上面的 read 自动 coalesce 为原子事务）
  this.ctx.storage.sql.exec(
    'UPDATE room_state SET game_state = ?, revision = ? WHERE id = 1',
    JSON.stringify(newState),
    newRevision,
  );

  // 5. 原地广播 — output gate 保证 write 完成后才发送
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

**关键差异 vs 旧 `processGameAction`**：

|          | 旧（D1）                               | 新（DO SQLite）                              |
| -------- | -------------------------------------- | -------------------------------------------- |
| 并发保护 | optimistic lock + 3× retry             | 单线程序列化，无需保护                       |
| 原子性   | 两次独立 I/O，无事务                   | sql.exec 自动 coalesce 为隐式事务            |
| 广播     | 跨网络 POST /broadcast + ctx.waitUntil | 同实例 this.#broadcast()，output gate 保证   |
| 输出安全 | N/A                                    | DO output gate = 响应在 write 持久化后才发出 |

#### Step 4.3 — 类型安全的 RPC 方法（替代 string dispatch）

> 社区依据：[Use RPC methods instead of the fetch() handler](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/#use-rpc-methods-instead-of-the-fetch-handler) —
> "Define public methods on your Durable Object class, and call them **directly** from stubs with **full TypeScript support**."

**不用** `dispatch(string, payload)` —— 没有编译期保障。
**用** 独立 typed RPC 方法。21 个 handler 按 RPC 特征分为三类：

##### (A) 无参数 RPC（roomCode 已由 Worker 路由到正确的 DO）

```typescript
// 只需 roomCode 的 handler → 无参 RPC
async assignRoles(): Promise<GameActionResult> {
  return this.#processAction((state) => {
    const ctx = buildHandlerContext(state, state.hostUid);
    return handleAssignRoles({ type: 'ASSIGN_ROLES' }, ctx);
  });
}

async restartGame(): Promise<GameActionResult> { /* 同模式 */ }
async clearAllSeats(): Promise<GameActionResult> { /* 同模式 */ }
async fillWithBots(): Promise<GameActionResult> { /* 同模式 */ }
async markAllBotsViewed(): Promise<GameActionResult> { /* 同模式 */ }
```

##### (B) 带参数 RPC

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

##### (C) 带 post-processing 的 RPC（extractAudioActions）

```typescript
async startNight(): Promise<GameActionResult> {
  return this.#processAction((state) => {
    const ctx = buildHandlerContext(state, state.hostUid);
    const result = handleStartNight({ type: 'START_NIGHT' }, ctx);
    if (result.kind === 'error') return result;
    // extractAudioActions 逻辑内聚到 DO 内
    const extraActions = extractAudioActions(result.sideEffects);
    if (extraActions.length > 0) {
      return handlerSuccess([...result.actions, ...extraActions], result.sideEffects);
    }
    return result;
  });
}

async endNight(): Promise<GameActionResult> {
  // 同 startNight 模式
}
```

##### (D) 读接口

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

##### (E) 初始化 + 清理

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

##### WebSocket 保持 `fetch()` handler

RPC 和 `fetch()` 可以共存在同一个 DO class 上。WebSocket upgrade 仍走 `fetch()`，不变。

#### Step 4.4 — Worker handler 改造

Worker handler 变成 thin router：参数校验 → DO RPC → 错误处理 → 返回响应。

```typescript
// handlers/gameControl.ts — handleSeat 迁移后

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

  // 参数校验保留在 Worker（fail fast，不唤醒 DO）
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

  // DO RPC —— 类型安全，直接调用
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

##### `createSimpleHandler` 也简化

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

// 使用
export const handleAssign = createSimpleHandler((stub) => stub.assignRoles());
export const handleRestart = createSimpleHandler((stub) => stub.restartGame());
export const handleClearSeats = createSimpleHandler((stub) => stub.clearAllSeats());
export const handleFillBots = createSimpleHandler((stub) => stub.fillWithBots());
export const handleMarkBotsViewed = createSimpleHandler((stub) => stub.markAllBotsViewed());
```

##### Worker 层 DO 错误处理

> 社区依据：[Error handling](https://developers.cloudflare.com/durable-objects/best-practices/error-handling/) —
> "errors may include `.retryable` and `.overloaded` properties indicating whether the operation can be retried."

```typescript
// handlers/shared.ts — 新增 helper
function getGameRoomStub(env: Env, roomCode: string): DurableObjectStub<GameRoom> {
  const id = env.GAME_ROOM.idFromName(roomCode);
  return env.GAME_ROOM.get(id);
}

/**
 * 包装 DO RPC 调用，处理 DO 特有的错误属性。
 * 若 err.retryable === true，返回 503 让客户端 retry。
 * 若 err.overloaded === true，返回 429。
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
    throw err; // 非 DO 错误，上抛给全局 catch
  }
}
```

#### Step 4.5 — `/room/create`：D1 + DO 原子性

**问题**：先写 D1 再 init DO，如果 DO init 失败，D1 已有记录但 DO 无 state。

**解法**：DO init 失败时回滚 D1 记录。

```typescript
// roomHandlers.ts — handleCreateRoom 修改
export async function handleCreateRoom(request: Request, env: Env): Promise<Response> {
  // ... 校验 token、roomCode ...

  // 1. D1 插入 room 元数据
  await env.DB.prepare(sql).bind(...params).run();

  // 2. 初始化 DO 状态（如有 initialState）
  if (body.initialState) {
    try {
      const stub = getGameRoomStub(env, body.roomCode);
      await stub.init(body.initialState as GameState);
    } catch (err) {
      // DO init 失败 → 回滚 D1 记录
      await env.DB.prepare('DELETE FROM rooms WHERE code = ?')
        .bind(body.roomCode)
        .run();
      throw err; // 上抛给全局 catch → 500
    }
  }

  return jsonResponse({ room: { ... } }, 200, env);
}
```

#### Step 4.6 — `/room/delete`：D1 + DO 清理

```typescript
// roomHandlers.ts — handleDeleteRoom 修改
export async function handleDeleteRoom(request: Request, env: Env): Promise<Response> {
  // ... 校验 ...
  const result = await env.DB.prepare('DELETE FROM rooms WHERE code = ? AND host_id = ?')
    .bind(body.roomCode, payload.sub)
    .run();
  if (!result.meta.changes) {
    return jsonResponse({ error: 'room not found or not authorized' }, 403, env);
  }

  // 清理 DO 存储（非关键路径，失败不阻塞）
  try {
    const stub = getGameRoomStub(env, body.roomCode);
    await stub.cleanup();
  } catch {
    // DO cleanup 失败不影响删除结果。
    // DO 存储会通过 cron 定期清理过期房间。
  }

  return jsonResponse({ success: true }, 200, env);
}
```

#### Step 4.7 — `/room/state` 和 `/room/revision` 改读 DO

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

**关于 DO 唤醒延迟**：revision poll 每隔 N 秒调用一次。如果 DO 在 hibernation 中，RPC 调用会自动唤醒。Hibernation 唤醒 <50ms，对 poll 场景可接受。实际上，只要有 WebSocket 连接活跃，DO 一般不会 hibernate。

### Phase 2：清理（Phase 1 验证通过后）

1. D1 `rooms` 表删除 `game_state` / `state_revision` 列
2. 删除 `lib/gameStateManager.ts`（整个文件）
3. 删除 `lib/broadcast.ts`（整个文件）
4. 删除 `handlers/shared.ts` 中旧的 `processGameAction` 相关导入

## 5. 详细文件变更清单

### 新增

| 文件                              | 说明                                                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `durableObjects/gameProcessor.ts` | `#processAction` + `buildHandlerContext` + `extractAudioActions`（从 DO class 拆出，保持 DO 文件 <400 行） |

### 修改

| 文件                         | 变更                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------ |
| `durableObjects/GameRoom.ts` | 继承 `DurableObject<Env>`；加 typed RPC 方法；保留 WebSocket fetch handler                       |
| `handlers/gameControl.ts`    | 所有 handler 改为 DO RPC 调用（参数校验保留，删除 processGameAction/broadcastIfNeeded）          |
| `handlers/night.ts`          | 同上                                                                                             |
| `handlers/shared.ts`         | `createSimpleHandler` 改为接收 `(stub) => stub.xxx()` lambda；新增 `getGameRoomStub` + `callDO`  |
| `handlers/roomHandlers.ts`   | `handleCreateRoom` 加 DO init + rollback；`handleDeleteRoom` 加 DO cleanup；读路径改 DO RPC      |
| `env.ts`                     | 不变（GAME_ROOM binding 已存在）                                                                 |
| `index.ts`                   | 不变（路由表不变）                                                                               |
| `wrangler.toml`              | 不变（migration tag "v1" + `new_sqlite_classes` 已存在；构造时 CREATE IF NOT EXISTS 无需新 tag） |

### Phase 2 删除

| 文件                      | 说明     |
| ------------------------- | -------- |
| `lib/gameStateManager.ts` | 整个文件 |
| `lib/broadcast.ts`        | 整个文件 |

### 不动

| 文件                       | 原因                             |
| -------------------------- | -------------------------------- |
| **客户端所有文件**         | HTTP 路径 + 请求/响应格式不变    |
| **`game-engine` 包**       | 纯函数，不关心调用方             |
| `handlers/authHandlers.ts` | D1 直访                          |
| `handlers/avatarUpload.ts` | R2 直访                          |
| `handlers/geminiProxy.ts`  | 外部代理                         |
| `handlers/cronHandlers.ts` | D1 清理（可加 DO stale cleanup） |

## 6. 完整 RPC 方法清单

| RPC 方法                                   | 参数                                                                   | handler 来源                                                | inlineProgression |
| ------------------------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------- |
| `assignRoles()`                            | —                                                                      | `handleAssignRoles`                                         | 否                |
| `seat(action, uid, seat, ...)`             | action, uid, seat, displayName?, avatarUrl?, avatarFrame?, targetSeat? | `handleJoinSeat` / `handleLeaveMySeat` / `handleKickPlayer` | 否                |
| `startNight()`                             | —                                                                      | `handleStartNight` + extractAudioActions                    | 否                |
| `restartGame()`                            | —                                                                      | `handleRestartGame`                                         | 否                |
| `clearAllSeats()`                          | —                                                                      | `handleClearAllSeats`                                       | 否                |
| `fillWithBots()`                           | —                                                                      | `handleFillWithBots`                                        | 否                |
| `markAllBotsViewed()`                      | —                                                                      | `handleMarkAllBotsViewed`                                   | 否                |
| `setAnimation(animation)`                  | animation: string                                                      | `handleSetRoleRevealAnimation`                              | 否                |
| `viewRole(uid, seat)`                      | uid: string, seat: number                                              | `handleViewedRole`                                          | 否                |
| `updateTemplate(roles)`                    | roles: RoleId[]                                                        | `handleUpdateTemplate`                                      | 否                |
| `updateProfile(uid, ...)`                  | uid, displayName?, avatarUrl?, avatarFrame?                            | `handleUpdatePlayerProfile`                                 | 否                |
| `shareReview(allowedSeats)`                | allowedSeats: number[]                                                 | `handleShareNightReview`                                    | 否                |
| `submitAction(seat, role, target, extra?)` | seat, role, target, extra?                                             | `handleSubmitAction`                                        | **是**            |
| `audioAck()`                               | —                                                                      | inline logic                                                | **是**            |
| `audioGate(isPlaying)`                     | isPlaying: boolean                                                     | `handleSetAudioPlaying`                                     | 否                |
| `endNight()`                               | —                                                                      | `handleEndNight` + extractAudioActions                      | 否                |
| `progression()`                            | —                                                                      | status guard                                                | **是**            |
| `revealAck()`                              | —                                                                      | inline logic                                                | **是**            |
| `wolfRobotViewed(seat)`                    | seat: number                                                           | `handleSetWolfRobotHunterStatusViewed`                      | **是**            |
| `groupConfirmAck(seat, uid)`               | seat, uid                                                              | inline logic                                                | **是**            |
| `markBotsGroupConfirmed()`                 | —                                                                      | inline logic                                                | **是**            |
| `init(state)`                              | state: GameState                                                       | —                                                           | —                 |
| `getState()`                               | —                                                                      | —                                                           | —                 |
| `getRevision()`                            | —                                                                      | —                                                           | —                 |
| `cleanup()`                                | —                                                                      | —                                                           | —                 |

## 7. 测试策略

### 7.1 现有测试不动

- `game-engine` 的单元测试：纯函数，不依赖 I/O，100% 保留
- 客户端 `GameFacade` / `seatActions` 等测试：mock HTTP API，接口不变，100% 保留
- E2E 测试（Playwright）：HTTP 路径 + 响应格式不变，100% 保留

### 7.2 新增测试

| 测试                      | 框架                                       | 说明                                                                            |
| ------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------- |
| `#processAction` 单元测试 | Vitest + `@cloudflare/vitest-pool-workers` | 验证 read-process-write-broadcast 全流程；验证 NO-OP guard；验证 ROOM_NOT_FOUND |
| 各 RPC 方法集成测试       | 同上                                       | 验证每个 RPC 正确调用 game-engine handler                                       |
| Worker → DO 端到端        | 同上                                       | 验证 Worker 参数校验 → DO RPC → Response 完整链路                               |
| 并发序列化测试            | 同上                                       | 两个 `seat('sit', ...)` 并发调用同一座位 → DO 序列化 → 只有一个成功             |
| DO error 测试             | 同上                                       | 验证 `callDO` 对 retryable/overloaded 的处理                                    |

### 7.3 验证检查清单

Phase 1 完成后，逐项验证：

- [ ] `pnpm exec tsc --noEmit` 类型检查通过
- [ ] `pnpm run test:all` 所有单元/集成测试通过
- [ ] `pnpm run e2e` 所有 E2E 测试通过
- [ ] 手动：创建房间 → 入座 → 分配 → 看牌 → 开夜 → 夜晚全流程 → 结束
- [ ] 手动：断线恢复（关 tab → 重开 → poll revision → fetchStateFromDB）
- [ ] 手动：并发入座（两设备同时点同一座位 → 只有一个成功）
- [ ] 手动：Host 重启游戏
- [ ] 手动：删除房间后重新创建同 code 房间
- [ ] 确认 D1 `rooms.game_state` 不再被写入（可 SELECT 验证）

## 8. 回滚策略

Phase 1 期间 D1 `game_state` 列**保留但不再写入**。

| 场景               | 操作                                                                              |
| ------------------ | --------------------------------------------------------------------------------- |
| 发现 bug 需回滚    | `handlers/*.ts` 恢复 `processGameAction(env.DB, ...)`；GameRoom 恢复为 relay-only |
| 数据恢复           | Phase 1 期间 D1 列还在但数据停留在迁移前的快照。新房间无 D1 数据，需看 DO 存储    |
| Phase 2 后无法回滚 | 所以 Phase 2 必须在 Phase 1 充分验证（≥1 周线上运行）后才执行                     |

## 9. 风险与缓解

| 风险                        | 概率 | 缓解                                                                  |
| --------------------------- | ---- | --------------------------------------------------------------------- |
| DO 唤醒延迟                 | 低   | Hibernation 唤醒 <50ms；游戏中 WebSocket 活跃不会 hibernate           |
| DO RPC `.retryable` 错误    | 低   | Worker 层 `callDO` 统一处理，返回 503                                 |
| `/room/create` D1↔DO 不一致 | 低   | DO init 失败时 rollback D1 记录                                       |
| GameRoom.ts 膨胀            | 中   | 拆出 `gameProcessor.ts` 模块，DO class 只做 RPC 入口 + WebSocket      |
| 迁移期间活跃房间            | 低   | 房间生命周期 <2h；深夜部署或通知用户                                  |
| Wrangler migration tag      | 无   | 已有 v1 tag + `new_sqlite_classes`；`CREATE TABLE IF NOT EXISTS` 幂等 |
| DO 被驱逐后 revision poll   | 无   | RPC 调用自动唤醒 DO → blockConcurrencyWhile → 读 SQLite               |

## 10. 工期估算

| Step    | 内容                                      | 预计代码量                              |
| ------- | ----------------------------------------- | --------------------------------------- |
| 4.1     | GameRoom 继承 DurableObject + SQLite init | ~30 行修改                              |
| 4.2     | `#processAction` 核心流程                 | ~80 行新增                              |
| 4.3     | 25 个 typed RPC 方法                      | ~250 行新增（含 gameProcessor.ts 拆分） |
| 4.4     | Worker handler 改造（21 个）              | ~净减 100 行（每个 handler 简化）       |
| 4.5-4.7 | roomHandlers 调整 + shared helpers        | ~60 行修改                              |
| 测试    | Vitest DO 测试 + 全量回归                 | ~200 行新增                             |
| Phase 2 | 删除 gameStateManager + broadcast + D1 列 | ~净减 200 行                            |
