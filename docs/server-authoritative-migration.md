# 服务器权威架构迁移方案

> ⚠️ **本迁移已全部完成（v1.0.225）。** 本文档保留作为历史参考，其中提及的文件路径和架构可能与当前代码不一致。

## 背景与动机

### 当前问题

Host 设备是游戏逻辑的唯一权威。所有 Player 操作（入座、提交行动等）通过 Supabase Realtime broadcast 发给 Host，Host 在内存中计算后广播结果。

**致命缺陷：** 当 Host 切到后台（如刷抖音），浏览器会 throttle JS 执行，导致：

- Player 发送的 `SEAT_ACTION_REQUEST` 无人处理
- 5 秒 ACK 超时后 Player 收到"操作失败"
- 夜晚流程无法推进

### 解决方案

将游戏逻辑权威从 Host 客户端迁移到 **Vercel Serverless Functions**（服务器权威）。

---

## 架构总览

### 现在（Host 权威）

```
Player 设备 ──broadcast──→ Host 设备（内存计算）──broadcast──→ 所有设备
                              ↓ fire-and-forget
                         Supabase DB (game_state 备份)
```

### 迁移后（服务器权威）

```
任意设备 ──HTTP POST──→ Vercel API Route
                          ├─ 从 Supabase DB 读 game_state + state_revision
                          ├─ 用 @werewolf/game-engine 纯函数计算新状态
                          ├─ 写回 DB（WHERE state_revision = N，乐观锁）
                          └─ 通过 Supabase Realtime 广播新状态给所有客户端
                       ←── HTTP 200 (result)

所有设备 ←── Supabase Realtime ←── 状态更新
```

### 为什么 Vercel + Supabase

| 职责         | 负责方                      | 原因                                                                     |
| ------------ | --------------------------- | ------------------------------------------------------------------------ |
| 游戏逻辑计算 | **Vercel Serverless**       | Node.js 运行时，与 app 同 monorepo 同 toolchain，原生支持 pnpm workspace |
| 状态持久化   | **Supabase DB**             | 已有 `rooms.game_state` JSONB + `state_revision` 乐观锁，零改动          |
| 实时广播     | **Supabase Realtime**       | 已有 WebSocket 基础设施，客户端已接入                                    |
| 房间生命周期 | **客户端直连 Supabase**     | 创建/加入/关闭房间不涉及 Host，无需迁移                                  |
| Auth / 头像  | **Supabase Auth + Storage** | 完全不涉及游戏逻辑，保持现状                                             |
| 音频播放     | **Host 设备本地**           | 音频是 UI 行为，不是游戏逻辑                                             |

### 当前 Supabase 持久化清单

| #   | 数据                     | 存储位置                          | 写入时机     | 写入方 |
| --- | ------------------------ | --------------------------------- | ------------ | ------ |
| 1   | 房间记录 (code, host_id) | `rooms` 表 INSERT                 | 创建房间     | Host   |
| 2   | 游戏状态快照             | `rooms.game_state` JSONB (UPDATE) | 每次状态变更 | Host   |
| 3   | 房间查询                 | `rooms` 表 SELECT                 | 加入房间     | Both   |
| 4   | 房间删除                 | `rooms` 表 DELETE                 | 关闭房间     | Host   |
| 5   | 头像图片                 | `avatars` 存储桶                  | 上传头像     | Both   |
| 6   | 用户身份                 | `auth.users` (托管)               | 注册/登录    | Both   |
| 7   | 用户元数据               | `auth.users.user_metadata` (托管) | 改资料       | Both   |

本地存储（AsyncStorage）：Host 状态缓存 (rejoin 用) + 用户设置。

---

## 当前代码架构层级

```
UI (Screens/Components)
  ↓ calls
GameFacade (生命周期 + context 构建器)
  ↓ delegates to
hostActions / seatActions / messageRouter (编排 + IO)
  ↓ calls
handlers (纯验证 + actions) → 返回 HandlerResult { actions, sideEffects }
  ↓ actions applied via
gameReducer → GameStore.setState() → normalizeState() → 通知 listeners
  ↓ side effects executed by
facade 层 (broadcastCurrentState, playAudio, setAudioPlayingGate)
  ↓ broadcast via
BroadcastService → Supabase Realtime
  ↓ persisted via
HostStateCache (本地) + RoomService.upsertGameState (Supabase DB)
```

**IO 操作汇总：**

1. `broadcastService.broadcastAsHost(msg)` — 发送 HostBroadcast
2. `broadcastService.sendToHost(msg)` — Player 发送 PlayerMessage
3. `hostStateCache.saveState(...)` — 本地缓存持久化
4. `roomService.upsertGameState(...)` — DB 持久化
5. `audioService.playNightAudio/playRoleBeginningAudio/...` — 音频播放
6. `broadcastService.markAsLive()` — 标记连接存活

---

## 分阶段执行计划

---

### Phase 0：提取 `@werewolf/game-engine` 共享包

**目标：** 把纯游戏逻辑提取为独立的 pnpm workspace 包，客户端和服务端均可 import。

**为什么需要这步：** Vercel Serverless Functions 运行在 Node.js 环境，无法 import React Native / Expo 依赖（`react-native`, `expo-audio`, `expo-crypto` 等）。必须将无平台依赖的纯逻辑代码分离出来，使其可以同时被客户端（React Native）和服务端（Node.js）import。

#### 0.1 包结构

```
WerewolfGameJudge/
├── packages/
│   └── game-engine/
│       ├── package.json          # name: "@werewolf/game-engine"
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts          # 统一导出
│           ├── models/
│           │   ├── roles/        # ← from src/models/roles/
│           │   ├── actions/      # ← from src/models/actions/WitchAction.ts
│           │   ├── GameStatus.ts # ← from src/models/GameStatus.ts
│           │   └── Template.ts   # ← from src/models/Template.ts
│           ├── engine/
│           │   ├── handlers/     # ← from src/services/engine/handlers/
│           │   ├── reducer/      # ← from src/services/engine/reducer/
│           │   ├── store/        # ← from src/services/engine/store/
│           │   ├── intents/      # ← from src/services/engine/intents/
│           │   ├── state/        # ← from src/services/engine/state/
│           │   ├── DeathCalculator.ts
│           │   └── resolveWolfVotes.ts
│           ├── resolvers/        # ← from src/services/night/resolvers/
│           ├── protocol/         # ← from src/services/protocol/
│           └── types/
│               └── RoleRevealAnimation.ts  # ← from src/types/RoleRevealAnimation.ts
├── pnpm-workspace.yaml           # packages: ['packages/*']
├── src/                          # React Native app（消费者）
├── api/                          # Vercel API Routes（消费者，Phase 1 加）
└── ...
```

#### 0.2 移动的文件统计

