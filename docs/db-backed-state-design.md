# DB-Backed State 设计方案

## 背景

当前 Host→Player 的 state 同步依赖 Supabase Realtime Broadcast（`httpSend`），是 at-most-once 传输。即使加了 `ack: true` + 8s auto-heal，仍然可能出现：

- 单条 broadcast 静默丢失，Player 需等 8s 才能恢复
- `REQUEST_STATE` 本身也走 broadcast（同样可能丢）
- auto-heal 产生的 snapshot request 又经过同一条不可靠通道

**根本问题**：恢复路径和主路径走同一条不可靠通道，无法保证收敛。

## 方案概述

在现有 `rooms` 表上新增 `game_state JSONB` + `state_revision INTEGER` 字段。Host 每次广播时同时 upsert 到 DB。Player 通过 `postgres_changes` 实时监听该行变更，作为 **可靠备份通道**。broadcast 保留作为低延迟快通道。

```
Host 状态变更
    │
    ├─── httpSend broadcast ──→ Player (快通道, ~50ms, at-most-once)
    │
    └─── UPDATE rooms SET game_state ──→ Supabase DB
                                             │
                                    postgres_changes (可靠, ~200ms)
                                             │
                                             ▼
                                         Player 收到 DB 变更事件
                                         applySnapshot(state, revision)
                                         revision 去重 → 只应用更新的

最坏情况（两个通道都未触发）：
    Player staleness 检测 (8s) → SELECT game_state FROM rooms → 直接读 DB 恢复
```

**两个通道同时工作，Player 无需知道哪条丢失。** `GameStore.applySnapshot()` 的 `revision > localRevision` 检查自动去重。

## Schema 变更

### Migration: `supabase/migrations/XXXXXXXX_add_game_state.sql`

```sql
-- Add game state persistence to rooms table for reliable state sync.
-- Host upserts state on every mutation; Players read via postgres_changes
-- or direct SELECT as fallback. Host in-memory GameStore remains the
-- single authority — DB is a replication target, not a source of truth.

ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS game_state JSONB,
  ADD COLUMN IF NOT EXISTS state_revision INTEGER DEFAULT 0;

-- Optimise Player fallback reads: SELECT ... WHERE code = ?
-- (idx_rooms_code already covers this, no additional index needed)
```

- 无需新表，复用现有 `rooms`
- 无需 RLS 变更（现有策略已 anyone can SELECT/UPDATE）
- `rooms` 已在 `supabase_realtime` publication 中

## 代码变更清单

### 1. `src/services/infra/RoomService.ts` — 新增 2 个方法

```typescript
/**
 * Upsert game state into rooms table.
 * Called by Host after every state mutation (broadcastCurrentState).
 */
async upsertGameState(
  roomCode: string,
  state: BroadcastGameState,
  revision: number,
): Promise<void> {
  this.ensureConfigured();

  const { error } = await supabase!
    .from('rooms')
    .update({ game_state: state, state_revision: revision })
    .eq('code', roomCode);

  if (error) {
    roomLog.warn('upsertGameState failed:', error.message);
  }
}

/**
 * Read latest game state from DB.
 * Used by Player for initial load and auto-heal fallback.
 */
async getGameState(
  roomCode: string,
): Promise<{ state: BroadcastGameState; revision: number } | null> {
  this.ensureConfigured();

  const { data, error } = await supabase!
    .from('rooms')
    .select('game_state, state_revision')
    .eq('code', roomCode)
    .single();

  if (error || !data?.game_state) return null;

  return {
    state: data.game_state as BroadcastGameState,
    revision: data.state_revision as number,
  };
}
```

**符号影响**：

- `upsertGameState` → 新增，消费者: `GameFacade.broadcastCurrentState()`
- `getGameState` → 新增，消费者: `GameFacade.joinAsPlayer()`, `useConnectionSync` auto-heal

### 2. `src/services/transport/BroadcastService.ts` — 新增 DB 变更订阅

