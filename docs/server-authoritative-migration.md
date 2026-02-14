# 服务器权威架构迁移方案

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

| 阶段                   | 工作量      | 说明                                          |
| ---------------------- | ----------- | --------------------------------------------- |
| Phase 0: 共享包提取    | 1-2 天      | 文件移动 + import 更新 + 依赖抽象，纯机械操作 |
| Phase 1: 入座/离座 API | 1-2 天      | 第一个 API Route + 客户端改造 + 测试更新      |
| Phase 2: 游戏控制 API  | 2-3 天      | 7 个 API Route + 音频 sideEffects + 测试更新  |
| Phase 3: 夜晚流程 API  | 3-5 天      | 6 个 API Route + 自动推进改造 + timer + 测试  |
| 清理 + 集成测试        | 1-2 天      | 删除废弃代码 + E2E 全量回归                   |
| **总计**               | **8-14 天** |                                               |

---

## 执行顺序

1. **Phase 0**: 提取 `@werewolf/game-engine` — **无功能变化，纯重构**
2. **Phase 1**: 入座/离座 → HTTP — 最简单的操作，验证端到端 + 基础设施
3. **Phase 2**: 游戏控制 → HTTP — 引入音频 sideEffects 模式
4. **Phase 3**: 夜晚流程 → HTTP — 最复杂，音频编排 + 自动推进
5. **清理**: 删除 Host 端废弃的 broadcast 转发逻辑、整理 messageRouter