| 来源                                      | 文件数  | 行数       | 内容                                                                                                                                                         |
| ----------------------------------------- | ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/models/roles/**`                     | ~15     | ~1,900     | 角色定义、schema、nightSteps、plan                                                                                                                           |
| `src/models/actions/WitchAction.ts`       | 1       | 91         | 纯类型 + 工厂函数                                                                                                                                            |
| `src/models/GameStatus.ts`                | 1       | 8          | 纯 enum                                                                                                                                                      |
| `src/models/Template.ts`                  | 1       | ~100       | 模板类型 + 创建/验证函数                                                                                                                                     |
| `src/services/engine/handlers/`           | 8       | ~2,820     | seatHandler, actionHandler, stepTransitionHandler, gameControlHandler, progressionEvaluator, wolfRobotHunterGateHandler, witchContext, confirmContext, types |
| `src/services/engine/reducer/`            | 3       | ~970       | gameReducer, types, index                                                                                                                                    |
| `src/services/engine/store/`              | 3       | ~230       | GameStore, types, index                                                                                                                                      |
| `src/services/engine/intents/`            | 1       | 237        | 18 种 intent 类型定义                                                                                                                                        |
| `src/services/engine/state/`              | 1       | 119        | normalizeState                                                                                                                                               |
| `src/services/engine/DeathCalculator.ts`  | 1       | 348        | 死亡计算                                                                                                                                                     |
| `src/services/engine/resolveWolfVotes.ts` | 1       | 50         | 狼刀投票解算                                                                                                                                                 |
| `src/services/night/resolvers/`           | ~15     | ~1,100     | 13 个 resolver + constraintValidator + types                                                                                                                 |
| `src/services/protocol/`                  | 2       | ~300       | types + reasonCodes                                                                                                                                          |
| `src/types/RoleRevealAnimation.ts`        | 1       | 86         | 纯类型 + hash 函数                                                                                                                                           |
| **合计**                                  | **~56** | **~8,400** |                                                                                                                                                              |

#### 0.3 需要抽象的 3 个依赖

56 个候选文件中只有 8 个有外部依赖，且仅涉及 3 个 utility：

| 依赖              | 根源                          | 使用文件                                                                                                                                                          | 解决方案                                                                                                                                                    |
| ----------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@/utils/logger`  | `react-native-logs` 库        | `actionHandler.ts`, `progressionEvaluator.ts`, `stepTransitionHandler.ts`, `wolfRobotHunterGateHandler.ts`, `GameStore.ts`, `models/roles/index.ts` (共 6 个文件) | 在 game-engine 中定义 `Logger` 接口 + `setLogger()` 注入函数；App 启动时调用 `setLogger(reactNativeLogsInstance)`；Vercel 端调用 `setLogger(consoleLogger)` |
| `@/utils/id`      | `expo-crypto` (fallback)      | `actionHandler.ts` (`newRejectionId`)、`gameReducer.ts` (`randomHex`) (共 2 个文件)                                                                               | 改用标准 Web Crypto API (`crypto.getRandomValues()`)，Node 19+ / Deno / 所有现代浏览器原生支持，不再需要 expo-crypto fallback                               |
| `@/utils/shuffle` | `expo-crypto` via `random.ts` | `gameControlHandler.ts` (`shuffleArray`) (共 1 个文件)                                                                                                            | `shuffleArray` 已支持 `Rng` 注入参数，在 game-engine 内提供基于 Web Crypto 的默认 `Rng` 实现                                                                |

**零 React Native / Expo UI 依赖。** 没有任何候选文件 import React、React Native 或 Expo UI 组件。

#### 0.4 App 端需更新 import 的文件

| 原 import 路径                | 新 import 路径                                    | 影响文件数 |
| ----------------------------- | ------------------------------------------------- | ---------- |
| `@/models/roles`              | `@werewolf/game-engine/models/roles`              | ~30        |
| `@/models/GameStatus`         | `@werewolf/game-engine/models/GameStatus`         | 15         |
| `@/models/Template`           | `@werewolf/game-engine/models/Template`           | 13         |
| `@/services/protocol/`        | `@werewolf/game-engine/protocol`                  | 12         |
| `@/types/RoleRevealAnimation` | `@werewolf/game-engine/types/RoleRevealAnimation` | 11         |
| `@/services/engine/`          | `@werewolf/game-engine/engine`                    | 4          |
| `@/services/night/`           | `@werewolf/game-engine/resolvers`                 | 1          |
| `@/models/actions/`           | `@werewolf/game-engine/models/actions`            | 1          |

**热点文件**（import ≥3 个候选模块）：

- `src/hooks/adapters/broadcastToLocalState.ts` — roles, GameStatus, Template, WitchAction, protocol
- `src/hooks/useGameRoom.ts` — roles, GameStatus, Template, RoleRevealAnimation
- `src/screens/RoomScreen/hooks/useRoomScreenState.ts` — roles, GameStatus, Template, RoleRevealAnimation
- `src/services/facade/hostActions.ts` — engine, roles, Template, protocol, RoleRevealAnimation

#### 0.5 配置变更

| 文件                                 | 变更                                                                                           |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `pnpm-workspace.yaml`                | **新建**，`packages: ['packages/*']`                                                           |
| `packages/game-engine/package.json`  | **新建**，`name: "@werewolf/game-engine"`, `main: "src/index.ts"`                              |
| `packages/game-engine/tsconfig.json` | **新建**，独立编译配置                                                                         |
| 根 `package.json`                    | **修改**，`dependencies` 加 `"@werewolf/game-engine": "workspace:*"`                           |
| 根 `tsconfig.json`                   | **修改**，`compilerOptions.paths` 加 `@werewolf/game-engine/*` 映射                            |
| `jest.config.js`                     | **修改**，`moduleNameMapper` 加 `@werewolf/game-engine` → `<rootDir>/packages/game-engine/src` |
| `metro.config.js`                    | **修改**，`watchFolders` 加 `packages/` 目录                                                   |

#### 0.6 验证标准

- `pnpm exec tsc --noEmit` — 类型检查通过
- `pnpm exec jest --no-coverage --forceExit` — 全部 2713 单元测试通过
- E2E 不受影响（测 UI 行为，不涉及 import 路径）

#### 0.7 风险

- **低风险**：纯文件移动 + import 更新，TypeScript 编译器会抓住所有路径错误
- **唯一注意**：co-located `__tests__/` 目录需要跟随移动或保留原位（建议跟随移动）

#### 0.8 Commit 计划（4 commits）

| #   | message                                                        | 内容                                                                                                                                                                                                                                                                          | 验证       |
| --- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | `chore: scaffold @werewolf/game-engine package`                | `pnpm-workspace.yaml`、`packages/game-engine/{package.json, tsconfig.json, src/index.ts}`、根 `tsconfig.json` 加 paths、`jest.config.js` 加 moduleNameMapper、`metro.config.js` 加 watchFolders、根 `package.json` 加 workspace 依赖、game-engine 内 logger/id/shuffle 抽象层 | tsc + jest |
| 2   | `refactor(models): move models to game-engine`                 | 移动 `src/models/roles/**`、`GameStatus.ts`、`Template.ts`、`WitchAction.ts` → `packages/game-engine/src/models/`；更新 ~30 个消费者 import                                                                                                                                   | tsc + jest |
| 3   | `refactor(services): move protocol + resolvers to game-engine` | 移动 `src/services/protocol/**`、`src/services/night/resolvers/**`、`src/types/RoleRevealAnimation.ts` → game-engine；更新 ~25 个消费者 import                                                                                                                                | tsc + jest |
| 4   | `refactor(services): move engine to game-engine`               | 移动 `src/services/engine/{handlers,reducer,store,intents,state,DeathCalculator,resolveWolfVotes}` → game-engine；更新 ~5 个消费者 import；完善 barrel export                                                                                                                 | tsc + jest |

依赖方向：models → protocol/resolvers → engine，按此顺序移动确保每个 commit 后编译通过。

---

### Phase 1：入座/离座 → Vercel API

**目标：** 迁移第一个操作到服务端，验证端到端流程。选择入座/离座是因为它是最简单的操作（无音频、无后续自动推进）。

#### 1.1 当前流程（详细）

**Player 入座：**

```
1. Player UI → takeSeat(seatNumber) [seatActions.ts]
2. → playerSendSeatActionWithAck(ctx, 'sit', seat, pendingSeatAction, displayName, avatarUrl)
3.   → 取消旧的 pending request（如果有）
4.   → 生成 requestId（via generateRequestId()）
5.   → 创建 Promise + 5s setTimeout（超时 → resolve { success: false, reason: REASON_TIMEOUT }）
6.   → broadcastService.sendToHost({ type: 'SEAT_ACTION_REQUEST', requestId, action: 'sit', seat, uid, displayName, avatarUrl })
7.   → 等待 Promise
8. Host 收到 broadcast → messageRouter.hostHandlePlayerMessage(ctx, msg)
9.   → case 'SEAT_ACTION_REQUEST' → hostHandleSeatActionRequest(ctx, msg)
10.  → 构建 SeatActionsContext → hostProcessJoinSeat(ctx, seat, uid, displayName, avatarUrl)
11.    → 构建 JoinSeatIntent + HandlerContext
12.    → handleJoinSeat(intent, handlerCtx) [纯函数，seatHandler.ts]
13.      → 5 步验证链：state存在 → 已认证 → 座位有效 → 座位未占 → 游戏未进行
14.      → 成功：返回 PLAYER_JOIN action（+ 可选 PLAYER_LEAVE 用于换座）
15.    → applyActions(store, state, actions) → gameReducer 逐个 apply
16.    → broadcastCurrentState() → broadcast STATE_UPDATE + 写 DB + 写本地缓存
17.  → sendSeatActionAck(broadcastService, requestId, uid, success, seat, reason?)
18. Player 收到 broadcast → playerHandleHostBroadcast(ctx, msg, pendingSeatAction)
19.  → case 'SEAT_ACTION_ACK' → 匹配 requestId → clearTimeout → resolve promise
20. Player 得到 { success: true } / { success: false, reason }
```

**Player 离座：**
同上逻辑，action='standup'，调用 `handleLeaveMySeat`。验证链：state存在 → 已认证 → 已入座 → 游戏未进行中。

**Host 自己入座/离座：**
跳过 broadcast 直接调用 `hostProcessJoinSeat` / `hostProcessLeaveMySeat`（本地处理）。

#### 1.2 新增文件

```
api/
├── game/
│   └── seat.ts                 # POST /api/game/seat
└── _lib/
    ├── supabase.ts             # Supabase service role client 单例
    ├── gameStateManager.ts     # 读 DB → 算新状态 → 写 DB → 广播（通用模式）
    └── types.ts                # API 请求/响应类型
```

#### 1.3 通用服务端模式 — `gameStateManager.ts`

Phase 1-3 所有 API Route 共享同一个处理模式，抽为通用函数：

```typescript
import { gameReducer, normalizeState, StateAction } from '@werewolf/game-engine';
import type { BroadcastGameState } from '@werewolf/game-engine';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // service role，绕过 RLS
);

/**
 * 通用的"读-算-写-广播"流程。
 * 所有 API Route 的核心步骤都是：
 * 1. 从 DB 读 game_state + state_revision
 * 2. 调用 game-engine 纯函数处理 intent → HandlerResult
 * 3. 用 gameReducer 将 actions apply 到 state
 * 4. 用 state_revision 做乐观锁写回 DB
 * 5. 通过 Supabase Realtime 广播新状态
 *
 * @param roomCode 房间号
 * @param process  接收当前 state，返回 { success, reason?, actions, sideEffects? }
 * @returns { success, reason?, state?, sideEffects? }
 */