在 `joinRoom()` 内，channel subscribe 之后，新增对 `rooms` 表 UPDATE 事件的监听：

```typescript
// In joinRoom(), after channel.subscribe():

// Subscribe to DB state changes (reliable backup channel)
this.dbChannel = supabase!
  .channel(`db-room:${roomCode}`)
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'rooms',
      filter: `code=eq.${roomCode}`,
    },
    (payload) => {
      const newRow = payload.new as { game_state?: unknown; state_revision?: number };
      if (newRow.game_state && newRow.state_revision != null) {
        broadcastLog.debug(' DB state change received, revision:', newRow.state_revision);
        if (this.onDbStateChange) {
          this.onDbStateChange(newRow.game_state as BroadcastGameState, newRow.state_revision);
        }
      }
    },
  )
  .subscribe();
```

**新增字段**：

- `private dbChannel: RealtimeChannel | null = null`
- `private onDbStateChange: ((state: BroadcastGameState, revision: number) => void) | null = null`

**`leaveRoom()` 变更**：增加 `dbChannel.unsubscribe()`。

**`joinRoom()` callbacks 参数扩展**：

```typescript
callbacks: {
  onHostBroadcast?: (message: HostBroadcast) => void;
  onPlayerMessage?: (message: PlayerMessage, senderId: string) => void;
  onPresenceChange?: (users: string[]) => void;
  onDbStateChange?: (state: BroadcastGameState, revision: number) => void;  // 新增
}
```

### 3. `src/services/facade/GameFacade.ts` — 3 处变更

#### 3a. Constructor — 注入 RoomService

```typescript
interface GameFacadeDeps {
  store: GameStore;
  broadcastService: BroadcastService;
  audioService: AudioService;
  hostStateCache: HostStateCache;
  roomService: RoomService; // 新增
}
```

**影响**：`App.tsx` composition root 需传入 `roomService`。

#### 3b. `broadcastCurrentState()` — 追加 DB upsert

```typescript
private async broadcastCurrentState(): Promise<void> {
  const state = this.store.getState();
  if (!state) return;

  const revision = this.store.getRevision();

  // Host: 保存状态到本地缓存（用于 rejoin 恢复）
  if (this.isHost) {
    void this.hostStateCache.saveState(state.roomCode, state.hostUid, state, revision);
    // 同步写入 DB（Player 通过 postgres_changes 或 SELECT 读取）
    void this.roomService.upsertGameState(state.roomCode, state, revision);
  }

  const msg: HostBroadcast = { type: 'STATE_UPDATE', state, revision };
  await this.broadcastService.broadcastAsHost(msg);
}
```

`void` 调用 — 不阻塞 broadcast 发送。DB 写入失败只 warn 日志，不影响游戏。

#### 3c. `joinAsPlayer()` — 初始状态从 DB 读 + 订阅 DB 变更

```typescript
async joinAsPlayer(roomCode: string, playerUid: string, ...): Promise<void> {
  // ... existing setup ...

  await this.broadcastService.joinRoom(roomCode, playerUid, {
    onHostBroadcast: (msg: HostBroadcast) => {
      messageRouter.playerHandleHostBroadcast(this.getMessageRouterContext(), msg);
    },
    onPlayerMessage: undefined,
    onPresenceChange: undefined,
    // 新增：DB 备份通道
    onDbStateChange: (state: BroadcastGameState, revision: number) => {
      facadeLog.debug('DB state change → applySnapshot, revision:', revision);
      this.store.applySnapshot(state, revision);
      this.broadcastService.markAsLive();
    },
  });

  // 新增：从 DB 读初始状态（替代等 HOST broadcast / REQUEST_STATE）
  const dbState = await this.roomService.getGameState(roomCode);
  if (dbState) {
    this.store.applySnapshot(dbState.state, dbState.revision);
    this.broadcastService.markAsLive();
  }

  // Send REQUEST_STATE as before (belt-and-suspenders)
  await this.broadcastService.sendToHost({ type: 'REQUEST_STATE', uid: playerUid });
}
```

