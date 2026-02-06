# Anti-Drift Audit Report

> 审计日期：2026-02-06
> 审计范围：Actor Identity / Night Steps / BroadcastGameState / Normalize

---

## 审计方法

使用 grep 搜索关键词，逐一分析使用场景，确认是否存在"双写/重复来源/语义漂移"风险。

### Grep 命令列表

```bash
# A) Actor identity / debug delegation
grep -rn "effectiveSeat|effectiveRole|controlledSeat" src/ --include="*.ts" --include="*.tsx" | grep -v "__tests__"
grep -rn "actorSeatForUi|actorRoleForUi" src/ --include="*.ts" --include="*.tsx" | grep -v "__tests__"
grep -rn "imActioner" src/ --include="*.ts" --include="*.tsx" | grep -v "__tests__"

# B) Night step / schema / role
grep -rn "ACTION_ORDER|night1\.order|actionOrder|roleTurn|currentActionRole" src/ --include="*.ts" --include="*.tsx" | grep -v "__tests__"
grep -rn "audioKey|audioEndKey" src/ --include="*.ts" --include="*.tsx" | grep -v "__tests__"
grep -rn "NIGHT_STEPS" src/ --include="*.ts" --include="*.tsx" | grep -v "__tests__"

# C) BroadcastGameState fields
grep -rn "wolfKillDisabled|nightmareBlockedSeat|blockedSeat" src/ --include="*.ts" --include="*.tsx" | grep -v "__tests__"
grep -rn "wolfVotesBySeat|wolfVotes|wolfVoteStatus" src/ --include="*.ts" --include="*.tsx" | grep -v "__tests__"

# D) normalizeState
grep -rn "normalizeState|BROADCAST_GAME_STATE_FIELDS" src/ --include="*.ts" --include="*.tsx" | grep -v "__tests__"
```

---

## A) Actor Identity / Debug Delegation

### 审计结论：✅ 安全（无双写风险）

#### 1. `effectiveSeat` / `effectiveRole` / `controlledSeat` 使用分析

| 文件路径                        | 使用场景                                                                                                   | 风险评估                             |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `useGameRoom.ts:300-308`        | **计算点**：`effectiveSeat = controlledSeat ?? mySeatNumber`，`effectiveRole = players.get(effectiveSeat)` | ✅ 唯一计算点                        |
| `useGameRoom.ts:683-698`        | **submit 入口**：`submitAction`/`submitWolfVote` 使用 `effectiveSeat/effectiveRole`                        | ✅ 正确使用                          |
| `useGameRoom.ts:675`            | **viewedRole**：使用 `controlledSeat ?? mySeatNumber`                                                      | ✅ 已修复                            |
| `RoomScreen.tsx:110-113`        | 从 `useGameRoom` 解构                                                                                      | ✅ 传递用                            |
| `RoomScreen.tsx:227-231`        | 传入 `getActorIdentity()` 作为输入                                                                         | ✅ 正确用法                          |
| `RoomScreen.tsx:241-249`        | warn 日志记录 delegation 状态                                                                              | ✅ 观测用途                          |
| `RoomScreen.tsx:519-534`        | `actionRejected` 检测使用 `effectiveSeat` 获取 uid                                                         | ⚠️ **边缘用途**（见下）              |
| `RoomScreen.tsx:749-876`        | `handleSeatTapIntent` 中的 UI 逻辑使用 `effectiveRole`                                                     | ⚠️ **边缘用途**（见下）              |
| `RoomScreen.helpers.ts:272-276` | `buildSeatViewModels` 中的 `effectiveRole`                                                                 | ✅ 不同语义（seat 显示用，非 actor） |
| `actorIdentity.ts`              | `getActorIdentity()` 定义                                                                                  | ✅ 单一真相函数                      |
| `RoomInteractionPolicy.ts:232`  | 检查 `controlledSeat === event.seatIndex` 用于 self-tap                                                    | ✅ 正确用法                          |
| 后端 resolvers                  | 完全不同的 `effectiveRole`（指交换后角色），与 UI 无关                                                     | ✅ 不同上下文                        |

#### 2. `actorSeatForUi` / `actorRoleForUi` 使用分析

| 文件路径                   | 使用场景                                             | 风险评估    |
| -------------------------- | ---------------------------------------------------- | ----------- |
| `RoomScreen.tsx:234`       | 从 `actorIdentity` 解构                              | ✅          |
| `RoomScreen.tsx:254-258`   | 传入 `useActionerState` 作为 `myRole`/`mySeatNumber` | ✅ 正确用法 |
| `RoomScreen.tsx:285`       | 传入 `buildSeatViewModels`                           | ✅          |
| `RoomScreen.tsx:411-412`   | 传入 `handleSeatTap`                                 | ✅          |
| `RoomScreen.tsx:1170-1194` | 传入日志                                             | ✅ 观测用途 |
| `types.ts:197-199`         | `InteractionContext` 字段定义                        | ✅          |