export async function processGameAction(
  roomCode: string,
  process: (
    state: BroadcastGameState,
    revision: number,
  ) => {
    success: boolean;
    reason?: string;
    actions: StateAction[];
    sideEffects?: string[];
  },
): Promise<{
  success: boolean;
  reason?: string;
  state?: BroadcastGameState;
  sideEffects?: string[];
}> {
  // Step 1: 读 DB
  const { data, error: readError } = await supabase
    .from('rooms')
    .select('game_state, state_revision')
    .eq('code', roomCode)
    .single();

  if (readError || !data?.game_state) {
    return { success: false, reason: 'ROOM_NOT_FOUND' };
  }

  const currentState = data.game_state as BroadcastGameState;
  const currentRevision = data.state_revision as number;

  // Step 2: 调用 game-engine 纯函数
  const result = process(currentState, currentRevision);

  if (!result.success) {
    return { success: false, reason: result.reason };
  }

  // Step 3: apply actions → 新 state
  let newState = currentState;
  for (const action of result.actions) {
    newState = gameReducer(newState, action);
  }
  newState = normalizeState(newState);

  // Step 4: 乐观锁写回 DB
  const { error: writeError } = await supabase
    .from('rooms')
    .update({
      game_state: newState,
      state_revision: currentRevision + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('code', roomCode)
    .eq('state_revision', currentRevision); // 乐观锁

  if (writeError) {
    return { success: false, reason: 'CONFLICT_RETRY' };
  }

  // Step 5: 广播
  const channel = supabase.channel(`room:${roomCode}`);
  await channel.send({
    type: 'broadcast',
    event: 'host',
    payload: {
      type: 'STATE_UPDATE',
      state: newState,
      revision: currentRevision + 1,
    },
  });
  await supabase.removeChannel(channel);

  return {
    success: true,
    state: newState,
    sideEffects: result.sideEffects,
  };
}
```

#### 1.4 `api/game/seat.ts` — 入座/离座 API

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  handleJoinSeat,
  handleLeaveMySeat,
  type JoinSeatIntent,
  type LeaveMySeatIntent,
  type HandlerContext,
} from '@werewolf/game-engine';
import { processGameAction } from '../_lib/gameStateManager';

interface SeatRequest {
  roomCode: string;
  action: 'sit' | 'standup';
  uid: string;
  seatIndex?: number; // action='sit' 时必填
  displayName?: string;
  avatarUrl?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { roomCode, action, uid, seatIndex, displayName, avatarUrl } = req.body as SeatRequest;

  if (!roomCode || !uid || !action) {
    return res.status(400).json({ success: false, reason: 'MISSING_PARAMS' });
  }

  const result = await processGameAction(roomCode, (state) => {
    const handlerCtx: HandlerContext = { getState: () => state };

    if (action === 'sit') {
      const intent: JoinSeatIntent = {
        type: 'JOIN_SEAT',
        uid,
        seatIndex: seatIndex!,
        displayName,
        avatarUrl,
      };
      return handleJoinSeat(intent, handlerCtx);
    } else {
      // 找到 uid 对应的座位号
      const mySeat = Object.entries(state.players).find(([, p]) => p?.uid === uid)?.[0];
      const intent: LeaveMySeatIntent = {
        type: 'LEAVE_MY_SEAT',
        uid,
        mySeat: mySeat ? Number(mySeat) : null,
      };
      return handleLeaveMySeat(intent, handlerCtx);
    }
  });

  return res.status(result.success ? 200 : 400).json(result);
}
```

#### 1.5 客户端变更

**改动文件清单：**

| 文件                                                | 变更                                                                                             |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/services/facade/seatActions.ts`                | **大改**：删除 broadcast 协议逻辑，改为 HTTP 调用                                                |
| `src/services/facade/messageRouter.ts`              | **删减**：删除 `hostHandleSeatActionRequest` + `sendSeatActionAck` + `playerHandleSeatActionAck` |
| `src/services/protocol/types.ts`                    | **删减**：删除 `SEAT_ACTION_REQUEST` (PlayerMessage) + `SEAT_ACTION_ACK` (HostBroadcast)         |
| `src/config/supabase.ts` 或新建 `src/config/api.ts` | **新增**：API base URL 配置                                                                      |
| `vercel.json`                                       | **修改**：API routes 不被 SPA rewrite 拦截                                                       |

**`seatActions.ts` 变更详情：**

| 删除                            | 原因                     |
| ------------------------------- | ------------------------ |
| `ACK_TIMEOUT_MS` 常量           | 不再需要超时             |
| `PendingSeatAction` 类型        | 不再需要 pending promise |
| `playerSendSeatActionWithAck()` | 整个函数删除             |
| `sendToHost` 调用               | 不再通过 broadcast 发送  |

| 保留/改造                               | 新实现                                                                                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `takeSeatWithAck(ctx, seatNumber, ...)` | Player + Host 统一改为 `fetch('/api/game/seat', { method: 'POST', body: { roomCode, action: 'sit', uid, seatIndex, displayName, avatarUrl } })` |
| `leaveSeatWithAck(ctx)`                 | 统一改为 `fetch('/api/game/seat', { method: 'POST', body: { roomCode, action: 'standup', uid } })`                                              |
| `takeSeat()` / `leaveSeat()`            | 包装函数保留，调用改造后的 `*WithAck`                                                                                                           |

**Host 和 Player 不再有区别**：统一走 HTTP。`hostProcessJoinSeat` / `hostProcessLeaveMySeat` 删除。

**`messageRouter.ts` 变更详情：**

| 删除                                                    | 原因                             |
| ------------------------------------------------------- | -------------------------------- |
| `hostHandleSeatActionRequest()` 私有函数                | 整个 Host 端座位转发逻辑不再需要 |
| `sendSeatActionAck()` 私有函数                          | ACK 协议不再需要                 |
| `playerHandleSeatActionAck()` 私有函数                  | ACK 协议不再需要                 |
| `hostHandlePlayerMessage` 中 `SEAT_ACTION_REQUEST` case | 不再经过 broadcast               |
| `playerHandleHostBroadcast` 中 `SEAT_ACTION_ACK` case   | 不再经过 broadcast               |

**`vercel.json` 变更：**

```jsonc
{
  "rewrites": [
    // API routes 不被 SPA rewrite 拦截（排在前面）
    { "source": "/api/(.*)", "destination": "/api/$1" },
    // SPA fallback
    { "source": "/(.*)", "destination": "/index.html" },
  ],
  // ... 其余 headers 不变
}
```

**环境变量（Vercel Dashboard 配置）：**

| 变量名                      | 值                        | 用途                                       |
| --------------------------- | ------------------------- | ------------------------------------------ |
| `SUPABASE_URL`              | `https://xxx.supabase.co` | Supabase 项目 URL                          |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbG...`               | Service role key（绕过 RLS，仅服务端使用） |

#### 1.6 验证标准

- `pnpm exec tsc --noEmit` — 类型检查通过
- 单元测试：更新 seatActions / messageRouter 相关测试
- E2E：`seating.spec.ts` 6 个测试全部通过（验证真实入座/离座行为）
- 手动测试：Player 入座 → 即时生效；Host 切后台 → Player 仍可入座

#### 1.7 回滚方案

如果 Vercel API 有问题，可以在客户端加 feature flag 切回 broadcast 模式。两套代码共存，flag 控制走 HTTP 还是 broadcast。

#### 1.8 Commit 计划（3 commits）

| #   | message                                                | 内容                                                                                                                                                                                                     | 验证                     |
| --- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 1   | `feat(api): add seat API route + gameStateManager`     | 新增 `api/game/seat.ts`、`api/_lib/{supabase,gameStateManager,types}.ts`；更新 `vercel.json` API rewrite；Vercel 环境变量配置                                                                            | tsc                      |
| 2   | `refactor(services): migrate seat ops to HTTP`         | `seatActions.ts` 改 HTTP 调用（删除 ACK timeout / PendingSeatAction / broadcast 协议）；`messageRouter.ts` 删除 SEAT_ACTION_REQUEST/ACK 处理；`protocol/types.ts` 删除对应类型；新增 `src/config/api.ts` | tsc + jest               |
| 3   | `test(services): update seat tests for HTTP migration` | 更新/重写 seatActions / messageRouter 相关测试                                                                                                                                                           | tsc + jest + E2E seating |

---

### Phase 2：游戏控制 → Vercel API

**目标：** 迁移分配角色、填充机器人、开始游戏、重新开始等操作到服务端。

#### 2.1 当前流程（详细）

以下操作目前都由 Host 本地执行，通过 `hostActions.ts` 调用 handler 纯函数 → apply actions → broadcastCurrentState()。

**分配角色 `assignRoles(ctx)`：**

```
1. Host UI → facade.assignRoles()
2. → hostActions.assignRoles(ctx)
3.   → buildHandlerContext(ctx) → HandlerContext { getState }
4.   → handleAssignRoles(intent, handlerCtx) [纯函数]
5.     → 验证：host_only → state → status=seated → role_count == seat_count
6.     → shuffleArray(templateRoles) → 随机分配
7.     → 返回 ASSIGN_ROLES action
8.   → processHandlerResult(ctx, result)
9.     → applyActions → gameReducer → store.setState
10.    → broadcastCurrentState() → broadcast + 写 DB
```

**填充机器人 `fillWithBots(ctx)`：**

```
同上模式：handleFillWithBots → FILL_WITH_BOTS action
验证：host_only → state → status=unseated
```

**标记看牌 `markViewedRole(ctx, seat)`：**

```
同上模式：handleViewedRole → PLAYER_VIEWED_ROLE action
验证：host_only → state → seat有效 → 已分配角色
之后调用 callNightProgression（检查是否全部看完 → 进入 ready 状态）
```

**开始夜晚 `startNight(ctx)`：**

```
1. handleStartNight(intent, handlerCtx) [纯函数]
2.   → 验证：host_only → state → status=ready → nightPlan 非空
3.   → buildNightPlan(templateRoles) → 获取 nightPlan.steps[0]
4.   → 返回 actions: START_NIGHT + 可选 SET_WITCH_CONTEXT + SET_CONFIRM_STATUS
5.   → 返回 sideEffects: BROADCAST_STATE + SAVE_STATE + PLAY_AUDIO('night') + PLAY_AUDIO(firstStep.audioKey)
6. processHandlerResult(ctx, result)
7.   → applyActions
8.   → 检测到 PLAY_AUDIO side effects:
9.     → setAudioPlayingGate(true) → dispatch SET_AUDIO_PLAYING
10.    → broadcastCurrentState()
11.    → playAudio('night') → playAudio(firstStep.audioKey)
12.    → setAudioPlayingGate(false)
```

**重新开始 `restartGame(ctx)`：**

```
同上模式：handleRestartGame → RESTART_GAME action
验证：host_only（任何状态都可以重新开始）
重置 progressionTracker
```

#### 2.2 新增文件

```
api/game/
├── assign.ts       # POST /api/game/assign — 分配角色
├── fill-bots.ts    # POST /api/game/fill-bots — 填充机器人
├── start.ts        # POST /api/game/start — 开始夜晚
├── restart.ts      # POST /api/game/restart — 重新开始
├── view-role.ts    # POST /api/game/view-role — 标记看牌
├── update-template.ts  # POST /api/game/update-template — 更新模板
└── set-animation.ts    # POST /api/game/set-animation — 设置揭牌动画
```

#### 2.3 API 设计

每个 API 都是同一个模式，差异只在 request body 和调用的 handler：

```typescript
// POST /api/game/assign
{ roomCode: "1234", hostUid: "abc" }
// → handleAssignRoles(intent, ctx) → ASSIGN_ROLES action

// POST /api/game/fill-bots
{ roomCode: "1234", hostUid: "abc" }
// → handleFillWithBots(intent, ctx) → FILL_WITH_BOTS action

// POST /api/game/start
{ roomCode: "1234", hostUid: "abc" }
// → handleStartNight(intent, ctx) → START_NIGHT + optional actions
// → 返回 sideEffects: ['PLAY_AUDIO:night', 'PLAY_AUDIO:seer_begin'] 给客户端

// POST /api/game/restart
{ roomCode: "1234", hostUid: "abc" }
// → handleRestartGame(intent, ctx) → RESTART_GAME action

// POST /api/game/view-role
{ roomCode: "1234", hostUid: "abc", seat: 3 }
// → handleViewedRole(intent, ctx) → PLAYER_VIEWED_ROLE action

// 统一响应格式
{
  success: true,
  state: BroadcastGameState,
  sideEffects?: string[]    // e.g. ['PLAY_AUDIO:night', 'PLAY_AUDIO:seer_begin']
}
```

#### 2.4 音频 Side Effects 处理

**关键变化：** 现在 `processHandlerResult` 在 Host 端直接调用 `audioService` 播放音频。迁移后：

1. **服务端** 不播放音频，只在响应中返回 `sideEffects` 列表（如 `['PLAY_AUDIO:night', 'PLAY_AUDIO:seer_begin']`）
2. **Host 客户端** 收到响应后，按顺序播放音频
3. **Player 客户端** 收到 Realtime 广播的 `STATE_UPDATE`，不播放音频

```typescript
// Host 客户端处理响应
const result = await fetch('/api/game/start', { ... }).then(r => r.json());
if (result.success && result.sideEffects) {
  await setAudioPlayingGate(true);
  for (const effect of result.sideEffects) {
    if (effect.startsWith('PLAY_AUDIO:')) {
      const audioKey = effect.replace('PLAY_AUDIO:', '');
      await playAudio(audioKey);
    }
  }
  await setAudioPlayingGate(false);
}
```

**注意：** `SET_AUDIO_PLAYING` 状态的设置也需要通过 API 调用（确保服务端 state 同步）。或者由服务端在 actions 中包含 `SET_AUDIO_PLAYING` action。

#### 2.5 客户端变更

**改动文件清单：**

| 文件                                   | 变更                                                                       |
| -------------------------------------- | -------------------------------------------------------------------------- |
| `src/services/facade/hostActions.ts`   | **大改**：所有 game control 方法改为 HTTP 调用 + 本地音频编排              |
| `src/services/facade/GameFacade.ts`    | **修改**：`getHostActionsContext()` 简化（删除 store 直接操作）            |
| `src/services/facade/messageRouter.ts` | **删减**：删除 `VIEWED_ROLE`, `REVEAL_ACK` 等 playerMessage 的 Host 端处理 |

**`hostActions.ts` 变更详情：**

删除的：

- `applyActions()` 私有函数 — 不再在客户端 apply actions
- `buildHandlerContext()` 私有函数 — 不再构建 handler context
- `processHandlerResult()` 私有函数 — 部分逻辑移到 API 响应处理

保留/改造的：

- 每个公开方法保留签名不变
- 内部实现从"调用 handler → apply → broadcast"改为"fetch API → 播放音频"
- `callNightProgression()` — 仍在客户端（因为涉及音频编排的递归推进，见 Phase 3）

#### 2.6 `hostProcessJoinSeat` vs API 的 host_only 验证

现在 handler 用 `intent.isHostIntent` 验证 host_only。迁移后：

- **入座/离座（Phase 1）**：不需要 host_only 验证，Player 也能调用
- **游戏控制（Phase 2）**：仍需要 host_only 验证。API 端通过比对 `req.body.hostUid === rooms.host_id` 实现

```typescript
// api/game/assign.ts
const { roomCode, hostUid } = req.body;
const result = await processGameAction(roomCode, (state) => {
  // 服务端验证 host 身份
  if (state.hostUid !== hostUid) {
    return { success: false, reason: 'NOT_HOST', actions: [] };
  }
  return handleAssignRoles({ type: 'ASSIGN_ROLES', isHostIntent: true }, { getState: () => state });
});
```

#### 2.7 验证标准

- `pnpm exec tsc --noEmit` — 通过
- 单元测试：更新 hostActions / messageRouter 相关测试
- E2E：`night-2p.spec.ts`、`night-6p.spec.ts` 全部通过
- 手动测试：Host 分配角色 → 所有玩家看到自己的角色

#### 2.8 Commit 计划（3 commits）

| #   | message                                                        | 内容                                                                                                                                                                       | 验证                   |
| --- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 1   | `feat(api): add game control API routes`                       | 新增 `api/game/{assign,fill-bots,start,restart,view-role,update-template,set-animation}.ts`（7 个 route）                                                                  | tsc                    |
| 2   | `refactor(services): migrate game control to HTTP`             | `hostActions.ts` 所有 game control 方法改 HTTP 调用 + 本地音频编排；`messageRouter.ts` 删除 VIEWED_ROLE / REVEAL_ACK 等 Host 端处理；`GameFacade.ts` 简化 context builders | tsc + jest             |
| 3   | `test(services): update game control tests for HTTP migration` | 更新/重写 hostActions / messageRouter / GameFacade 相关测试                                                                                                                | tsc + jest + E2E night |

---

### Phase 3：夜晚流程 → Vercel API

**目标：** 迁移夜晚行动提交、步骤推进、夜晚结束到服务端。**这是最复杂的部分**，因为涉及音频编排和自动推进的递归逻辑。

#### 3.1 当前流程（详细）

##### 3.1.1 提交行动 `submitAction(ctx, seat, role, target, extra?)`

```
1. Player 提交行动 → broadcast ACTION { seat, role, target, extra }
2. Host 收到 → messageRouter → ctx.handleAction(seat, role, target, extra)
3. → hostActions.submitAction(ctx, seat, role, target, extra)
4.   → handleSubmitAction(intent, handlerCtx) [纯函数，792 行]
5.     → validateActionPreconditions() — 7 步验证：
6.       host_only → state → status=ongoing → 音频未播放 →
7.       step 匹配 → seat 有效 → role 匹配（wolfKill 步允许所有狼人）→ resolver 存在
8.     → checkNightmareBlockGuard() — 梦魇阻断检查
9.     → RESOLVERS[schemaId](input, context) — 调用 resolver 纯函数
10.    → resolver 返回 valid: false → buildRejectionResult() → ACTION_REJECTED action
11.    → resolver 返回 valid: true → buildSuccessResult():
12.      → RECORD_ACTION (记录 ProtocolAction)
13.      → APPLY_RESOLVER_RESULT (应用 resolver 结果，含 reveal 数据)
14.      → 如果 schema 有 revealKind: ADD_REVEAL_ACK (阻断推进等 UI 确认)
15.  → processHandlerResult(ctx, result)
16.  → 如果成功：callNightProgression(ctx)
```

##### 3.1.2 提交狼人投票 `submitWolfVote(ctx, voterSeat, targetSeat)`

```
1. Player 投票 → broadcast WOLF_VOTE { seat, target }
2. Host 收到 → messageRouter → ctx.handleWolfVote(voterSeat, targetSeat)
3. → hostActions.submitWolfVote(ctx, voterSeat, targetSeat)
4.   → handleSubmitWolfVote(intent, handlerCtx) [纯函数]
5.     → 快速验证 → 解析 voter 真实 role → 委托 handleSubmitAction
6.     → 特殊：target=-1 映射为 null（空刀）
7.   → processHandlerResult
8.   → Wolf vote timer 逻辑：
9.     decideWolfVoteTimerAction(allVoted, hasTimer, now)
10.    → 'set': 清旧 timer → SET_WOLF_VOTE_DEADLINE → broadcast → 新 5s timer
11.    → 'clear': 清 timer → CLEAR_WOLF_VOTE_DEADLINE → broadcast
12.    → 'noop': 不操作
13.  → callNightProgression(ctx)
```

##### 3.1.3 自动推进 `callNightProgression(ctx)` — 核心递归

```
1. hostActions.callNightProgression(ctx)
2. → handleNightProgression(callbacks) [progressionEvaluator.ts]
3.   → evaluateNightProgression(state, revision, tracker, isHost)
4.     → 决策树（9 个分支）：
5.       not_host → none
6.       no_state → none
7.       status !== ongoing → none
8.       audio_playing → none
9.       pending_reveal_acks → none
10.      same_key (幂等) → none
11.      currentStepId === undefined → end_night
12.      isCurrentStepComplete:
13.        wolfKill + deadline 未到 → none (等 countdown)
14.        otherwise → advance
15.      step_not_complete → none
16.   → 决策 'advance':
17.     callbacks.advanceNight() — 调用 hostActions.advanceNight(ctx)
18.     → handleAdvanceNight(intent, handlerCtx)
19.       → ADVANCE_TO_NEXT_ACTION + optional SET_WITCH_CONTEXT/SET_CONFIRM_STATUS/SET_UI_HINT
20.       → sideEffects: PLAY_AUDIO(currentStep.endAudio) + PLAY_AUDIO(nextStep.beginAudio)
21.     → processHandlerResult → 播放音频
22.     → **递归调用 callNightProgression(ctx)** — 新 revision，幂等 key 保护
23.   → 决策 'end_night':
24.     callbacks.endNight() — 调用 hostActions.endNight(ctx)
25.     → handleEndNight(intent, handlerCtx)
26.       → buildNightActions(state) → calculateDeaths(nightActions, roleSeatMap)
27.       → END_NIGHT { deaths }
28.       → sideEffects: PLAY_AUDIO('night_end')
```

##### 3.1.4 步骤推进中的音频时序

```
advanceNight 返回的 sideEffects:
  1. PLAY_AUDIO(currentStepEndAudio, isEndAudio=true)   // 当前步骤结束语音
  2. PLAY_AUDIO(nextStepBeginAudio, isEndAudio=false)   // 下一步骤开始语音

processHandlerResult 执行：
  1. setAudioPlayingGate(true) → SET_AUDIO_PLAYING → broadcast
  2. 播放所有音频（顺序）
  3. setAudioPlayingGate(false) → SET_AUDIO_PLAYING → broadcast
  4. → 触发 callNightProgression（因为 audio gate 关闭可能解锁推进）
```

##### 3.1.5 Wolf Vote Timer

```
submitWolfVote 成功后：
  → isWolfVoteAllComplete() 检查所有狼人是否已投票
  → decideWolfVoteTimerAction():
    - 全部投完 + 无 timer → 'set'（开始 5s 倒计时）
    - 全部投完 + 有 timer → 'noop'（已经在倒计时）
    - 未全部投完 + 有 timer → 'clear'（有人改票，重置）
    - 未全部投完 + 无 timer → 'noop'

  Timer 到期 → callNightProgression → advance（因为 step complete）
```

#### 3.2 新增文件

```
api/game/night/
├── action.ts       # POST /api/game/night/action — 提交行动
├── wolf-vote.ts    # POST /api/game/night/wolf-vote — 狼人投票
├── advance.ts      # POST /api/game/night/advance — 推进步骤
├── end.ts          # POST /api/game/night/end — 结束夜晚
├── audio-gate.ts   # POST /api/game/night/audio-gate — 设置音频播放状态
└── progression.ts  # POST /api/game/night/progression — 检查自动推进
```

#### 3.3 API 设计

```typescript
// POST /api/game/night/action — 提交行动
{
  roomCode: "1234",
  hostUid: "abc",
  seat: 3,
  role: "seer",
  target: 5,
  extra?: { ... }
}
// → handleSubmitAction → resolver 计算
// → 返回 { success, reason?, state?, sideEffects? }

// POST /api/game/night/wolf-vote — 狼人投票
{
  roomCode: "1234",
  hostUid: "abc",
  voterSeat: 2,
  targetSeat: 5       // -1 表示空刀
}
// → handleSubmitWolfVote
// → 返回 { success, state?, wolfVoteTimer?: 'set'|'clear'|'noop' }

// POST /api/game/night/advance — 推进步骤
{
  roomCode: "1234",
  hostUid: "abc"
}
// → handleAdvanceNight
// → 返回 { success, state?, sideEffects?: ['PLAY_AUDIO:...'] }

// POST /api/game/night/end — 结束夜晚
{
  roomCode: "1234",
  hostUid: "abc"
}
// → handleEndNight → calculateDeaths
// → 返回 { success, state?, sideEffects?: ['PLAY_AUDIO:night_end'] }

// POST /api/game/night/audio-gate — 设置音频播放状态
{
  roomCode: "1234",
  hostUid: "abc",
  isPlaying: true/false
}
// → handleSetAudioPlaying

// POST /api/game/night/progression — 检查自动推进
{
  roomCode: "1234",
  hostUid: "abc"
}
// → evaluateNightProgression
// → 返回 { decision: 'advance'|'end_night'|'none', reason? }
// → 如果 advance/end_night，服务端直接执行并返回新 state + sideEffects
```

#### 3.4 自动推进的架构变化

**这是最关键的设计决策。**

当前 `callNightProgression` 是一个递归函数，在 Host 内存中运行：

- 提交行动 → 检查 → 自动 advance → 播放音频 → 再检查 → 可能再 advance → ...

迁移后有两种方案：

**方案 A：服务端递归（推荐）**

`POST /api/game/night/action` 提交行动后，服务端自动执行推进检查：

```typescript
// api/game/night/action.ts
export default async function handler(req, res) {
  // 1. 处理 action 提交
  const result = await processGameAction(roomCode, (state) => {
    return handleSubmitAction(intent, { getState: () => state });
  });

  if (!result.success) return res.json(result);

  // 2. 服务端自动检查推进（不递归，只返回下一步指令）
  const progression = evaluateNightProgression(result.state, ...);

  return res.json({
    ...result,
    progression: progression.decision,  // 'advance' | 'end_night' | 'none'
  });
}
```

Host 客户端收到响应后：

1. 如果有 `sideEffects` 含 PLAY_AUDIO → `setAudioPlayingGate(true)` → 播放音频 → `setAudioPlayingGate(false)`
2. 音频播放完毕 → `fetch('/api/game/night/audio-gate', { isPlaying: false })` 通知服务端
3. 如果收到 `progression: 'advance'` → `fetch('/api/game/night/advance')` 请求推进
4. 如果收到 `progression: 'end_night'` → `fetch('/api/game/night/end')` 请求结束

**推进循环由客户端驱动（HTTP 调用），逻辑由服务端计算。** 每次 HTTP 调用都是无状态的。

**方案 B：服务端自动推进循环**

服务端在一次请求中完成所有推进：读 state → 算 → 写 → 再读 → 再算 → 再写... 直到遇到需要音频的步骤。

缺点：

- 单次请求时间长，可能超过 Vercel 10s 限制
- 音频播放无法在服务端完成
- 复杂度更高

**结论：选择方案 A。**

#### 3.5 Wolf Vote Timer 迁移

当前 timer 在 Host 内存中（`setTimeout`）。迁移后：

**方案：客户端 timer + 服务端验证**

1. `POST /api/game/night/wolf-vote` → 服务端返回 `wolfVoteTimer: 'set'|'clear'|'noop'`
2. Host 客户端根据指令设置/清除本地 `setTimeout(5000)`
3. Timer 到期 → `fetch('/api/game/night/progression')` → 服务端检查并推进
4. 即使 Host 后台 timer 没触发，**任何玩家**都可以检测到超时（通过 `wolfVoteDeadline` 字段在 state 中），并发送 progression 请求

这比当前方案更健壮：即使 Host 后台，其他客户端也能触发推进。

#### 3.6 Reveal ACK 迁移

当前：`ADD_REVEAL_ACK` 阻断推进 → 玩家点确认 → `REVEAL_ACK` playerMessage → Host 处理 → `CLEAR_REVEAL_ACKS` → `callNightProgression`

迁移后：

```typescript
// POST /api/game/night/reveal-ack
{
  roomCode: "1234",
  seat: 3,
  role: "seer",
  revision: 42
}
// → 检查 revision 匹配 → CLEAR_REVEAL_ACKS → evaluateNightProgression
```

#### 3.7 WolfRobot Hunter Gate 迁移

当前：`WOLF_ROBOT_HUNTER_STATUS_VIEWED` playerMessage → Host 处理 → clear gate → `callNightProgression`

迁移后：

```typescript
// POST /api/game/night/wolf-robot-viewed
{
  roomCode: "1234",
  hostUid: "abc",
  seat: 3
}
// → handleSetWolfRobotHunterStatusViewed → evaluateNightProgression
```

#### 3.8 客户端变更

**改动文件清单：**

| 文件                                                   | 变更                                                                                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/services/facade/hostActions.ts`                   | **大改**：所有夜晚方法改为 HTTP + 本地音频编排                                                                                 |
| `src/services/facade/messageRouter.ts`                 | **大改**：删除所有 playerMessage 的 Host 端转发（ACTION, WOLF_VOTE, VIEWED_ROLE, REVEAL_ACK, WOLF_ROBOT_HUNTER_STATUS_VIEWED） |
| `src/services/facade/GameFacade.ts`                    | **修改**：简化 context builders，删除不再需要的依赖                                                                            |
| `src/services/engine/handlers/progressionEvaluator.ts` | **修改**：删除 module-level `progressionTracker`（服务端无状态，不需要幂等 tracker）                                           |

**`hostActions.ts` 中 `callNightProgression` 的变化：**

```typescript
// 现在：递归调用 handlers，在内存中完成所有推进
async callNightProgression(ctx) {
  handleNightProgression({
    advanceNight: () => this.advanceNight(ctx),
    endNight: () => this.endNight(ctx),
  });
}

// 以后：HTTP 调用服务端，客户端只负责音频 + 驱动循环
async callNightProgression(ctx) {
  const result = await fetch('/api/game/night/progression', { ... });
  if (result.decision === 'advance') {
    const advanceResult = await fetch('/api/game/night/advance', { ... });
    if (advanceResult.sideEffects) {
      await playAudioSequence(advanceResult.sideEffects);
    }
    // 音频播完后递归检查
    await this.callNightProgression(ctx);
  } else if (result.decision === 'end_night') {
    const endResult = await fetch('/api/game/night/end', { ... });
    if (endResult.sideEffects) {
      await playAudioSequence(endResult.sideEffects);
    }
  }
}
```

**`messageRouter.ts` 最终状态（Phase 3 完成后）：**

Host 端只剩下：

- `REQUEST_STATE` → 从服务端获取最新 state 返回
- `JOIN` / `LEAVE` → legacy warn（可删除）
- `SNAPSHOT_REQUEST` → future

Player 端：

- `STATE_UPDATE` → `store.applySnapshot()` 保持不变

大部分 playerMessage 处理逻辑删除，因为 Player 直接发 HTTP 请求到服务端。

#### 3.9 验证标准

- `pnpm exec tsc --noEmit` — 通过
- 更新相关单元测试（hostActions, messageRouter, progressionEvaluator）
- E2E：`night-2p.spec.ts`、`night-6p.spec.ts`、`restart.spec.ts` 全部通过
- 手动测试关键场景：
  - 正常夜晚流程（预言家查验 → 女巫救人 → 狼人杀人 → 天亮）
  - Host 切后台 → Player 操作仍然正常
  - Wolf vote 5s countdown → 自动推进
  - 带 reveal 的角色（预言家/石像鬼）→ ACK 后推进
  - 狼人机器人学到猎人 → gate → 确认后推进

#### 3.10 Commit 计划（4 commits）

| #   | message                                                        | 内容                                                                                                                                                                                                                                      | 验证                  |
| --- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 1   | `feat(api): add night flow API routes`                         | 新增 `api/game/night/{action,wolf-vote,advance,end,audio-gate,progression}.ts`（6 个 route）+ `api/game/night/reveal-ack.ts` + `api/game/night/wolf-robot-viewed.ts`                                                                      | tsc                   |
| 2   | `refactor(services): migrate night action + wolf-vote to HTTP` | `hostActions.ts` 的 submitAction / submitWolfVote 改 HTTP；`messageRouter.ts` 删除 ACTION / WOLF_VOTE 的 Host 端转发；Wolf Vote Timer 改为客户端 timer + 服务端 `wolfVoteDeadline`                                                        | tsc + jest            |
| 3   | `refactor(services): migrate night progression to HTTP`        | `hostActions.ts` 的 callNightProgression / advanceNight / endNight 改 HTTP 驱动循环；`progressionEvaluator.ts` 删除 module-level tracker；Reveal ACK / WolfRobotHunterGate 改 HTTP；`messageRouter.ts` 删除剩余 playerMessage Host 端处理 | tsc + jest            |
| 4   | `test(services): update night flow tests + cleanup`            | 更新/重写 hostActions / messageRouter / progressionEvaluator 相关测试；清理废弃的 broadcast 转发代码                                                                                                                                      | tsc + jest + E2E full |

---

### Phase 4：统一客户端架构（消除 Host/Player 代码分叉）

**目标：** 所有客户端完全平等 — 都通过 HTTP API 提交操作，都通过同一个 Realtime broadcast 接收状态更新，代码路径零区别。`isHost` 仅作为 UI 角色标记（决定哪些按钮可见、谁播放音频）。

#### 4.0 社区标准做法

Server-Authoritative 架构的客户端设计遵循以下原则：

1. **所有客户端完全平等**
   - 都通过 HTTP API 提交操作
   - 都通过同一个 Realtime broadcast 接收状态更新
   - 都用 `applySnapshot` 更新本地 store
   - 代码路径零区别

2. **"Host" 只是 UI 角色标记**
   - `isHost` 决定哪些按钮可见（开始夜晚、推进、结束）
   - `isHost` 决定谁播放音频（sideEffects 从 API 响应中返回，调用者播放）
   - 服务端校验权限（`hostUid` 匹配才允许操作）
   - 客户端代码里**不需要** Host 专用逻辑路径

3. **断线恢复也一视同仁**
   - 所有客户端从 DB 直接读取最新状态（`SELECT game_state`）
   - 不需要 `REQUEST_STATE` P2P 消息
   - `hostStateCache` 仅用于 Host 音频中断恢复（`wasAudioInterrupted`），不用于状态恢复

#### 4.1 当前问题

Phase 0-3 完成后仍残留 Host-authoritative 时代的代码分叉：

| 问题                                         | 位置                                            | 说明                                                                        |
| -------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------- |
| Host 不接收 Realtime broadcast               | `GameFacade.initializeAsHost/joinAsHost`        | `onHostBroadcast: undefined` — Host 自己的 store 不会被服务端广播更新       |
| Player 被 isHost guard 阻断                  | `messageRouter.playerHandleHostBroadcast` L148  | `if (ctx.isHost) return` — 即使 Host 收到广播也会被丢弃                     |
| Host 自己做 Realtime 广播                    | `broadcastCurrentState()`                       | Host 还在做 client→client 广播，与服务端广播重复                            |
| Host 写 DB                                   | `broadcastCurrentState()`                       | Host 还在做 `roomService.upsertGameState()`，与服务端写入重复               |
| onPresenceChange → broadcastCurrentState     | `initializeAsHost/joinAsHost`                   | 有人加入/退出频道 → Host 自动广播当前状态（不必要，服务端做）               |
| REQUEST_STATE P2P 消息                       | `messageRouter`, `GameFacade.requestSnapshot()` | Player 向 Host 请求状态快照（不必要，直接读 DB）                            |
| sendToHost 方法                              | `BroadcastService.sendToHost()`                 | Player→Host 直接消息（所有操作都已是 HTTP，不再有 P2P）                     |
| hostHandlePlayerMessage 整个函数             | `messageRouter.ts`                              | Host 端 PlayerMessage 路由器（所有 case 都是 legacy warn 或 REQUEST_STATE） |
| broadcastAsHost 方法                         | `BroadcastService.broadcastAsHost()`            | Host→all 直接广播（服务端已负责广播）                                       |
| onPlayerMessage 回调                         | `BroadcastService.joinRoom()`                   | Host 监听 Player 直接消息（不再需要）                                       |
| fetchStateFromDB fallback 到 requestSnapshot | `GameFacade.fetchStateFromDB()`                 | DB 读不到就 fallback 到 P2P REQUEST_STATE（不必要，DB 是权威）              |

#### 4.2 变更计划

##### 4.2.1 `messageRouter.ts` — 重写为统一处理器

**删除：**

- `hostHandlePlayerMessage()` 整个函数 — 不再有 P2P PlayerMessage
- `MessageRouterContext.broadcastCurrentState` 字段 — 不再需要
- `if (ctx.isHost) return` guard — Host 和 Player 走同一个 handler

**改造：**

- `playerHandleHostBroadcast()` → 重命名为 `handleStateUpdate()`
- 删除 `!ctx.isHost` guard — Host 和 Player 都接收 `STATE_UPDATE`
- Host 收到 `STATE_UPDATE` 时额外保存 `hostStateCache`（用于音频中断恢复）

```typescript
// 新 messageRouter.ts — 极简
export interface MessageRouterContext {
  readonly store: GameStore;
  readonly broadcastService: BroadcastService;
  isHost: boolean;
  /** Host-only: 保存状态到本地缓存（音频中断恢复用） */
  saveHostCache?: (state: BroadcastGameState, revision: number) => void;
}

/**
 * 所有客户端统一处理 STATE_UPDATE
 * Host 和 Player 走完全相同的路径
 */
export function handleStateUpdate(ctx: MessageRouterContext, msg: HostBroadcast): void {
  switch (msg.type) {
    case 'STATE_UPDATE': {
      ctx.store.applySnapshot(msg.state, msg.revision);
      ctx.broadcastService.markAsLive();
      // Host: 额外保存到本地缓存（音频中断恢复用）
      if (ctx.isHost && ctx.saveHostCache) {
        ctx.saveHostCache(msg.state, msg.revision);
      }
      break;
    }
  }
}
```

##### 4.2.2 `GameFacade.ts` — 统一房间接入

**删除：**

- `broadcastCurrentState()` 方法 — 不再由客户端广播或写 DB
- `requestSnapshot()` 方法 — 不再有 P2P REQUEST_STATE
- `sendToHost` 调用 — 无 P2P 消息
- `getMessageRouterContext().broadcastCurrentState` — 不再需要
- `onPresenceChange → broadcastCurrentState()` — 不再需要
- `onPlayerMessage → hostHandlePlayerMessage` — 不再有 P2P 消息

**改造：**

- `initializeAsHost()` — 接入 `onHostBroadcast: handleStateUpdate`（和 Player 一样）
- `joinAsHost()` — 同上
- `joinAsPlayer()` — 简化，删除 `sendToHost(REQUEST_STATE)` fallback
- `fetchStateFromDB()` — 删除 `requestSnapshot()` fallback（DB 是权威，无需 P2P fallback）
- 三个 joinRoom 调用的 callbacks 统一为 `{ onHostBroadcast: handleStateUpdate, onDbStateChange: applySnapshot }`

```typescript
// 统一 joinRoom 参数 — Host 和 Player 完全相同
const callbacks = {
  onHostBroadcast: (msg: HostBroadcast) => {
    handleStateUpdate(this.getMessageRouterContext(), msg);
  },
  onPlayerMessage: undefined, // 不再有 P2P 消息
  onPresenceChange: undefined, // 不再需要触发广播
  onDbStateChange: (state, rev) => {
    this.store.applySnapshot(state, rev);
    this.broadcastService.markAsLive();
  },
};
```

**`initializeAsHost()` 变化：**

- 初始化 store（保留）
- joinRoom 用统一 callbacks（改）
- 删除 `await this.broadcastCurrentState()`（服务端在 `createRoom` 时已写入 DB + 广播）
- 保留 `_setupForegroundRecovery()`（Host 音频恢复仍需要）

**`joinAsHost()` 变化：**

- 从本地缓存恢复（保留 — 仅用于 `wasAudioInterrupted` 判断）
- joinRoom 用统一 callbacks（改）
- 删除 `await this.broadcastCurrentState()`（改为从 DB 读取最新 state）
- 保留 `_setupForegroundRecovery()`

**`joinAsPlayer()` 变化：**

- joinRoom 用统一 callbacks（和 Host 相同）
- 删除 `sendToHost(REQUEST_STATE)` fallback — 只保留 DB 读取

##### 4.2.3 `BroadcastService.ts` — 清理 P2P 方法

**删除：**

- `sendToHost()` 方法 — 无 P2P 消息
- `broadcastAsHost()` 方法 — 服务端负责广播
- `onPlayerMessage` 字段/监听器 — 不再监听 `'player'` 事件

**保留：**

- `joinRoom()` — 仍需订阅 Realtime 频道
- `onHostBroadcast` 监听器 — 所有客户端都监听 `'host'` 事件
- `onPresenceChange` — 可选，用于 UI 显示在线用户（不触发逻辑）
- `onDbStateChange` — postgres_changes 备份通道
- `markAsLive()` / `markAsSyncing()` — 连接状态管理
- `leaveRoom()` — 清理

**简化 joinRoom 签名：**

```typescript
async joinRoom(
  roomCode: string,
  userId: string,
  callbacks: {
    onStateUpdate: (message: HostBroadcast) => void;         // 必填，所有客户端都需要
    onDbStateChange?: (state: BroadcastGameState, revision: number) => void;  // 备份通道
    onPresenceChange?: (users: string[]) => void;            // 可选，仅 UI 显示
  },
): Promise<void>
```

##### 4.2.4 `hostActions.ts` — 对 `broadcastCurrentState` 的清理

**删除：**

- `HostActionsContext.broadcastCurrentState` 字段 — 不再由客户端广播
- 所有 `ctx.broadcastCurrentState()` 调用 — 服务端在 API 中已广播

**保留：**

- 所有 HTTP API 调用（`callGameControlApi`）
- `playApiSideEffects` — 音频编排
- `callNightProgression` — 客户端驱动推进循环
- `wolfVoteTimer` — 客户端本地 timer

##### 4.2.5 `useConnectionSync.ts` — 简化

**删除：**

- `if (isHost) return` guards — Host 也需要 auto-recovery
- `requestSnapshot` 相关注释

**改造：**

- Host 和 Player 都走 `fetchStateFromDB()` 恢复状态
- `isHost` 参数可能移除（但保留也无碍，用于 staleness 门槛差异化）

##### 4.2.6 Protocol Types — 清理

**删除（从 `PlayerMessage`）：**

- `REQUEST_STATE` — 无 P2P 状态请求
- `SNAPSHOT_REQUEST` — 未实现的 future type

**删除（从 `HostBroadcast`）：**

- `SEAT_ACTION_ACK` — 已在 Phase 1 删除（确认）

**保留：**

- `STATE_UPDATE` (HostBroadcast) — 服务端广播，所有客户端消费

**最终 `PlayerMessage` 类型：**
只剩 legacy types（`JOIN`, `LEAVE`, `VIEWED_ROLE`, `ACTION`, `WOLF_VOTE`, `REVEAL_ACK`, `WOLF_ROBOT_HUNTER_STATUS_VIEWED`），可全部删除或标记 `@deprecated`。如果删除，`PlayerMessage` 类型本身成为空联合 → 删除。

**最终 `HostBroadcast` 类型：**
只剩 `STATE_UPDATE`。可简化为单一消息类型。

##### 4.2.7 `GameFacade.requestSnapshot()` / `GameFacade.fetchStateFromDB()` 合并

**改造：**

- `fetchStateFromDB()` 不再 fallback 到 `requestSnapshot()`
- `requestSnapshot()` 删除
- `fetchStateFromDB()` 适用于 Host 和 Player（删除 `if (this.isHost) return true` guard）

#### 4.3 `hostStateCache` 角色变化

**之前（Host-authoritative）：**
保存完整状态快照 → Host rejoin 时恢复整个 game state 作为权威源。

**之后（Server-authoritative）：**

- 状态恢复从 DB 读取（所有客户端统一路径）
- `hostStateCache` 仅用于一个目的：记录 Host 当时是否在播放音频（`isAudioPlaying`）
  - Host 刷新/断线 → 恢复时检查 `wasAudioInterrupted` → 弹 `ContinueGameOverlay` → 用户点击恢复音频
- 可以简化 cache 内容，只存 `{ roomCode, hostUid, wasAudioPlaying: boolean }` 而不是完整 state
- 或复用 `onHostBroadcast → handleStateUpdate` 中的 `saveHostCache` 保存完整 state（用于判断 `status === 'ongoing'` + `isAudioPlaying`）

#### 4.4 验证标准

- `pnpm exec tsc --noEmit` — 通过
- 更新所有受影响的单元测试（messageRouter, GameFacade, hostActions, useConnectionSync）
- `pnpm exec jest --no-coverage --forceExit` — 全部通过
- E2E：`night-2p.spec.ts` 全流程通过（Host 入座应立即反映在 UI 上）
- 手动测试：
  - Host 创建房间 → 入座 → UI 立即显示"我"
  - Player 加入 → 入座 → Host 和 Player 都立即看到
  - Host 刷新 → 从 DB 恢复状态 → 音频恢复 overlay
  - Player 断线重连 → 从 DB 恢复状态

#### 4.5 Commit 计划（3 commits）

| #   | message                                                     | 内容                                                                                                                                                                                                                                                                  | 验证             |
| --- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 1   | `refactor(services)!: unify client state reception`         | `messageRouter.ts` 重写（删除 hostHandlePlayerMessage / isHost guard）；`GameFacade.ts` 统一 joinRoom callbacks（Host+Player 都监听 onHostBroadcast + onDbStateChange）；删除 `broadcastCurrentState` 客户端广播/DB写入；删除 `requestSnapshot`/`sendToHost` P2P 消息 | tsc + jest       |
| 2   | `refactor(services): clean up BroadcastService P2P methods` | `BroadcastService.ts` 删除 `sendToHost` / `broadcastAsHost`；简化 `joinRoom` 签名；删除 `'player'` event listener；清理 `hostActions.ts` 的 `broadcastCurrentState` 引用                                                                                              | tsc + jest       |
| 3   | `refactor(services): clean up protocol types + tests`       | 删除 `PlayerMessage.REQUEST_STATE` / `SNAPSHOT_REQUEST`；清理/精简 `PlayerMessage` 和 `HostBroadcast` 类型；更新所有受影响测试；更新 `useConnectionSync` 删除 isHost 分叉                                                                                             | tsc + jest + E2E |

#### 4.6 风险

- **低风险**：客户端纯重构，服务端 API 和 DB 无变更
- **注意**：`hostStateCache` 在 `handleStateUpdate` 中频繁写入 AsyncStorage 可能有性能影响 → 加防抖或只在关键状态变更时写入
- **注意**：删除 `broadcastAsHost` 后，Host rejoin 时不再主动广播 → Player 需依赖 DB 备份通道恢复。这应该已经可以工作（Player 的 `onDbStateChange` + staleness auto-heal）
- **注意**：删除 `onPlayerMessage` / `'player'` event listener 后，需确认无其他代码依赖此通道

---

### Phase 5：消除 HostStateCache + 统一 rejoin + 合并入口方法

**目标：** 消除 P2P 时代遗留的 `HostStateCache` 本地缓存机制，Host rejoin 改为从 DB 读取状态（与 Player 一致），合并 3 个入口方法为 2 个。

**对应审计项：** C1（HostStateCache rejoin → DB）、C2（messageRouter 缓存写入）、C3（HostStateCache 类删除）、C5（合并入口方法）、C8（简化 rejoin 恢复）。

#### 5.1 当前问题

| 问题                               | 位置                                               | 说明                                                                     |
| ---------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------ |
| Host rejoin 从 AsyncStorage 读状态 | `GameFacade.joinAsHost()`                          | 与 Player 的 DB 读路径完全不同，两套恢复逻辑                             |
| Host 额外写 AsyncStorage           | `messageRouter.ts` L64-70                          | `if (ctx.isHost && ctx.hostStateCache)` 每次 STATE_UPDATE 都写           |
| HostStateCache 整个类              | `src/services/infra/HostStateCache.ts`             | 192 行代码，仅服务 Host rejoin，Supabase 已有 DB 持久化                  |
| `applyHostSnapshot` 方法           | `GameStore.ts`                                     | 绕过 revision 门控的 Host 专属方法（cache 恢复用），是 leaky abstraction |
| 3 个入口方法                       | `initializeAsHost` / `joinAsPlayer` / `joinAsHost` | Host 创建/Host rejoin/Player 加入，路径各不同，可合并为 create + join    |
| 复杂的 rejoin 音频恢复             | `_wasAudioInterrupted` / `resumeAfterRejoin`       | 依赖 cache 中的 `isAudioPlaying`，可从 DB state 判断                     |

#### 5.2 变更计划

##### 5.2.1 `GameFacade.ts`

**删除：**

- `private readonly hostStateCache: HostStateCache` 字段
- `GameFacadeDeps.hostStateCache` 接口字段 + import
- `constructor` 中 `this.hostStateCache = deps.hostStateCache`
- `getMessageRouterContext()` 中 `hostStateCache` + `isHost` 字段

**改造 `joinAsHost()` → 从 DB 读取：**

```typescript
async joinAsHost(
  roomCode: string,
  hostUid: string,
  templateRoles?: RoleId[],
): Promise<{ success: boolean; reason?: string }> {
  this._aborted = false;
  this.isHost = true;
  this.myUid = hostUid;
  this.store.reset();

  // 加入频道（统一 callbacks）
  await this.broadcastService.joinRoom(roomCode, hostUid, { ... });

  // 从 DB 读取最新状态（与 joinAsPlayer 统一）
  const dbState = await this.roomService.getGameState(roomCode);
  if (dbState) {
    this.store.applySnapshot(dbState.state, dbState.revision);
    this.broadcastService.markAsLive();
    // 判断是否需要音频恢复 overlay
    this._wasAudioInterrupted = dbState.state.status === 'ongoing';
  } else if (templateRoles && templateRoles.length > 0) {
    // 没有 DB 状态但有模板：创建初始状态
    const initialState = buildInitialGameState(roomCode, hostUid, { roles: templateRoles });
    this.store.initialize(initialState);
  } else {
    this.isHost = false;
    this.myUid = null;
    return { success: false, reason: 'no_state' };
  }

  this._setupForegroundRecovery();
  return { success: true };
}
```

**可选 C5 — 合并入口方法（如实施）：**

- `initializeAsHost` + `joinAsHost` → `createRoom(roomCode, hostUid, template)` — 新建房间
- `joinAsPlayer` + `joinAsHost`（非创建场景）→ `joinRoom(roomCode, uid, isHost)` — Host rejoin 和 Player join 统一

##### 5.2.2 `messageRouter.ts`

**删除：**

- `MessageRouterContext.isHost` 字段
- `MessageRouterContext.hostStateCache` 字段
- `if (ctx.isHost && ctx.hostStateCache)` 块（L64-70）
- `HostStateCache` type import

**简化后的 `MessageRouterContext`：**

```typescript
export interface MessageRouterContext {
  readonly store: GameStore;
  readonly broadcastService: BroadcastService;
  myUid: string | null;
}
```

##### 5.2.3 `App.tsx`

- 删除 `import { HostStateCache }` + `hostStateCache: new HostStateCache()` DI

##### 5.2.4 删除文件

| 文件                                                  | 行数 | 原因           |
| ----------------------------------------------------- | ---- | -------------- |
| `src/services/infra/HostStateCache.ts`                | 192  | 整个类不再需要 |
| `src/services/infra/__tests__/HostStateCache.test.ts` | ~210 | 对应测试       |

##### 5.2.5 `GameStore.ts`（game-engine）

- 删除 `applyHostSnapshot()` 方法 — 唯一消费者 `joinAsHost` 改为 `applySnapshot`
- 对应测试 `GameStore.test.ts` 中删除 `applyHostSnapshot` describe 块

##### 5.2.6 测试更新

| 文件                           | 变更                                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| `GameFacade.test.ts`           | 删除 `hostStateCache` mock deps；`joinAsHost` 测试改为 mock `roomService.getGameState` |
| `messageRouter.test.ts`        | 删除 `isHost` / `hostStateCache` 上下文；删除 Host 缓存保存测试                        |
| `leaveRoom.contract.test.ts`   | 删除 `HostStateCache` mock                                                             |
| `restartGame.contract.test.ts` | 删除 `hostStateCache` mock deps                                                        |
| `GameStore.test.ts`            | 删除 `applyHostSnapshot` 测试块                                                        |

#### 5.3 符号验证

| 符号                                  | 消费者                                                                             | 处理                 |
| ------------------------------------- | ---------------------------------------------------------------------------------- | -------------------- |
| `HostStateCache` class                | App.tsx, GameFacade.ts, messageRouter.ts (type only), 测试文件                     | 全部清除             |
| `applyHostSnapshot`                   | GameFacade.ts L309（唯一）                                                         | 改为 `applySnapshot` |
| `GameFacadeDeps.hostStateCache`       | GameFacade.ts + App.tsx + 测试                                                     | 全部删除             |
| `MessageRouterContext.isHost`         | messageRouter.ts + GameFacade.ts `getMessageRouterContext` + messageRouter.test.ts | 全部删除             |
| `MessageRouterContext.hostStateCache` | 同上                                                                               | 全部删除             |

#### 5.4 行为差异

| 方面                   | 之前（Cache）                        | 之后（DB）                                        | 影响                                    |
| ---------------------- | ------------------------------------ | ------------------------------------------------- | --------------------------------------- |
| rejoin 延迟            | ~1ms (本地读)                        | ~50-200ms (网络)                                  | 可接受，与 Player 一致                  |
| 离线 rejoin            | 可用（AsyncStorage 有缓存）          | 不可用（需网络）                                  | 无影响 — Supabase Realtime 本身需要网络 |
| `_wasAudioInterrupted` | 从 cache state 的 `status` 判断      | 从 DB state 的 `status` 判断                      | 行为一致                                |
| isAudioPlaying gate    | cache 保持 true → overlay → 音频重播 | DB state 的 `isAudioPlaying` → overlay → 音频重播 | 行为一致                                |

#### 5.5 验证标准

- `pnpm exec tsc --noEmit` — 通过
- `pnpm exec jest --no-coverage --forceExit` — 全部通过
- E2E：Host 刷新 → 从 DB 恢复状态 + 音频恢复 overlay
- 手动测试：Host rejoin → 状态一致 → 音频恢复正常

#### 5.6 Commit 计划（2 commits）

| #   | message                                                          | 内容                                                                                                                                                                      | 验证             |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 1   | `refactor(services)!: remove HostStateCache, unify rejoin to DB` | `joinAsHost` 改 DB 读；删除 `HostStateCache` 类 + 测试；删除 `applyHostSnapshot`；`messageRouter` 删除 `isHost` + `hostStateCache`；`App.tsx` 删除 DI；更新所有受影响测试 | tsc + jest       |
| 2   | `refactor(services): merge entry methods` (可选)                 | `initializeAsHost` + `joinAsHost` → `createRoom`；`joinAsPlayer` → `joinRoom`（Host/Player 统一）；更新 `useRoomLifecycle` + `IGameFacade` + 测试                         | tsc + jest + E2E |

#### 5.7 风险

- **低风险**：DB 读路径已被 `joinAsPlayer` 和 `fetchStateFromDB` 验证过
- **唯一行为差异**：Host rejoin 从 ~1ms 变为 ~50-200ms（网络读），可接受
- **C5（合并入口方法）可选**：如影响面过大可先 skip，单独做或留到后续

---

### Phase 6：夜晚推进 + 音频计时迁移到服务端

**目标：** 将 Host 设备负责的夜晚推进驱动（`callNightProgression`）、wolf vote 倒计时（`wolfVoteTimer`）、前台恢复（`_setupForegroundRecovery`）迁移到服务端，使 Host 掉线后游戏仍能继续。

**对应审计项：** C4（前台恢复）、C6（submitAction 后 Host-only 推进）、C7（submitWolfVote 后 Host-only timer + 推进）。

**架构方案：** 方案 E（服务端内联推进 + 客户端兜底 deadline），社区标准做法。

#### 6.1 社区做法参考

以下三个模式是多人回合制游戏的社区通行做法，无需新基础设施（Vercel Serverless + Supabase Realtime 即可）：

##### 模式 1：服务端内联推进（Server-Inline Progression）

所有 server-authoritative 回合制游戏的标准做法。Action API handler 在同一请求内完成「验证 → 写入 → 评估推进 → 广播」，不把推进权交给客户端。

```
客户端 POST /api/game/night/action { seat, target }
  → 服务端:
    1. validate + apply action
    2. evaluate: 所有该 step 的 action 都到齐了吗？
    3. 如果是 → advance step / end night（同一请求内）
    4. 写 DB + 广播新 state（包含 sideEffects）
    5. 返回 { success: true }
  → 客户端: 收到广播，播放音频
```

**效果：** 客户端只需 fire-and-forget POST，不再需要 `callNightProgression` 循环。

##### 模式 2：客户端兜底 deadline（Client-Polled Deadline）

解决 Vercel 无原生 delayed invocation 的问题。服务端在 state 中写 `wolfVoteDeadline` 时间戳，**所有在线客户端**（不只 Host）本地跑 timer，到期后 POST `/api/game/night/progression`。服务端用乐观锁保证**只有第一个到达的请求生效**，后续请求被幂等拒绝。

```
服务端写入 state: { wolfVoteDeadline: Date.now() + 30000 }
  → 所有客户端收到广播，各自 setTimeout(30s)
  → 最快的客户端到期: POST /api/game/night/progression
  → 服务端: 检查 deadline 已过 + revision 锁 → advance
  → 其他客户端到期: POST → 服务端 revision 已变 → 409 幂等拒绝
```

**效果：** Host 掉线后任意在线客户端都能触发推进。`wolfVoteTimer` 从 Host-only 变为 all-client。

##### 模式 3：pendingAudioEffects 事件队列（Audio Event Log）

将音频编排从 API 响应同步播放改为 state 中的事件队列。服务端推进时写入 `pendingAudioEffects`，Host 设备消费并播放，播放完成后 POST `/api/game/audio/ack` 清除。Non-Host 设备忽略。

```
服务端推进后写入 state:
  pendingAudioEffects: [
    { id: 'uuid', type: 'step_audio', stepId: 'wolf', file: 'wolf_open.mp3' },
    { id: 'uuid', type: 'step_audio', stepId: 'wolf', file: 'wolf_close.mp3' }
  ]

Host 设备: 收到广播 → 检查 pendingAudioEffects → 播放 → POST ack 清除
Non-Host 设备: 收到广播 → pendingAudioEffects 存在但 isHost=false → 忽略
```

**效果：** 音频与推进解耦。Host 刷新后从 state 中读取未消费的 effects 恢复播放。

#### 6.2 当前问题

| 问题                         | 位置                                    | 说明                                                 |
| ---------------------------- | --------------------------------------- | ---------------------------------------------------- |
| 夜晚推进仅 Host 驱动         | `hostActions.ts` L310 `if (ctx.isHost)` | submitAction 后只有 Host 调用 `callNightProgression` |
| Wolf vote timer 在 Host 本地 | `hostActions.ts` L350 `if (ctx.isHost)` | `setTimeout` 倒计时在 Host 设备，刷新即丢失          |
| 前台恢复仅 Host              | `GameFacade._setupForegroundRecovery`   | Host 回到前台时检查 wolf vote deadline 并推进        |
| Host 掉线 → 游戏卡住         | —                                       | 所有推进都依赖 Host 设备在线                         |

#### 6.3 变更设计

##### 6.3.1 服务端改造

| API                                | 变更                                                                                                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/game/night/action`      | action 写入后，**同请求内**调用 progression 评估。如果所有 action 到齐 → 自动 advance step / end night。sideEffects 写入 `state.pendingAudioEffects` |
| `POST /api/game/night/wolf-vote`   | wolf vote 写入后，如果投票结束 → 写 `wolfVoteDeadline` 到 state。如果 deadline 已过 → 直接 resolve                                                   |
| `POST /api/game/night/progression` | 改为**幂等兜底端点**：检查 deadline 是否已过 + revision 乐观锁，只有第一个请求生效                                                                   |
| `POST /api/game/audio/ack`         | （新增）Host 播放完成后清除 `pendingAudioEffects` 中对应项                                                                                           |

##### 6.3.2 State 新增字段

```typescript
interface BroadcastGameState {
  // ... existing fields
  wolfVoteDeadline?: number; // Unix timestamp (ms)，所有客户端本地 timer
  pendingAudioEffects?: AudioEffect[]; // Host 消费队列
}

interface AudioEffect {
  id: string; // 用于 ack 清除
  type: 'step_audio' | 'bgm_change' | 'sfx';
  stepId?: SchemaId;
  file: string;
  createdAt: number;
}
```

> ⚠️ 新增 `BroadcastGameState` 字段必须同步 `normalizeState`。

##### 6.3.3 客户端改造

| 文件                         | 变更                                                                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `hostActions.ts`             | 删除 `callNightProgression` 函数；`submitAction` / `submitWolfVote` 中删除 `if (ctx.isHost)` 推进逻辑，改为 fire-and-forget POST |
| `GameFacade.ts`              | 删除 `_setupForegroundRecovery` / `_teardownForegroundRecovery`；删除 `_wolfVoteTimer` / `_rebuildWolfVoteTimerIfNeeded`         |
| `HostActionsContext`         | 删除 `wolfVoteTimer` getter/setter                                                                                               |
| `messageRouter.ts` 或新 hook | 所有客户端监听 `wolfVoteDeadline`，到期 POST progression（幂等）                                                                 |
| `messageRouter.ts` 或新 hook | Host 设备监听 `pendingAudioEffects`，消费 → 播放 → POST ack                                                                      |

#### 6.4 前置依赖

- Phase 5 完成（HostStateCache 已消除，rejoin 统一从 DB 读取）
- 服务端 API 已稳定运行（Phase 1-3）

#### 6.5 Commit 计划（3-4 commits）

| #   | message                                                      | 内容                                                                                                                                | 验证             |
| --- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 1   | `feat(api): server inline progression on action submit`      | action/wolf-vote API 内联推进评估 + 自动 advance；客户端删除 `callNightProgression` 循环                                            | tsc + jest + E2E |
| 2   | `feat(api): wolf vote deadline + all-client timer`           | 服务端写 `wolfVoteDeadline` 到 state；所有客户端本地 timer + 幂等 POST；删除 Host-only `wolfVoteTimer` + `_setupForegroundRecovery` | tsc + jest       |
| 3   | `feat(services): pendingAudioEffects queue + host consumer`  | 新增 `AudioEffect` 类型 + `POST /api/game/audio/ack`；Host 设备消费队列 + 播放 + ack；Non-Host 忽略                                 | tsc + jest + E2E |
| 4   | `refactor(services): cleanup progression legacy code` (可选) | 清理残留的推进相关代码 + 测试                                                                                                       | tsc + jest       |

#### 6.6 验证标准

- Host 提交 action → 服务端自动推进 → pendingAudioEffects 写入 state → Host 消费播放
- Wolf vote deadline 到期 → 任意在线客户端 POST → 服务端推进 → 广播（Host 掉线也能推进）
- Host 刷新 → 从 state 读取未消费的 pendingAudioEffects → 恢复播放
- `pnpm exec tsc --noEmit` + `pnpm exec jest --no-coverage --forceExit` 通过
- E2E：`night-2p.spec.ts` 全流程通过

#### 6.7 风险

- **中风险**：音频编排模式变更（同步 → 异步队列），需仔细验证音频时序
- **低风险**：所有客户端跑 deadline timer 不会冲突（服务端乐观锁幂等保证）
- **需关注**：`pendingAudioEffects` 队列的清理时机 — Host ack 后清除，或新 step 覆盖
- **可单独评估 ROI**：当前 Night-1 only 范围内，Host 掉线是低频场景

---

### Phase 7：清理冗余 isHost 双保险门控

**目标：** 清除 Phase 1-6 迁移后遗留的客户端 `isHost` 冗余检查。这些位置在服务端已有 `hostUid` 校验，客户端 `isHost` 门控是冗余的"快速失败"。保留无害，删除也无副作用。统一清除以减少代码噪音。

**性质：** 纯清理，零行为变化。

#### 7.1 清理范围

##### 7.1.1 `GameFacade.ts` — 客户端快速拦截（3 处）

| 位置                  | 代码                       | 服务端校验                           |
| --------------------- | -------------------------- | ------------------------------------ |
| `restartGame()`       | `if (!this.isHost) return` | `/api/game/restart` 校验 `hostUid`   |
| `fillWithBots()`      | `if (!this.isHost) return` | `/api/game/fill-bots` 校验 `hostUid` |
| `markAllBotsViewed()` | `if (!this.isHost) return` | 服务端校验 `hostUid`                 |

**处理：** 删除 `if (!this.isHost)` 门控。服务端已保证非 Host 调用会被拒绝（返回 403）。

##### 7.1.2 `hostActions.ts` — debug telemetry（~15 处）

| 位置               | 代码                          | 说明                        |
| ------------------ | ----------------------------- | --------------------------- |
| 各 submit 函数日志 | `{ isHost: ctx.isHost }` ×~15 | 纯 debug 元数据，无逻辑影响 |

**处理：** 从日志 payload 中移除 `isHost` 字段。Phase 6 后推进不再依赖 Host，该字段在 telemetry 中不再有意义。

##### 7.1.3 `HostActionsContext` — `isHost` 属性

| 位置                                 | 代码                  | 说明                                                   |
| ------------------------------------ | --------------------- | ------------------------------------------------------ |
| `HostActionsContext` interface       | `isHost: boolean`     | Phase 6 后不再有消费者（推进门控已删，telemetry 已删） |
| `GameFacade.getHostActionsContext()` | `isHost: this.isHost` | 同上                                                   |

**处理：** 从 `HostActionsContext` interface 中删除 `isHost`；从 `getHostActionsContext()` 中删除该字段传递。

##### 7.1.4 `game-engine` — `HandlerContext.isHost` + handler gates

| 位置                       | 代码              | 说明                                         |
| -------------------------- | ----------------- | -------------------------------------------- |
| `HandlerContext` interface | `isHost: boolean` | handler 层权限校验                           |
| 各 handler `if (!isHost)`  | 权限门控          | Vercel Serverless 调用时始终传 `isHost=true` |

**处理：** 保留。`game-engine` 是共享包，本地复用场景（测试 / 未来 CLI 工具）仍需要 `isHost` 校验。服务端 handler 传 `isHost=true` 是 caller 职责，handler 本身的校验是正确的防御性编程。

#### 7.2 符号验证

| 符号                                | 消费者                                                                                                                                                                 | 处理                                                                                                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GameFacade.isHost` (private field) | `restartGame` / `fillWithBots` / `markAllBotsViewed` / `getHostActionsContext` / `getMessageRouterContext` / `isHostPlayer()` / `useBgmControl` / `useHostGameActions` | Phase 7 删除 `restartGame` 等 3 处门控 + `getHostActionsContext` 传递；`isHostPlayer()` / `useBgmControl` / `useHostGameActions` 保留（UI 角色标记） |
| `HostActionsContext.isHost`         | `submitAction` / `submitWolfVote` 门控（Phase 6 已删）+ telemetry ~15 处                                                                                               | Phase 7 删除 telemetry + interface 字段                                                                                                              |
| `HandlerContext.isHost`             | game-engine handlers                                                                                                                                                   | 保留不动                                                                                                                                             |

#### 7.3 Commit 计划（1 commit）

| #   | message                                                          | 内容                                                                                                                  | 验证       |
| --- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | `refactor(services): remove redundant client-side isHost guards` | 删除 `GameFacade` 3 处快速拦截 + `HostActionsContext.isHost` 字段 + `hostActions.ts` telemetry ~15 处；更新受影响测试 | tsc + jest |

#### 7.4 风险

- **极低风险**：纯删除冗余代码，服务端校验兜底
- **唯一注意点**：删除 `HostActionsContext.isHost` 后确认无其他消费者遗漏（需 `grep_search` 验证）

---

### Phase 8: Proxy Stub 最终清理

**目标：** 删除 migration 过程中遗留的所有 proxy re-export stub 和冗余副本，让 `src/` 只保留客户端专属代码。

#### 8.1 已完成的清理（3 commits）

| Commit            | 内容                                                                                                                                                                      | 文件变更  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| B1: `f429acc7`    | 删除 23 个 engine/resolver proxy re-export stubs（`src/services/engine/`、`src/services/protocol/reasonCodes.ts`）                                                        | 64 files  |
| B2+B3: `36a58dda` | 删除 16 个 models/protocol/resolver proxy stubs + `src/types/RoleRevealAnimation.ts`；~200 文件 import 路径批量更新 `@/models/` → `@werewolf/game-engine/models/` 等      | 198 files |
| B4                | 删除 13 个冗余 resolver 源文件（`src/services/night/resolvers/*.ts`，与 game-engine 仅 import 路径不同）+ 14 个测试文件 import 更新 + 删除空目录 `src/services/protocol/` | 28 files  |

#### 8.2 清理总结

| 类别                     | 数量     | 说明                                                   |
| ------------------------ | -------- | ------------------------------------------------------ |
| 删除的 proxy stub 文件   | 39       | `export * from '@werewolf/game-engine/...'` 一行式转发 |
| 删除的冗余 resolver 副本 | 13       | 逻辑完全相同，仅 import 路径不同                       |
| 删除的空目录             | 1        | `src/services/protocol/`                               |
| 更新的 import 路径       | ~400+    | `@/models/*` → `@werewolf/game-engine/models/*` 等     |
| import + require 模式    | 均已覆盖 | 含 Jest `require()` mock 路径                          |

#### 8.3 最终目录状态

| 目录                            | 源文件                  | 测试文件 | 说明                                                    |
| ------------------------------- | ----------------------- | -------- | ------------------------------------------------------- |
| `src/models/`                   | 0                       | 11       | 测试 game-engine 逻辑，import `@werewolf/game-engine/*` |
| `src/services/engine/`          | 0                       | 19       | 同上                                                    |
| `src/services/night/resolvers/` | 0                       | 19       | 同上                                                    |
| `src/services/protocol/`        | —                       | —        | 已删除                                                  |
| `src/types/`                    | 1 (`GameStateTypes.ts`) | 1        | `GameStateTypes.ts` 含 83 行客户端专属类型，非 stub     |

> **P2 后续可选：** ~~上述 49 个测试文件仍在 `src/` 但测试的是 game-engine 纯逻辑。待 game-engine 有自己的 jest config 后可迁移至 `packages/game-engine/__tests__/`。~~ **已完成** — 见 8.5。

#### 8.4 验证

- `pnpm exec tsc --noEmit` — 0 errors ✅
- `pnpm exec jest --no-coverage --forceExit` — 171 suites / 2636 tests ✅

#### 8.5 P2 测试共址迁移（Test Co-location）

社区 monorepo 惯例：测试应与被测代码共址。48 个测试文件原先在 `src/` 但完全依赖 `@werewolf/game-engine/*`（零 `@/` 客户端 import），属于 game-engine 纯逻辑测试。

**变更：**

| 操作                                       | 数量                 | 说明                                                                                                                                                                                                   |
| ------------------------------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 新增 `ts-jest ^29.4.6`                     | 1 devDep             | game-engine 独立 jest preset                                                                                                                                                                           |
| 新增 `packages/game-engine/jest.config.js` | 1 文件               | `preset: 'ts-jest'`, `testEnvironment: 'node'`, self-referencing `moduleNameMapper`                                                                                                                    |
| 更新 `packages/game-engine/tsconfig.json`  | paths                | 添加 `@werewolf/game-engine/*` 自引用路径                                                                                                                                                              |
| 更新 `packages/game-engine/package.json`   | scripts              | 添加 `"test": "jest --no-coverage --forceExit"`                                                                                                                                                        |
| `git mv` 测试文件                          | 48 文件 + 1 snapshot | `src/models/` → `game-engine/src/models/`, `src/services/engine/` → `game-engine/src/engine/`, `src/services/night/resolvers/` → `game-engine/src/resolvers/`, `src/types/` → `game-engine/src/types/` |
| 保留 `import-boundary.test.ts`             | 1 文件               | 跨包架构边界测试，用 `fs`/`path` 扫描 `src/` 和 `packages/`，必须留在 root                                                                                                                             |
| 更新 `hardGates.contract.test.ts`          | 1 文件               | engine 目录路径从 `src/services/engine` → `packages/game-engine/src/engine`                                                                                                                            |
| 删除空目录                                 | ~15 目录             | `src/models/__tests__/`, `src/services/engine/`, `src/services/night/` 等                                                                                                                              |

**验证：**

- `cd packages/game-engine && pnpm test` — 48 suites / 990 tests ✅
- `pnpm exec jest --no-coverage --forceExit`（root）— 123 suites / 1646 tests ✅
- 合计 171 suites / 2636 tests（与迁移前一致）
- `pnpm exec tsc --noEmit` — 0 errors ✅

---

## 不变的部分

| 功能                | 方式                          | 原因                    |
| ------------------- | ----------------------------- | ----------------------- |
| 创建/加入/关闭房间  | 客户端直连 Supabase DB        | 不涉及 Host，无后台问题 |
| 在线状态 (presence) | Supabase Realtime             | 不涉及 Host             |
| Auth (登录/注册)    | Supabase Auth                 | 完全独立                |
| 头像上传            | Supabase Storage              | 完全独立                |
| AI 聊天             | Supabase Edge Function → Groq | 完全独立                |
| 音频播放            | Host 设备本地                 | UI 行为，非游戏逻辑     |
| 用户设置            | AsyncStorage 本地             | 非共享数据              |

## DB 变更

**不需要新 migration。** 现有 schema 完全够用：

```sql
rooms (
  id              UUID PRIMARY KEY,
  code            TEXT UNIQUE,
  host_id         TEXT,
  game_state      JSONB,           -- 完整 BroadcastGameState
  state_revision  INT DEFAULT 0,   -- 乐观锁
  created_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ
)
```

**可选优化（Phase 3 之后）：** 加 RLS policy 限制只有 Vercel（service role）能写 `game_state`，防止客户端绕过 API 直接篡改。

---

## 风险与缓解

| 风险            | 影响                        | 缓解                                                             |
| --------------- | --------------------------- | ---------------------------------------------------------------- |
| Vercel 冷启动   | 首次请求 200-500ms          | 回合制游戏可接受；可预热或用 Edge Functions                      |
| DB 读写延迟     | ~20-40ms per request        | 与音频播放时间（秒级）相比可忽略                                 |
| 并发冲突        | 两人同时操作同一 state      | `state_revision` 乐观锁 + 客户端重试                             |
| Vercel 宕机     | 所有游戏操作不可用          | Vercel 99.99% SLA；可保留 Host fallback 模式                     |
| Phase 0 重构    | ~60 文件 import 更新        | TypeScript 编译 + 2713 测试覆盖                                  |
| 音频编排复杂性  | Phase 3 音频时序可能出 bug  | 现有 E2E 测试保障 + 手动验证关键场景                             |
| Wolf Vote Timer | 跨 Host/服务端的 timer 同步 | state 中存 `wolfVoteDeadline` 时间戳，任何客户端到期都能触发推进 |

---

## 工期估算

| 阶段                          | Commits   | 工作量       | 说明                                                                      |
| ----------------------------- | --------- | ------------ | ------------------------------------------------------------------------- |
| Phase 0: 共享包提取           | 4         | 1-2 天       | 文件移动 + import 更新 + 依赖抽象，纯机械操作                             |
| Phase 1: 入座/离座 API        | 3         | 1-2 天       | 第一个 API Route + 客户端改造 + 测试更新                                  |
| Phase 2: 游戏控制 API         | 3         | 2-3 天       | 7 个 API Route + 音频 sideEffects + 测试更新                              |
| Phase 3: 夜晚流程 API         | 4         | 3-5 天       | 8 个 API Route + 自动推进改造 + timer + 测试                              |
| Phase 4: 统一客户端架构       | 3         | 1-2 天       | 消除 Host/Player 分叉 + 删除 P2P 消息                                     |
| Phase 5: 消除 HostStateCache  | 2         | 1 天         | 删除 HostStateCache + 统一 rejoin 到 DB + 合并入口方法                    |
| Phase 6: 推进/计时迁移服务端  | 3-4       | 3-5 天       | 服务端内联推进 + pendingAudioEffects 队列 + 客户端 deadline 兜底          |
| Phase 7: 清理冗余 isHost 门控 | 1         | 0.5 天       | 删除 GameFacade 快速拦截 + HostActionsContext.isHost + telemetry          |
| Phase 8: Proxy Stub 最终清理  | 4         | 0.5 天       | 删除 52 个 proxy stub / 冗余副本 + ~400 import 路径更新 + 48 测试共址迁移 |
| 集成测试 + 文档               | 1         | 1 天         | E2E 全量回归 + 文档更新                                                   |
| **总计**                      | **27-29** | **15-25 天** |                                                                           |

---

## 执行顺序

1. **Phase 0**: 提取 `@werewolf/game-engine` — **无功能变化，纯重构** ✅
2. **Phase 1**: 入座/离座 → HTTP — 最简单的操作，验证端到端 + 基础设施 ✅
3. **Phase 2**: 游戏控制 → HTTP — 引入音频 sideEffects 模式 ✅
4. **Phase 3**: 夜晚流程 → HTTP — 最复杂，音频编排 + 自动推进 ✅
5. **Phase 4**: 统一客户端架构 — 消除 Host/Player 代码分叉，所有客户端平等 ✅
6. **Phase 5**: 消除 HostStateCache — 统一 rejoin 到 DB + 合并入口方法（纯客户端，零服务端改动） ✅
7. **Phase 6**: 推进/计时迁移服务端 — 服务端内联推进 + pendingAudioEffects 队列 + 客户端 deadline 兜底 ✅
8. **Phase 7**: 清理冗余 isHost 门控 — 删除 GameFacade 快速拦截 + HostActionsContext.isHost + telemetry（纯清理，零行为变化） ✅
9. **Phase 6 补完**: 客户端 reactive 消费 pendingAudioEffects + postProgression ✅
   - Fix 1: GameFacade constructor 添加 store subscription，检测 `pendingAudioEffects` 非空 → 依次播放 → `postAudioAck`
   - Fix 2: wolf vote deadline 到期后 Host 调用 `postProgression`（一次性 guard 防重入）
   - Fix 3: `start.ts` API 从 handler sideEffects 提取 PLAY_AUDIO → 写入 `pendingAudioEffects` + `isAudioPlaying` state
10. **Phase 8**: Proxy Stub 最终清理 — 删除 52 个 proxy stub / 冗余副本 + ~400 import 更新 + 48 测试共址迁移（4 commits: B1 engine stubs, B2+B3 models/protocol stubs, B4 resolver duplicates, B5 test co-location） ✅
11. **集成测试 + 文档**: E2E 全量回归 + 文档更新