Player 初始化流程变为：

1. 订阅 broadcast（现有）+ 订阅 `postgres_changes`（新增）
2. `SELECT game_state` 从 DB 读最新状态（新增）— 保证首次一定拿到
3. 发 `REQUEST_STATE`（保留）— 兜底，万一 DB 还没写入

### 4. `src/hooks/useConnectionSync.ts` — auto-heal 改读 DB

```typescript
// 现有 auto-heal (staleness 检测后):
facade.requestSnapshot(); // → 走 broadcast，可能再次丢失

// 改为：
facade.fetchStateFromDB(); // → 直接 SELECT，100% 可靠
```

**GameFacade 新增 public 方法**：

```typescript
/**
 * Player 从 DB 直接读取最新状态（auto-heal fallback）
 */
async fetchStateFromDB(): Promise<void> {
  const state = this.store.getState();
  if (!state) return;

  const dbState = await this.roomService.getGameState(state.roomCode);
  if (dbState) {
    this.store.applySnapshot(dbState.state, dbState.revision);
    this.broadcastService.markAsLive();
  }
}
```

**`IGameFacade` 接口**需新增 `fetchStateFromDB(): Promise<void>`。

`useConnectionSync` 中 auto-heal effect 改为调 `facade.fetchStateFromDB()`。
reconnect recovery（2s timer）也可改为 `facade.fetchStateFromDB()`（更可靠），`requestSnapshot()` 仅作为 REQUEST_STATE 兜底保留。

### 5. `src/services/facade/GameFacade.ts` — `leaveRoom()` 无需额外变更

`leaveRoom()` 调用 `this.broadcastService.leaveRoom()` → BroadcastService 的 `leaveRoom()` 负责 unsubscribe 所有 channel（包括新增的 `dbChannel`）。

### 6. `src/services/facade/GameFacade.ts` — `initializeAsHost()` 清空旧 state

```typescript
// In initializeAsHost(), after store.initialize():
// 清空 DB 中的旧 game_state（新游戏开始）
void this.roomService.upsertGameState(roomCode, initialState, 0);
```

确保新建房间时 DB 中是干净的初始状态。

## 文档变更清单

### `.github/copilot-instructions.md`

| 行   | 现有                                                    | 改为                                                                                                  |
| ---- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| L5   | `本地/离线为主，Supabase 仅做房间发现与 realtime 传输`  | `Supabase 负责房间发现、realtime 传输、state 持久化`                                                  |
| L92  | `Supabase 只负责 transport/discovery/identity`          | `Supabase 负责 transport/discovery/identity/state replication`                                        |
| L93  | `离线本地玩法。Host 设备同时也是玩家，不是单独裁判机。` | `Host 设备同时也是玩家，不是单独裁判机。`                                                             |
| L109 | `Supabase 绝对不能存储/校验游戏状态。`                  | `Supabase 持久化 state snapshot 供 Player 恢复，但绝不校验游戏逻辑。Host 内存 GameStore 是唯一权威。` |

### `README.md`

| 行              | 现有                               | 改为                                      |
| --------------- | ---------------------------------- | ----------------------------------------- |
| L134            | `✅ Supabase 只负责传输/发现/身份` | `✅ Supabase 负责传输/发现/身份/状态备份` |
| L142-149 架构图 | 只有 Realtime Broadcast 箭头       | 加上 DB 备份通道说明                      |

### `src/services/infra/HostStateCache.ts`

| 行  | 现有                      | 改为                                                                            |
| --- | ------------------------- | ------------------------------------------------------------------------------- |
| L9  | `Supabase 不存储游戏状态` | `HostStateCache 用于 Host 本地 rejoin 恢复；DB 中也有 state 备份供 Player 读取` |

### `src/services/infra/RoomService.ts`