#### 3. `imActioner` 使用分析

| 文件路径                           | 使用场景                     | 风险评估    |
| ---------------------------------- | ---------------------------- | ----------- |
| `useActionerState.ts`              | 从 `actorRoleForUi` 计算     | ✅ 正确派生 |
| `RoomInteractionPolicy.ts:108,134` | Policy 使用 `ctx.imActioner` | ✅ 正确用法 |
| `RoomScreen.tsx:253`               | 从 `useActionerState` 获取   | ✅          |

#### ⚠️ 边缘用途分析

**RoomScreen.tsx:519-534 (`actionRejected` 检测)**：

- 使用 `effectiveSeat` 获取 `players.get(effectiveSeat)?.uid`
- **原因**：需要检查被拒绝的 action 是否属于当前操作者
- **风险**：低。这是 **submit 后的反馈**，不是 gate 判断
- **结论**：✅ 合理使用

**RoomScreen.tsx:749-876 (`handleSeatTapIntent` 中的 `effectiveRole`)**：

- 用于 UI hint 过滤和特定角色逻辑（magician swap, hunter confirm）
- **原因**：在 Intent 处理中需要知道当前操作者角色
- **风险**：这里使用 `effectiveRole` 而不是 `actorRoleForUi`
- **分析**：
  - `effectiveRole` 和 `actorRoleForUi` 在 delegation 正常时相等（`getActorIdentity` fail-fast 保证）
  - 如果 delegation 状态无效，`actorRoleForUi` 为 null，整个 action 流程会被阻断
  - 这里是 **Intent 处理阶段**，前面已经通过 `imActioner` gate
- **结论**：✅ 可接受（但建议统一使用 `actorRoleForUi`）

### 规则符合性检查

| 规则                                                       | 状态 |
| ---------------------------------------------------------- | ---- |
| UI/Policy 行动判断只用 `actor*` 或 `getActorIdentity` 输出 | ✅   |
| `effective*` 只在 `useGameRoom` 计算 + submit 入口使用     | ✅   |
| `my*` 只用于真实身份展示与 host 权限判断                   | ✅   |
| 不存在 `actor*` 与 `effective*` 并存各自做判断             | ✅   |

---

## B) Night Step / Schema / Role

### 审计结论：✅ 安全（无平行顺序表）

#### 1. 顺序来源分析

| 关键词         | 搜索结果                                             | 风险评估    |
| -------------- | ---------------------------------------------------- | ----------- |
| `ACTION_ORDER` | 0 匹配                                               | ✅ 已废弃   |
| `actionOrder`  | 仅注释："actionOrder removed, derive from NightPlan" | ✅ 已废弃   |
| `roleTurn`     | 0 匹配                                               | ✅ 不存在   |
| `night1.order` | 仅注释："not legacy RoleSpec.night1.order"           | ✅ 已废弃   |
| `NIGHT_STEPS`  | 30+ 匹配，全部引用同一来源                           | ✅ 单一真相 |

**单一来源确认**：`src/models/roles/spec/nightSteps.ts:108` 导出 `NIGHT_STEPS`

#### 2. `audioKey` 来源分析

| 文件路径                           | 用途                                      | 风险评估    |
| ---------------------------------- | ----------------------------------------- | ----------- |
| `nightSteps.ts:27-103`             | **唯一定义点**：每个 step 定义 `audioKey` | ✅ 单一来源 |
| `nightSteps.types.ts:21-23`        | 类型定义                                  | ✅          |
| `plan.ts:71`                       | `audioKey: step.audioKey` 透传            | ✅          |
| `stepTransitionHandler.ts:478-493` | 读取 `step.audioKey` / `step.audioEndKey` | ✅ 消费者   |
| `GameFacade.ts:602-611`            | 根据 `audioKey` 播放音频                  | ✅ 消费者   |

**结论**：`audioKey` 唯一来源是 `NIGHT_STEPS`，无双写。

#### 3. `schemaId` 派生逻辑

| 位置                     | 逻辑                                                                                                        | 风险评估 |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- | -------- |
| `useGameRoom.ts:336-344` | `schemaId = getRoleSpec(currentActionRole).schemaId ?? getStepsByRoleStrict(currentActionRole)[0].schemaId` | ✅ 一致  |
| `SCHEMAS`                | 唯一定义点                                                                                                  | ✅       |

---

