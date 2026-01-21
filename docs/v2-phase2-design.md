# Phase2 设计方案：Night-1 迁移到 v2

> **版本**：v1.2
> **日期**：2026-01-21
> **作者**：Copilot

---

## Changelog: v1.1 → v1.2

| 改动点 | 状态 |
|--------|------|
| 删除 PR1/PR2 中的 `rebuildNightFlow` / `restoreFromState` 伪 API | ✅ Done |
| NightFlow 派生重建移至 PR5（Design placeholder） | ✅ Done |
| `currentNightPhase` 引用真实 `NightPhase` enum 字面量 | ✅ Done |
| `currentStepId` 明确来源于 `NIGHT_STEPS`，写清缺失时的安全默认值 | ✅ Done |
| 删除 `buildNightPlan(state.templateRoles)` 伪代码 | ✅ Done |
| 新增"向后兼容/容错契约"小节 | ✅ Done |
| 新增 TODO(remove by 2026-03-01) 迁移规则 | ✅ Done |

---

## 0. 执行红线（Non-negotiable）

| 红线 | 检查点 |
|------|--------|
| **Night-1 only** | 禁止 `previousNight`、`lastNightTarget`、跨夜状态 |
| **Host 唯一权威** | resolver/reducer/death calculation 只在 Host；Player 只 send + applySnapshot |
| **单一状态源** | 全部游戏信息在 `BroadcastGameState`；UI 按 `myRole` 过滤；**禁止 hostOnly state** |
| **单一协议源** | 只用 `HostBroadcast` / `PlayerMessage` / `BroadcastGameState`（`protocol/types.ts`） |
| **NightPlan 单一真相** | 步骤顺序来自 `NIGHT_STEPS`（`src/models/roles/spec/nightSteps.ts`） |
| **v2 禁止运行时 import legacy** | 测试/验证可参考，运行时禁止；无 runtime feature flag |
| **NightFlowController 不持有权威状态** | 若保留只能是可由 `BroadcastGameState` 重建的派生状态机 |

---

## A. 现状盘点

### A1. Legacy 能力入口（`src/services/legacy/GameStateService.ts`）

| 能力 | 入口方法 | 行号（约） | 说明 |
|------|----------|-----------|------|
| **assignRoles** | `assignRoles()` | 1453-1477 | 洗牌 + 分配 + status → assigned |
| **startGame** | `startGame()` | 1482-1555 | 构建 NightPlan → 创建 NightFlowController → 播放夜晚开始音频 → status → ongoing |
| **audio sequencing** | `playCurrentRoleAudio()` / `advanceToNextAction()` | ~1655 / ~1200 | AudioService 播放；NightFlowController 推进 |
| **submitAction** | `handlePlayerAction()` | 744-920 | 校验 phase/role → invokeResolver → applyResolverResult → broadcast |
| **submitWolfVote** | `handleWolfVote()` | ~960-1055 | 记录投票 → allVoted → resolveWolfVotes → record action |
| **reveal / revealAck** | `handlePlayerAction()` + `pendingRevealAcks` | ~905-920 | 揭示角色加入 pending；`submitRevealAck()` 移除后 advance |
| **endNight** | `endNight()` | ~1300 | 计算死亡 → status → ended → broadcast NIGHT_END |

### A2. 关键依赖模块

| 模块 | 路径 | 职责 |
|------|------|------|
| **NightFlowController** | `src/services/NightFlowController.ts` | 夜晚 phase 状态机（`NightPhase` enum） |
| **NightPlan / NIGHT_STEPS** | `src/models/roles/spec/nightSteps.ts` | 夜晚步骤表（顺序 + audioKey）—— 单一真相 |
| **RESOLVERS** | `src/services/night/resolvers/index.ts` | 各角色 resolver 纯函数注册表 |
| **DeathCalculator** | `src/services/DeathCalculator.ts` | 纯函数计算死亡 |
| **WolfVoteResolver** | `src/services/WolfVoteResolver.ts` | 解析狼人投票得出最终刀人 |
| **AudioService** | `src/services/AudioService.ts` | 播放音频（副作用） |