| 行  | 现有                             | 改为                                                                           |
| --- | -------------------------------- | ------------------------------------------------------------------------------ |
| L10 | `❌ 禁止：存储/校验任何游戏状态` | `✅ 允许：持久化 game_state snapshot（供 Player 恢复）；❌ 禁止：校验游戏逻辑` |

### `src/services/transport/BroadcastService.ts`

| 行  | 现有                    | 改为                                                    |
| --- | ----------------------- | ------------------------------------------------------- |
| L14 | `❌ 禁止：存储游戏状态` | `❌ 禁止：存储游戏状态（DB 持久化由 RoomService 负责）` |

### `.github/instructions/services.instructions.md`

L24 新增说明：Player 除 broadcast 外，也通过 `postgres_changes` 接收 state update。

### `supabase/migrations/20260108000001_simplified_rooms.sql`

注释不改（历史事实）。新 migration 文件自带注释说明架构演进。

## 恢复场景对比

| 场景                                    | 现在                           | 加 DB 后                            |
| --------------------------------------- | ------------------------------ | ----------------------------------- |
| broadcast 正常到达                      | ✅ ~50ms                       | ✅ ~50ms（不变）                    |
| 单条 broadcast 丢失                     | ❌ 等 8s auto-heal             | ✅ ~200ms postgres_changes 自动补上 |
| 连续多条丢失                            | ❌ 8s + REQUEST_STATE 也可能丢 | ✅ 每条都有 DB 备份                 |
| Player 初次加入                         | REQUEST_STATE → 可能丢         | ✅ SELECT 从 DB 直接读              |
| Player 断线重连                         | 2s timer → REQUEST_STATE       | 2s timer → SELECT 从 DB 读          |
| auto-heal 恢复                          | REQUEST_STATE（走 broadcast）  | SELECT 从 DB 读（100% 可靠）        |
| 极端：broadcast + postgres_changes 都丢 | 不存在此路径                   | 8s staleness → SELECT 兜底          |

## 关键设计决策

1. **Host GameStore 仍是唯一权威**。DB 是复制目标（replication target），不是数据源。Host 从不读 DB state。
2. **`void` 写入 DB**。不阻塞 broadcast，不导致延迟增加，写入失败静默 warn。
3. **Player 三重保障**：broadcast（快）→ postgres_changes（可靠）→ SELECT fallback（兜底）。
4. **revision 去重已有**。`GameStore.applySnapshot()` 的 `revision > localRevision` 检查天然处理多通道重复。无需额外去重代码。
5. **无离线场景**。创建/加入房间本身就依赖 Supabase。DB 写入不增加额外的网络依赖。

## 测试变更

| 文件                                | 变更                                              |
| ----------------------------------- | ------------------------------------------------- |
| `GameFacade.test.ts`                | mock `roomService.upsertGameState`/`getGameState` |
| `restartGame.contract.test.ts`      | 同上                                              |
| `RoomService.test.ts`（如有）       | 新增 `upsertGameState`/`getGameState` 测试        |
| `BroadcastService.test.ts`（如有）  | mock `postgres_changes` 订阅                      |
| `useConnectionSync.test.ts`（如有） | auto-heal 改调 `fetchStateFromDB`                 |
| 新增 `dbStateSync.test.ts`          | 端到端测试：broadcast 丢失时 DB 通道补上          |

## 工作量估算

| 项                                                                        | 估时        |
| ------------------------------------------------------------------------- | ----------- |
| Migration SQL                                                             | 5 min       |
| RoomService 新增 2 方法                                                   | 20 min      |
| BroadcastService DB 订阅                                                  | 30 min      |
| GameFacade 改动 (broadcastCurrentState + joinAsPlayer + fetchStateFromDB) | 1 hr        |
| IGameFacade 接口 + App.tsx DI                                             | 15 min      |
| useConnectionSync auto-heal 改 DB 读                                      | 20 min      |
| 文档更新（6 个文件）                                                      | 30 min      |
| 测试更新/新增                                                             | 1.5 hr      |
| **总计**                                                                  | **~4.5 hr** |