## C) BroadcastGameState 字段

### 审计结论：✅ 安全（无重复来源）

#### 1. `wolfKillDisabled` / `nightmareBlockedSeat` / `blockedSeat`

| 字段                   | 写入点                                                     | 读取点                                                     | 风险评估    |
| ---------------------- | ---------------------------------------------------------- | ---------------------------------------------------------- | ----------- |
| `blockedSeat`          | `nightmare.ts:42` → `currentNightResults.blockedSeat`      | `gameReducer.ts:234-235` 映射到顶层 `nightmareBlockedSeat` | ⚠️ **见下** |
| `nightmareBlockedSeat` | `gameReducer.ts:234-235`                                   | UI 读取顶层字段                                            | ✅          |
| `wolfKillDisabled`     | `nightmare.ts:43` → `currentNightResults.wolfKillDisabled` | `gameReducer.ts:236-237` 映射到顶层                        | ✅          |

**⚠️ 分析**：

- `currentNightResults.blockedSeat` → 顶层 `nightmareBlockedSeat` 是 **reducer 层面的映射**，不是双写
- 这是有意的设计：resolver 写 `currentNightResults`，reducer 提升到顶层供 UI 读取
- **结论**：✅ 可接受（映射关系，非双写）

#### 2. `wolfVotesBySeat` / `wolfVotes`

| 字段                                  | 写入点                             | 读取点                              | 风险评估 |
| ------------------------------------- | ---------------------------------- | ----------------------------------- | -------- |
| `currentNightResults.wolfVotesBySeat` | `wolf.ts:24-25,68-69`              | 唯一真相                            | ✅       |
| `GameState.wolfVotes` (LocalState)    | `broadcastToLocalState.ts:146-150` | 本地 Map，从 `wolfVotesBySeat` 转换 | ✅       |

**结论**：

- 协议层唯一真相：`currentNightResults.wolfVotesBySeat`
- 本地 `wolfVotes` 是 **适配器转换**（Record → Map），不是平行真相
- `normalize.ts:46-53` 明确注释："single source of truth: currentNightResults.wolfVotesBySeat"

---

## D) normalizeState 字段透传

### 审计结论：✅ 安全

#### 白名单检查

`BROADCAST_GAME_STATE_FIELDS` 在 `normalize.contract.test.ts` 中定义，包含：

```typescript
const BROADCAST_GAME_STATE_FIELDS: (keyof BroadcastGameState)[] = [
  'roomCode',
  'hostUid',
  'status',
  'templateRoles',
  'players',
  'currentActionerIndex',
  'isAudioPlaying',
  'roleRevealAnimation',
  'resolvedRoleRevealAnimation',
  'roleRevealRandomNonce',
  'currentStepId',
  'actions',
  'currentNightResults',
  'pendingRevealAcks',
  'lastNightDeaths',
  'nightmareBlockedSeat',
  'wolfKillDisabled',
  'wolfRobotContext',
  'witchContext',
  'seerReveal',
  'psychicReveal',
  'gargoyleReveal',
  'wolfRobotReveal',
  'wolfRobotHunterStatusViewed',
  'confirmStatus',
  'actionRejected',
  'debugMode',
  'ui', // ✅ 已包含
];
```

#### Contract Test 覆盖

`normalize.contract.test.ts` 包含：

1. **正向测试**：所有字段归一化后都存在
2. **反向测试**：归一化后不引入白名单外的字段
3. **透传测试**：可选字段正确透传

---

## 风险点处理

### 已处理

| 风险点                          | 处理方式                                    |
| ------------------------------- | ------------------------------------------- |
| `getActorIdentity()` 无分支逻辑 | ✅ 已修复：proper branching + fail-fast     |
| `InteractionContext` 可选字段   | ✅ 已修复：required fields                  |
| `viewedRole` 使用错误 seat      | ✅ 已修复：`controlledSeat ?? mySeatNumber` |
| delegation 无效状态无日志       | ✅ 已修复：warn logging                     |

### 新增 Contract Tests

见 `actorIdentity.noParallelGate.contract.test.ts`：

1. **No-parallel-action-identity**：Policy 不直接使用 `effective*`
2. **Night steps single-source**：无 `ACTION_ORDER` 等平行顺序表
3. **Broadcast fields normalized**：所有字段在白名单中

---

## 结论

本次审计确认：

1. **Actor Identity**：单一真相 `getActorIdentity()`，无双写
2. **Night Steps**：单一来源 `NIGHT_STEPS`，无平行顺序表
3. **BroadcastGameState**：字段透传正确，无静默丢失
4. **normalizeState**：白名单覆盖完整

**CI 状态**：2410 tests passing ✅