### A3. v2 已有模块

| 模块 | 路径 | 现状 |
|------|------|------|
| **V2GameFacade** | `src/services/v2/facade/V2GameFacade.ts` | Phase 1 座位 CRUD；`hostHandlePlayerMessage` 只处理 `SEAT_ACTION_REQUEST` |
| **GameStore** | `src/services/v2/store/GameStore.ts` | 持有 `GameState = BroadcastGameState`；revision 管理；applySnapshot |
| **gameReducer** | `src/services/v2/reducer/gameReducer.ts` | 已有 `ASSIGN_ROLES` / `START_NIGHT` / `ADVANCE_TO_NEXT_ACTION` / `END_NIGHT` / `RECORD_ACTION` / `APPLY_RESOLVER_RESULT` 等 action |
| **handlers/** | `src/services/v2/handlers/` | `seatHandler.ts` / `gameControlHandler.ts` / `actionHandler.ts` 已有骨架 |
| **intents/** | `src/services/v2/intents/types.ts` | 已有 `StartGameIntent` / `SubmitActionIntent` / `SubmitWolfVoteIntent` / `ViewedRoleIntent` 等 |
| **protocol/** | `src/services/v2/protocol/types.ts` | `BroadcastGameState` / `HostBroadcast` / `PlayerMessage` 完整 |

### A4. 协议消息类型引用（`src/services/protocol/types.ts`）

**PlayerMessage union 分支**（Player → Host）：
- `{ type: 'REQUEST_STATE'; uid: string }`
- `{ type: 'JOIN'; seat; uid; displayName; avatarUrl? }`
- `{ type: 'LEAVE'; seat; uid }`
- `{ type: 'ACTION'; seat; role; target; extra? }`
- `{ type: 'WOLF_VOTE'; seat; target }`
- `{ type: 'VIEWED_ROLE'; seat }`
- `{ type: 'REVEAL_ACK'; seat; role; revision }`
- `{ type: 'SEAT_ACTION_REQUEST'; requestId; action; seat; uid; displayName?; avatarUrl? }`
- `{ type: 'SNAPSHOT_REQUEST'; requestId; uid; lastRevision? }`

**HostBroadcast union 分支**（Host → Player）：
- `{ type: 'STATE_UPDATE'; state; revision }`
- `{ type: 'ROLE_TURN'; role; pendingSeats; killedIndex?; stepId? }`
- `{ type: 'NIGHT_END'; deaths }`
- `{ type: 'PLAYER_JOINED'; seat; player }`
- `{ type: 'PLAYER_LEFT'; seat }`
- `{ type: 'GAME_RESTARTED' }`
- `{ type: 'SEAT_REJECTED'; seat; requestUid; reason }`
- `{ type: 'SEAT_ACTION_ACK'; requestId; toUid; success; seat; reason? }`
- `{ type: 'SNAPSHOT_RESPONSE'; requestId; toUid; state; revision }`

---

## B. v2 设计：模块分层与数据流

### B1. 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                    UI 层                                     │
│   RoomScreen / NightActionPanel / WolfVotePanel / ...                       │
│       │                                                                      │
│       ▼                                                                      │
│   useGameRoom() ─── gameState / roomStatus / currentActionRole / ...        │
│       │ facade.xxx()                                                         │
└───────┼─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          V2GameFacade (Facade 层)                           │
│                                                                              │
│   • 编排入口：startGame() / submitAction() / submitWolfVote() / ...         │
│   • Player: sendToHost(PlayerMessage)                                       │
│   • Host:   hostHandlePlayerMessage(msg) → build Intent → call handler      │
│   • 副作用: broadcastCurrentState() / audioService.play()                   │
│                                                                              │
└───────┼─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Handler 层 (Host-only)                             │
│   src/services/v2/handlers/                                                 │
│                                                                              │
│   handleStartGame(intent, context)  → 校验 + assignRoles + startNight      │
│   handleSubmitAction(intent, context) → 校验 + invokeResolver + actions     │
│   handleSubmitWolfVote(intent, context) → 校验 + 记录投票 + 判断 allVoted   │
│   handleViewedRole(intent, context) → 标记 hasViewedRole                    │
│                                                                              │
│   返回: { success, reason?, actions: StateAction[], sideEffects? }          │
└───────┼─────────────────────────────────────────────────────────────────────┘
        │ (if action involves night action)
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Resolver 层 (Host-only 纯函数)                      │
│   src/services/night/resolvers/                                             │
│                                                                              │
│   RESOLVERS[schemaId](context, input) → ResolverResult                      │
│   { valid, rejectReason?, updates?, result? }                               │
│                                                                              │
│   ⚠️ Resolver 是唯一验证+计算逻辑源；Handler 不做二次计算                    │
└───────┼─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Reducer 层                                          │
│   src/services/v2/reducer/gameReducer.ts                                    │
│                                                                              │
│   gameReducer(state, action) → newState                                     │
│   支持: ASSIGN_ROLES / START_NIGHT / RECORD_ACTION / APPLY_RESOLVER_RESULT  │
│         ADVANCE_TO_NEXT_ACTION / END_NIGHT / SET_WITCH_CONTEXT / ...        │
└───────┼─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Store 层                                            │
│   src/services/v2/store/GameStore.ts                                        │
│                                                                              │
│   Host: store.setState(newState) → revision++ → notify listeners            │
│   Player: store.applySnapshot(state, revision)                              │
└───────┼─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Broadcast (Transport)                               │
│   src/services/BroadcastService.ts                                          │
│                                                                              │
│   Host: broadcastAsHost({ type: 'STATE_UPDATE', state, revision })          │
│   Player: sendToHost(PlayerMessage)                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### B2. `BroadcastGameState` 新增字段（数据契约）

**新增字段定义**（`src/services/protocol/types.ts`）：

| 字段 | 类型 | 必须 `?` | 来源 | 缺失时安全默认值 |
|------|------|----------|------|------------------|
| `currentNightPhase` | `'Idle' \| 'NightBeginAudio' \| 'RoleBeginAudio' \| 'WaitingForAction' \| 'RoleEndAudio' \| 'NightEndAudio' \| 'Ended'` | ✅ 可选 | Reducer 在 `START_NIGHT` / `ADVANCE_TO_NEXT_ACTION` 时设置 | `undefined` → 视为 `'Idle'` |
| `currentStepId` | `SchemaId` | ✅ 可选 | 来源于 `NIGHT_STEPS`（`src/models/roles/spec/nightSteps.ts`），由 reducer 根据 `currentActionerIndex` 查表设置 | `undefined` → UI 不显示步骤名/音频指示 |

**重要约束**：
- `currentStepId` 的值必须是 `NIGHT_STEPS[currentActionerIndex].id`，**禁止新增平行步骤表**
- 现有 plan builder / steps 以 repo 实际实现为准：`src/models/roles/spec/nightSteps.ts` + `src/models/roles/spec/plan.ts`

### B3. 向后兼容/容错契约（迁移护栏）

**容错规则**：
1. 当旧状态缺失 `currentNightPhase` 时：
   - **Host**：视为 `'Idle'`，不崩溃，正常处理
   - **Player UI**：视为 `'Idle'`，不显示夜晚进度指示器
2. 当旧状态缺失 `currentStepId` 时：
   - **Host**：可从 `currentActionerIndex` + `templateRoles` 派生（如需要）
   - **Player UI**：不显示当前步骤名称/音频指示

**读取方容错处理**：
```typescript
// 读取时的安全模式（示例）
const phase = state.currentNightPhase ?? 'Idle';
const stepId = state.currentStepId; // undefined 时 UI 不渲染步骤指示
```

**TODO(remove by 2026-03-01)**：
- 当 legacy 完全移除、v2 成为唯一路径后，评估是否将 `currentNightPhase` / `currentStepId` 改为必填
- 改为必填前需新增合约测试，确保所有 reducer path 都正确设置这些字段

---

## C. Phase2 PR 切片

### PR1: `START_GAME` + `ASSIGN_ROLES`

**目标**：Host 点击开始 → 分配角色 → status 变为 ongoing → 广播

**改动文件**：

| 文件路径 | 改动符号 | 说明 |
|----------|----------|------|
| `src/services/v2/facade/V2GameFacade.ts` | `startGame()` | 新增方法：构造 intent → 调 handler → apply → broadcast |
| `src/services/v2/handlers/gameControlHandler.ts` | `handleStartGame()` | 已有骨架，完善校验逻辑 |
| `src/services/v2/reducer/gameReducer.ts` | `handleStartNight()` | 修改：设置 `currentNightPhase` / `currentStepId` |
| `src/services/protocol/types.ts` | `BroadcastGameState` | 新增 `currentNightPhase?: ...` / `currentStepId?: SchemaId` |
| `src/services/v2/reducer/types.ts` | `StartNightAction` | 新增 `currentNightPhase` / `currentStepId` 到 payload |

**新增/修改 `BroadcastGameState` 字段**：

| 字段 | 类型 | 必须 `?` | 说明 |
|------|------|----------|------|
| `currentNightPhase` | `'Idle' \| 'NightBeginAudio' \| 'RoleBeginAudio' \| 'WaitingForAction' \| 'RoleEndAudio' \| 'NightEndAudio' \| 'Ended'` | ✅ 可选 | 夜晚 phase |
| `currentStepId` | `SchemaId` | ✅ 可选 | 当前步骤 ID（来源于 `NIGHT_STEPS`） |

**PR1 不包含**：
- ❌ `rebuildNightFlow()` 或任何 NightFlowController 重建逻辑
- ❌ 新增 plan builder

**测试门禁**：

| 测试文件 | 测试用例 | 类型 |
|----------|----------|------|
| `src/services/v2/handlers/__tests__/gameControlHandler.test.ts` | `handleStartGame` happy: seated → ongoing | Jest |
| `src/services/v2/handlers/__tests__/gameControlHandler.test.ts` | `handleStartGame` edge: 非 Host → host_only | Jest |
| `src/services/v2/handlers/__tests__/gameControlHandler.test.ts` | `handleStartGame` edge: 非 seated → not_all_seated | Jest |
| `src/services/v2/reducer/__tests__/gameReducer.test.ts` | `START_NIGHT` 设置 `currentNightPhase` = `'NightBeginAudio'` | Jest |
| `src/services/v2/reducer/__tests__/gameReducer.test.ts` | `START_NIGHT` 设置 `currentStepId` = `NIGHT_STEPS[0].id` | Jest |

**回滚策略**：`git revert` 整个 PR

---

### PR2: `VIEWED_ROLE` + `assigned → ready` 状态流转

**目标**：Player 看完牌点确认 → Host 收集 → 全员确认后 status = ready

**改动文件**：

| 文件路径 | 改动符号 | 说明 |
|----------|----------|------|
| `src/services/v2/facade/V2GameFacade.ts` | `viewedRole()` | 新增方法 |
| `src/services/v2/facade/V2GameFacade.ts` | `hostHandlePlayerMessage()` | 新增 case `'VIEWED_ROLE'` |
| `src/services/v2/handlers/actionHandler.ts` | `handleViewedRole()` | 已有骨架，完善 |
| `src/services/v2/reducer/gameReducer.ts` | `handlePlayerViewedRole()` | 已存在 ✅；需增加 assigned→ready 逻辑 |

**新增/修改 `BroadcastGameState` 字段**：无

**PR2 不包含**：
- ❌ `rebuildNightFlow()` 或任何 NightFlowController 重建逻辑

**测试门禁**：

| 测试文件 | 测试用例 | 类型 |
|----------|----------|------|
| `src/services/v2/handlers/__tests__/actionHandler.test.ts` | `handleViewedRole` happy: 标记成功 | Jest |
| `src/services/v2/handlers/__tests__/actionHandler.test.ts` | `handleViewedRole` edge: 非 assigned → 拒绝 | Jest |
| `src/services/v2/handlers/__tests__/actionHandler.test.ts` | `handleViewedRole` edge: 全员 viewed → ready | Jest |

**回滚策略**：`git revert` 整个 PR

---

### PR3: `SUBMIT_ACTION`（非狼人角色）

**目标**：Player 提交夜晚行动 → Host 验证 → resolver 计算 → 广播结果

**改动文件**：

| 文件路径 | 改动符号 | 说明 |
|----------|----------|------|
| `src/services/v2/facade/V2GameFacade.ts` | `submitAction()` | 新增方法 |
| `src/services/v2/facade/V2GameFacade.ts` | `hostHandlePlayerMessage()` | 新增 case `'ACTION'` |
| `src/services/v2/handlers/actionHandler.ts` | `handleSubmitAction()` | 已有骨架，完善 resolver 调用 |
| `src/services/v2/reducer/gameReducer.ts` | `handleAdvanceToNextAction()` | 更新 `currentNightPhase` / `currentStepId` |

**新增/修改 `BroadcastGameState` 字段**：无（PR1 已加）

**测试门禁**：

| 测试文件 | 测试用例 | 类型 |
|----------|----------|------|
| `src/services/v2/handlers/__tests__/actionHandler.test.ts` | `handleSubmitAction` happy: seer 查验 → seerReveal | Jest |
| `src/services/v2/handlers/__tests__/actionHandler.test.ts` | `handleSubmitAction` edge: 非 ongoing → 拒绝 | Jest |
| `src/services/v2/handlers/__tests__/actionHandler.test.ts` | `handleSubmitAction` edge: blockedSeat 命中 → valid no reveal | Jest |

**回滚策略**：`git revert` 整个 PR

---

### PR4: `SUBMIT_WOLF_VOTE` + 狼人刀

**目标**：狼人投票 → 全员投完 → resolve → 记录 wolfKill

**改动文件**：

| 文件路径 | 改动符号 | 说明 |
|----------|----------|------|
| `src/services/v2/facade/V2GameFacade.ts` | `submitWolfVote()` | 新增方法 |
| `src/services/v2/facade/V2GameFacade.ts` | `hostHandlePlayerMessage()` | 新增 case `'WOLF_VOTE'` |
| `src/services/v2/handlers/actionHandler.ts` | `handleSubmitWolfVote()` | 新增 |
| `src/services/v2/reducer/gameReducer.ts` | `handleRecordWolfVote()` | 已存在 ✅ |

**新增/修改 `BroadcastGameState` 字段**：无

**测试门禁**：

| 测试文件 | 测试用例 | 类型 |
|----------|----------|------|
| `src/services/v2/handlers/__tests__/actionHandler.test.ts` | `handleSubmitWolfVote` happy: 3 狼投同一目标 | Jest |
| `src/services/v2/handlers/__tests__/actionHandler.test.ts` | `handleSubmitWolfVote` edge: 狼刀自己 → 允许 | Jest |
| `src/services/v2/handlers/__tests__/actionHandler.test.ts` | `handleSubmitWolfVote` edge: nightmare 封狼 → wolfKillDisabled | Jest |

**回滚策略**：`git revert` 整个 PR

---

### PR5: Night Progression + Audio + `END_NIGHT` + NightFlow 派生（Design Placeholder）

**目标**：步骤推进 → 音频播放 → 所有步骤完成 → 计算死亡 → 结束夜晚

**改动文件**：

| 文件路径 | 改动符号 | 说明 |
|----------|----------|------|
| `src/services/v2/facade/V2GameFacade.ts` | `advanceToNextAction()` | 新增：推进步骤 + 播放音频 |
| `src/services/v2/facade/V2GameFacade.ts` | `endNight()` | 新增：计算死亡 + 广播 |
| `src/services/v2/facade/V2GameFacade.ts` | `playCurrentRoleAudio()` | 新增：根据 `currentStepId` 播放音频 |
| `src/services/v2/reducer/gameReducer.ts` | `handleAdvanceToNextAction()` | 更新 phase/stepId |
| `src/services/v2/reducer/gameReducer.ts` | `handleEndNight()` | 已存在 ✅ |

**NightFlowController 派生重建**（🔁 Deferred to PR5）：
- **Design placeholder**：不承诺实现细节，最终以 `NightFlowController.ts` 现有 API 为准
- 若需要从 `BroadcastGameState` 重建 `NightFlowController`，实现时必须：
  - 使用 `NightFlowController` 现有构造函数 + 公开 API
  - 不新增 `restoreFromState()` 等伪 API
  - 不新增平行 plan builder
- 具体实现方案在 PR5 编码阶段确定

**新增/修改 `BroadcastGameState` 字段**：无（PR1 已加）

**测试门禁**：

| 测试文件 | 测试用例 | 类型 |
|----------|----------|------|
| `src/services/v2/facade/__tests__/V2GameFacade.nightFlow.test.ts` | 完整 Night-1 流程 | Jest |
| `e2e/night1.basic.spec.ts` | 创建 → 入座 → 开始 → 提交 action → STATE_UPDATE | Playwright (workers=1) |

**回滚策略**：`git revert` 整个 PR

---

## D. 关键不变量（Invariants）

| # | 不变量 | 检查方式 |
|---|--------|----------|
| 1 | `BroadcastGameState` 是唯一权威状态源 | 无 hostOnly 字段；见附录对照表 |
| 2 | Host `status === 'ongoing'` 时 `currentNightPhase` / `currentStepId` / `currentActionerIndex` 完整 | Reducer 测试 |
| 3 | Resolver 是唯一验证+计算逻辑源；Handler 不做二次计算 | Code review + 单测 |
| 4 | `currentNightResults` 是步骤间传递的单一真相 | 每个 action 后检查 merge |
| 5 | Nightmare block: `blockedSeat === actorSeat` → valid but no-effect | Resolver 单测 |
| 6 | Wolf vote 不加 notSelf/notWolf 限制（neutral judge） | Resolver 单测 |
| 7 | Player 端禁止运行 resolver/reducer/death calculation | Import boundary test |
| 8 | v2 禁止运行时 import legacy | ESLint rule + import test |
| 9 | 迁移期新增字段必须 `?` 可选 | TypeScript 编译 |
| 10 | Night-1 only：禁止 `previousNight` / `lastNightTarget` | 合约测试 grep |
| 11 | `currentStepId` 来源于 `NIGHT_STEPS`，禁止新增平行步骤表 | Code review |

---

## E. 测试门禁汇总

### E1. Jest 单测/合约测试

| 测试文件 | 覆盖内容 | 最低要求 |
|----------|----------|----------|
| `gameControlHandler.test.ts` | `handleStartGame` | 1 happy + 2 edge |
| `actionHandler.test.ts` | `handleSubmitAction` / `handleSubmitWolfVote` / `handleViewedRole` | 各 1 happy + 2 edge |
| `gameReducer.test.ts` | `START_NIGHT` 设置 phase/stepId | 2 用例 |
| `NIGHT_STEPS.contract.test.ts` | 步骤引用有效 / 顺序 snapshot / 唯一性 / audioKey 非空 | 现有测试保持绿色 |
| `resolver/*.test.ts` | 每个 resolver 含 blockedSeat 场景 | 现有 + 新增 |
| `import-boundary.test.ts` | v2 不 import legacy（运行时） | 现有测试保持绿色 |

### E2. Playwright E2E（smoke）

| 测试 | 覆盖路径 | 配置 |
|------|----------|------|
| `night1.basic.spec.ts` | 创建房间 → 入座 → 开始 → 进入夜晚 → 提交 1 个 action → 收到 STATE_UPDATE | `workers=1` |

---

## F. 不做什么（明确排除）

| 排除项 | 原因 |
|--------|------|
| 跨夜状态（previousNight / nightNumber > 1） | Night-1 only 红线 |
| 持久化到 Supabase DB | Host 内存即权威 |
| 私聊/私有消息 | 已移除 PRIVATE_EFFECT |
| 发明新协议（非 HostBroadcast/PlayerMessage） | 单一协议源红线 |
| runtime feature flag（useV2Night 等） | 禁止；模式选择在 composition root 一次性完成 |
| v2 runtime import legacy | 禁止；回滚只能 git revert |
| 把 NightFlowController / DeathCalculator / resolvers 移到 legacy/ | 纯模块禁止移入 legacy |
| NightFlowController 持有权威状态 | 只能是可由 `BroadcastGameState` 重建的派生状态机 |
| 新增平行 plan builder / 步骤表 | `NIGHT_STEPS` 是单一真相 |

---

## G. 回滚策略

**唯一回滚方式：`git revert` 整个 PR**

- 不允许 v2 内部条件调用 legacy
- 不允许 runtime feature flag
- 不允许 V2GameFacade 构造参数控制模式
- 模式选择只能在应用启动时通过 Provider 一次性注入（`GameRoomProvider` / DI container）

---

## 附录：状态字段 → 派生 UI 显示对照表

证明没有 hostOnly state，所有 UI 显示都可从 `BroadcastGameState` 派生：

| `BroadcastGameState` 字段 | UI 显示 | 可见条件（UI 层过滤） |
|---------------------------|---------|----------------------|
| `status` | 房间状态标签、按钮可用性 | 所有玩家 |
| `players` | 玩家列表、座位状态 | 所有玩家 |
| `players[seat].role` | 角色图标 | `seat === mySeat` 或 特定角色互看规则 |
| `players[seat].hasViewedRole` | "未看牌"标记 | Host 可见全部；Player 只见自己 |
| `currentActionerIndex` | 当前行动角色高亮 | 所有玩家 |
| `currentNightPhase` | 夜晚阶段指示器 | 所有玩家（缺失时视为 `'Idle'`） |
| `currentStepId` | 当前步骤名称、音频指示 | 所有玩家（缺失时不显示） |
| `isAudioPlaying` | 音频播放指示器、按钮禁用 | 所有玩家 |
| `wolfVoteStatus` | 狼人投票进度 | `isWolfRole(myRole)` |
| `wolfVotes` | 狼人投票详情 | `isWolfRole(myRole)` |
| `actions` | 行动记录（调试用） | 所有玩家（生产环境可隐藏） |
| `currentNightResults` | 累积结果（调试用） | 所有玩家（生产环境可隐藏） |
| `pendingRevealAcks` | 等待确认指示 | 所有玩家 |
| `lastNightDeaths` | 死亡公告 | 所有玩家 |
| `nightmareBlockedSeat` | 被封锁玩家标记 | 所有玩家（UI 可选是否显示） |
| `wolfKillDisabled` | 狼刀失效指示 | `isWolfRole(myRole)` |
| `witchContext` | 女巫面板（被刀者、毒药/解药状态） | `myRole === 'witch'` |
| `seerReveal` | 预言家查验结果弹窗 | `myRole === 'seer'` |
| `psychicReveal` | 通灵师查验结果弹窗 | `myRole === 'psychic'` |
| `gargoyleReveal` | 石像鬼查验结果弹窗 | `myRole === 'gargoyle'` |
| `wolfRobotReveal` | 机械狼查验结果弹窗 | `myRole === 'wolfRobot'` |
| `confirmStatus` | 猎人/狼王确认弹窗 | `myRole === confirmStatus.role` |
| `actionRejected` | 行动被拒绝 toast | `myUid === actionRejected.targetUid` |

**结论**：所有 UI 显示都可从 `BroadcastGameState` 单一状态源派生，无 hostOnly state。

---

**方案状态**：v1.2 待评审

请逐条审核红线与设计，通过后我将按 PR 顺序开始编码。
