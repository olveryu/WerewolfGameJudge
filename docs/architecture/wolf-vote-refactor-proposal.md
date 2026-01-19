# 狼人投票系统重构方案

> 日期：2026-01-19  
> 分支：refactor/remove-private-effect  
> 状态：✅ 已完成

---

## 1. 问题分析

### 1.1 当前架构的问题

| 问题                        | 说明                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------- |
| **双重定义冗余**            | `ROLE_SPECS.wolfMeeting` (角色固有属性) 和 `NIGHT_STEPS.visibility` (步骤属性) 有重叠 |
| **`actsSolo` 冗余**         | 大部分情况可通过 `wolfMeeting.canSeeWolves` 推导，不需要独立字段                      |
| **`wolfMeetingPhase` 孤立** | 只有 `wolfKill` 和 `wolfQueenCharm` 两个步骤用到，语义不明确                          |
| **投票逻辑分散**            | 投票相关代码分布在 `GameStateService`、`useRoomActions`、`RoomScreen.helpers` 多处    |
| **不符合 Schema-Driven**    | `wolfVote` schema 没有完整描述投票语义，参与者逻辑在 `ROLE_SPECS` 里                  |

### 1.2 当前字段关系

```
ROLE_SPECS[role].wolfMeeting (角色固有属性)
├── canSeeWolves: boolean        → UI 高亮哪些座位是狼队友
└── participatesInWolfVote: boolean → getVotingWolfSeats() 确定谁需要投票

NIGHT_STEPS[step].visibility (步骤属性 - HOST-SIDE ONLY)
├── actsSolo: boolean            → 这个步骤是否独立行动（不能看队友）
└── wolfMeetingPhase?: boolean   → 这个步骤是否是狼刀投票阶段
```

**问题**：`actsSolo` 的逻辑可以从 `wolfMeeting` 推导：

- 如果 `canSeeWolves = false` → 自然不显示队友
- 如果 `canSeeWolves = true` 但在非 `wolfMeetingPhase` 步骤 → 也不显示

### 1.3 目标

1. **消除 `visibility` 字段** - 从 `NIGHT_STEPS` 中移除
2. **消除 `actsSolo` 字段** - 从 `NightPlanStep` 中移除
3. **统一到 Schema-Driven** - 投票行为完全由 schema 描述
4. **简化 UI 逻辑** - 从 schema 直接推导 UI 行为

---

## 2. 新架构设计

### 2.1 核心原则

```
ROLE_SPECS (角色属性)
    ↓
SCHEMAS (行动输入协议)    ← 单一真相
    ↓
NIGHT_STEPS (步骤序列)    ← 只管顺序和音频
    ↓
GameStateService (Host 执行)
    ↓
UI (从 schema 推导显示)
```

### 2.2 Schema 扩展：添加 `meeting` 配置

在 `schema.types.ts` 中新增：

```typescript
/** 会议配置 - 描述多人协作行动 */
export interface MeetingConfig {
  /**
   * 参与者选择器
   * - 'wolfVoters': 参与狼刀投票的狼人 (wolfMeeting.participatesInWolfVote=true)
   * - 可扩展其他类型（如未来的白天公投）
   */
  readonly participants: 'wolfVoters';

  /** 参与者是否能看到彼此 */
  readonly canSeeEachOther: boolean;

  /** 投票解析规则 */
  readonly resolution: 'majority' | 'unanimous' | 'first';

  /** 允许空投票 */
  readonly allowEmptyVote: boolean;
}

/** Wolf vote schema - 多人协作投票 */
export interface WolfVoteSchema extends BaseActionSchema {
  readonly kind: 'wolfVote';
  readonly constraints: readonly TargetConstraint[];
  readonly meeting: MeetingConfig; // ← 新增
}
```

### 2.3 更新后的 SCHEMAS

```typescript
// schemas.ts

export const SCHEMAS = {
  // ...其他 schema 不变...

  wolfKill: {
    id: 'wolfKill',
    displayName: '狼刀',
    kind: 'wolfVote',
    constraints: [], // Neutral judge: 狼人可刀任意目标
    meeting: {
      participants: 'wolfVoters',   // 参会狼投票
      canSeeEachOther: true,        // 参会狼互知
      resolution: 'majority',       // 多数票决定
      allowEmptyVote: true,         // 允许空刀
    },
    ui: {
      prompt: '请选择要猎杀的玩家',
      confirmText: '确定要猎杀该玩家吗？',
      emptyVoteText: '空刀',
    },
  },

  // 梦魇恐惧 - 普通 chooseSeat，不需要 meeting
  nightmareBlock: {
    id: 'nightmareBlock',
    displayName: '恐惧',
    kind: 'chooseSeat',
    constraints: [],
    canSkip: true,
    // 无 meeting 配置 - 单人行动
    ui: { ... },
  },
} as const;
```

### 2.4 简化后的 NIGHT_STEPS

**移除 `visibility` 字段，只保留必要信息：**

```typescript
// nightSteps.types.ts

export interface StepSpec {
  /** 步骤 ID（同时作为 schemaId） */
  readonly id: SchemaId;
  /** 执行此步骤的角色 */
  readonly roleId: RoleId;
  /** 开始音频文件名 */
  readonly audioKey: string;
  /** 结束音频文件名（可选） */
  readonly audioEndKey?: string;
  // ❌ 移除: visibility: StepVisibility
}
```

```typescript
// nightSteps.ts

const NIGHT_STEPS_INTERNAL = [
  { id: 'magicianSwap', roleId: 'magician', audioKey: 'magician' },
  { id: 'slackerChooseIdol', roleId: 'slacker', audioKey: 'slacker' },
  { id: 'wolfRobotLearn', roleId: 'wolfRobot', audioKey: 'wolf_robot' },
  { id: 'dreamcatcherDream', roleId: 'dreamcatcher', audioKey: 'dreamcatcher' },
  { id: 'gargoyleCheck', roleId: 'gargoyle', audioKey: 'gargoyle' },
  { id: 'nightmareBlock', roleId: 'nightmare', audioKey: 'nightmare' },
  { id: 'guardProtect', roleId: 'guard', audioKey: 'guard' },
  { id: 'wolfKill', roleId: 'wolf', audioKey: 'wolf' },
  { id: 'wolfQueenCharm', roleId: 'wolfQueen', audioKey: 'wolf_queen' },
  { id: 'witchAction', roleId: 'witch', audioKey: 'witch' },
  { id: 'seerCheck', roleId: 'seer', audioKey: 'seer' },
  { id: 'psychicCheck', roleId: 'psychic', audioKey: 'psychic' },
  { id: 'hunterConfirm', roleId: 'hunter', audioKey: 'hunter' },
  { id: 'darkWolfKingConfirm', roleId: 'darkWolfKing', audioKey: 'dark_wolf_king' },
] as const;
```

### 2.5 简化后的 NightPlanStep

```typescript
// plan.types.ts

export interface NightPlanStep {
  readonly roleId: RoleId;
  readonly stepId: SchemaId; // 同时是 schemaId
  readonly order: number;
  readonly displayName: string;
  readonly audioKey: string;
  // ❌ 移除: actsSolo: boolean
}
```

### 2.6 UI 推导逻辑重写

**`RoomScreen.helpers.ts` 重构核心逻辑：**

```typescript
import { getSchema, type SchemaId } from '../../../models/roles/spec/schemas';
import { doesRoleParticipateInWolfVote } from '../../../models/roles';

/**
 * 从 schema 推导 actioner 状态
 *
 * 核心逻辑：
 * 1. 获取当前步骤的 schema
 * 2. 如果是 wolfVote，用 meeting.canSeeEachOther 决定 showWolves
 * 3. 其他情况 showWolves = false
 */
export function getActionerState(
  myRole: RoleId | null,
  mySeatNumber: number | null,
  currentStepId: SchemaId | null,
  wolfVotes: Map<number, number>,
  actions: Map<RoleId, RoleAction>,
): ActionerState {
  if (!currentStepId || !myRole) {
    return { imActioner: false, showWolves: false };
  }

  const schema = getSchema(currentStepId);
  const step = getStepSpec(currentStepId);
  if (!schema || !step) {
    return { imActioner: false, showWolves: false };
  }

  // 根据 schema.kind 决定行为
  if (schema.kind === 'wolfVote') {
    return handleWolfVoteSchema(schema, myRole, mySeatNumber, wolfVotes);
  }

  // 其他 schema: 检查是否是当前行动角色
  if (myRole === step.roleId) {
    const hasActed = actions.has(myRole);
    return { imActioner: !hasActed, showWolves: false };
  }

  return { imActioner: false, showWolves: false };
}

function handleWolfVoteSchema(
  schema: WolfVoteSchema,
  myRole: RoleId,
  mySeatNumber: number | null,
  wolfVotes: Map<number, number>,
): ActionerState {
  // 检查是否是参会狼（从 ROLE_SPECS 读取）
  if (!doesRoleParticipateInWolfVote(myRole)) {
    return { imActioner: false, showWolves: false };
  }

  // 检查是否已投票
  const hasVoted = mySeatNumber !== null && wolfVotes.has(mySeatNumber);

  // 从 schema.meeting 读取 canSeeEachOther
  const showWolves = schema.meeting.canSeeEachOther;

  return { imActioner: !hasVoted, showWolves };
}
```

### 2.7 ROLE_SPECS.wolfMeeting 保留不变

`wolfMeeting` 仍然保留在 `ROLE_SPECS` 中，因为它是**角色固有属性**：

```typescript
// spec.types.ts - 不变

export interface WolfMeetingConfig {
  /** 是否能看到其他狼（用于高亮列表过滤） */
  readonly canSeeWolves: boolean;
  /** 是否参与狼刀投票 */
  readonly participatesInWolfVote: boolean;
}
```

**语义明确：**

- `canSeeWolves`: 用于 UI 高亮哪些座位是狼队友（过滤 gargoyle/wolfRobot）
- `participatesInWolfVote`: 用于 `getVotingWolfSeats()` 确定谁需要投票

---

## 3. 实现步骤

### Phase 1: Schema 扩展

1. 在 `schema.types.ts` 添加 `MeetingConfig` 接口
2. 更新 `WolfVoteSchema` 添加 `meeting` 字段
3. 更新 `schemas.ts` 中的 `wolfKill` schema

### Phase 2: 移除 visibility

1. 从 `nightSteps.types.ts` 移除 `StepVisibility` 接口
2. 从 `NIGHT_STEPS` 每个步骤移除 `visibility` 字段
3. 从 `plan.ts` 移除 `actsSolo` 映射
4. 从 `NightPlanStep` 移除 `actsSolo` 字段

### Phase 3: 重构 UI 逻辑

1. 重写 `RoomScreen.helpers.ts` 中的 `getActionerState`
2. 使用 schema 推导 `showWolves`，不再依赖 `visibility`
3. 更新 `useRoomActions.ts` 相关逻辑

### Phase 4: 清理和测试

1. 删除所有 `actsSolo` 相关测试
2. 更新 contract tests
3. 运行全量测试确保无回归

---

## 4. 文件变更清单

| 文件                                                          | 变更类型 | 说明                                        |
| ------------------------------------------------------------- | -------- | ------------------------------------------- |
| `src/models/roles/spec/schema.types.ts`                       | 修改     | 添加 `MeetingConfig`，更新 `WolfVoteSchema` |
| `src/models/roles/spec/schemas.ts`                            | 修改     | 更新 `wolfKill` schema 添加 `meeting`       |
| `src/models/roles/spec/nightSteps.types.ts`                   | 修改     | 移除 `StepVisibility` 接口                  |
| `src/models/roles/spec/nightSteps.ts`                         | 修改     | 移除所有 `visibility` 字段                  |
| `src/models/roles/spec/plan.ts`                               | 修改     | 移除 `actsSolo` 映射                        |
| `src/models/roles/spec/plan.types.ts`                         | 修改     | 移除 `actsSolo` 字段                        |
| `src/screens/RoomScreen/RoomScreen.helpers.ts`                | 重写     | 重写 `getActionerState`，从 schema 推导     |
| `src/screens/RoomScreen/hooks/useRoomActions.ts`              | 修改     | 更新投票逻辑                                |
| `src/services/__tests__/NightFlowController.test.ts`          | 修改     | 移除 `actsSolo` mock                        |
| `src/screens/RoomScreen/__tests__/RoomScreen.helpers.test.ts` | 重写     | 更新测试用例                                |

---

## 5. 扩展性

### 5.1 添加新狼人角色

只需在 `ROLE_SPECS` 中定义 `wolfMeeting`：

```typescript
newWolf: {
  id: 'newWolf',
  team: 'wolf',
  wolfMeeting: {
    canSeeWolves: true,  // 或 false（独狼如石像鬼）
    participatesInWolfVote: true,  // 或 false（不参刀如机械狼）
  },
  // ...
}
```

**无需修改**：

- `NIGHT_STEPS`（除非有独立夜间技能需要添加步骤）
- `SCHEMAS`（复用现有 `wolfKill` schema）
- UI 逻辑（自动从 `wolfMeeting` 和 `schema.meeting` 推导）

### 5.2 添加新投票类型

如果未来需要其他投票（如白天公投），只需：

1. 在 `MeetingConfig.participants` 添加新选择器（如 `'allPlayers'`）
2. 创建新 schema（如 `dayVote`）
3. 在 UI 层添加对应处理

---

## 6. 数据流图

```
┌─────────────────────────────────────────────────────────────────┐
│                        ROLE_SPECS                                │
│  wolfMeeting: { canSeeWolves, participatesInWolfVote }          │
│  （角色固有属性 - 决定谁参与、谁能看到谁）                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         SCHEMAS                                  │
│  wolfKill: {                                                     │
│    kind: 'wolfVote',                                            │
│    meeting: { participants: 'wolfVoters', canSeeEachOther: true }│
│  }                                                               │
│  （行动协议 - 描述这个行动如何执行）                                │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   NIGHT_STEPS   │  │ GameStateService│  │   UI Layer      │
│ (顺序 + 音频)    │  │ (Host 执行验证)  │  │ (getActionerState)│
│  无 visibility  │  │                 │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
                              │                   │
                              │                   ▼
                              │          getSchema(stepId)
                              │                   │
                              │                   ▼
                              │          schema.meeting.canSeeEachOther
                              │                   │
                              ▼                   ▼
                    ┌───────────────────────────────────┐
                    │         BroadcastGameState        │
                    │  wolfVoteStatus, wolfKillDisabled │
                    └───────────────────────────────────┘
```

---

## 7. 讨论点（已决策）

### 7.1 是否保留 `wolfMeeting.canSeeWolves`？

**决策**：✅ 保留在 `ROLE_SPECS.wolfMeeting`

**理由**：

- 这是**角色固有属性**：某个狼人角色是否能看到其他狼队友
- 与投票协议无关，用于 UI 高亮过滤
- 例如：石像鬼/机械狼 `canSeeWolves=false`，在狼刀阶段也不会被高亮
- 未来可能有"狼人知道某角色"但该角色不参与投票的情况

### 7.2 `wolfQueenCharm` 是否也是 meeting phase？

**决策**：❌ 不是 meeting phase，是单独行动

**当前错误**：`visibility: { actsSolo: false, wolfMeetingPhase: true }` 标记错误

**正确理解**：

- 狼美人魅惑是**个人技能**，选一个人魅惑
- 她能看到狼队友是因为 `canSeeWolves: true`（角色属性），不是步骤属性
- 魅惑行动本身不需要其他狼参与

**重构后**：

- `wolfQueenCharm` 是 `chooseSeat` schema，不是 `wolfVote`
- UI 不会显示狼队友（除非我们另外处理"这个角色能看到狼"的情况）

**注意**：重构后狼美人在魅惑阶段**不会**看到狼队友高亮。这是正确的行为，因为魅惑是个人行动。如果需要在非 `wolfVote` 步骤也显示狼队友，需要另外设计（但目前不需要）。

### 7.3 梦魇封锁狼人的特殊规则

**决策**：✅ 简化 `wolfKillDisabled` 逻辑，移除双重计算

**当前问题**：`wolfKillDisabled` 在两个地方被计算

1. `nightmareBlockResolver` 返回 `updates: { wolfKillDisabled: true }`
2. `toBroadcastState()` 再次从 `nightmareAction` 推导 `wolfKillDisabled`

这是**双重计算**，违反单一真相原则。

**简化方案**：

```typescript
// 1. nightmareBlockResolver 返回 updates（不变）
return {
  valid: true,
  updates: {
    blockedSeat: target,
    wolfKillDisabled: blockedWolf ? true : undefined,
  },
};

// 2. GameStateService.handlePlayerAction 应用 updates 到 state
if (result.updates?.wolfKillDisabled !== undefined) {
  this.state.wolfKillDisabled = result.updates.wolfKillDisabled;
}

// 3. toBroadcastState 直接读取，不再重新计算
return {
  ...
  wolfKillDisabled: this.state.wolfKillDisabled,  // ← 直接读取
  ...
};
```

**好处**：

- 单一真相：只在 `nightmareBlockResolver` 计算一次
- 代码更简洁：`toBroadcastState()` 不需要重复判断逻辑
- 一致性：和其他 resolver updates 处理方式一致

---

## 8. 设计决策记录

### 8.1 免疫狼刀的处理方式

**决策**：保持在 `ROLE_SPECS.flags.immuneToWolfKill`

**理由**：

- `immuneToWolfKill` 是**角色固有属性**，不是投票协议的一部分
- 符合 "Neutral Judge" 原则：投票协议本身是中性的，限制来自角色
- 单一真相：免疫规则只在 `ROLE_SPECS.flags` 定义一次

**受影响角色**：

- `wolfQueen` (狼美人) - 免疫狼刀
- `spiritKnight` (恶灵骑士) - 免疫狼刀

**数据流**：

```
ROLE_SPECS.flags.immuneToWolfKill = true
          │
          ▼
getWolfKillImmuneRoleIds() → ['wolfQueen', 'spiritKnight']
          │
    ┌─────┴─────┐
    ▼           ▼
Host 验证     UI 禁用
```

---

## 9. Commit 计划

### Commit 1: Schema 扩展 - 添加 MeetingConfig

**范围**：纯类型/数据层修改，不影响运行时行为

**文件变更**：

- `src/models/roles/spec/schema.types.ts` - 添加 `MeetingConfig` 接口，更新 `WolfVoteSchema`
- `src/models/roles/spec/schemas.ts` - 更新 `wolfKill` schema 添加 `meeting` 字段

**验证**：`npm run typecheck` 通过

```
feat(schema): 添加 MeetingConfig 支持多人协作投票

- 新增 MeetingConfig 接口：participants, canSeeEachOther, resolution, allowEmptyVote
- 更新 WolfVoteSchema 添加 meeting 字段
- 更新 wolfKill schema 使用新的 meeting 配置
```

---

### Commit 2: 移除 visibility 字段

**范围**：移除 `NIGHT_STEPS.visibility` 和 `NightPlanStep.actsSolo`

**包含决策 7.2 修正**：`wolfQueenCharm` 移除错误的 `wolfMeetingPhase: true` 标记

**文件变更**：

- `src/models/roles/spec/nightSteps.types.ts` - 移除 `StepVisibility` 接口
- `src/models/roles/spec/nightSteps.ts` - 移除所有 `visibility` 字段（包括 `wolfQueenCharm` 的错误标记）
- `src/models/roles/spec/plan.ts` - 移除 `actsSolo` 映射
- `src/models/roles/spec/plan.types.ts` - 移除 `actsSolo` 字段

**验证**：`npm run typecheck` 通过（此时会有编译错误，需要 Commit 3 修复）

```
refactor(nightSteps): 移除 visibility 和 actsSolo 字段

BREAKING CHANGE: 移除 StepSpec.visibility 和 NightPlanStep.actsSolo
- NIGHT_STEPS 只保留 id, roleId, audioKey, audioEndKey
- wolfQueenCharm 不再标记 wolfMeetingPhase（是个人行动，不是会议）
- UI 层需要从 schema.meeting 推导 showWolves
```

---

### Commit 3: 重构 UI 逻辑

**范围**：重写 `getActionerState`，从 schema 推导 UI 行为

**文件变更**：

- `src/screens/RoomScreen/RoomScreen.helpers.ts` - 重写 `getActionerState`，移除 visibility 依赖
- `src/screens/RoomScreen/hooks/useRoomActions.ts` - 更新相关逻辑（如有需要）

**验证**：`npm run typecheck` 通过

```
refactor(RoomScreen): 从 schema.meeting 推导 showWolves

- 重写 getActionerState，不再依赖 visibility.actsSolo
- wolfVote 类型从 schema.meeting.canSeeEachOther 决定 showWolves
- 其他 schema 类型 showWolves = false
- 狼美人魅惑阶段不再显示狼队友（正确行为）
```

---

### Commit 4: 简化 wolfKillDisabled 逻辑

**范围**：移除 `toBroadcastState()` 中的双重计算（决策 7.3）

**文件变更**：

- `src/services/GameStateService.ts`:
  - `handlePlayerAction()` 应用 resolver 返回的 `updates.wolfKillDisabled` 到 `this.state`
  - `toBroadcastState()` 直接读取 `this.state.wolfKillDisabled`，移除重新推导逻辑

**验证**：`npm run typecheck` 通过，手动验证梦魇封锁狼人后狼刀被禁用

```
refactor(GameStateService): 简化 wolfKillDisabled 单一真相

- resolver 计算 wolfKillDisabled → 存入 state → 直接广播
- 移除 toBroadcastState() 中的重复推导逻辑
- 符合 resolver updates → state → broadcast 的统一模式
```

---

### Commit 5: 更新测试

**范围**：修复所有因移除 `actsSolo` 和简化 `wolfKillDisabled` 导致的测试失败

**文件变更**：

- `src/services/__tests__/NightFlowController.test.ts` - 移除 `actsSolo` mock
- `src/screens/RoomScreen/__tests__/RoomScreen.helpers.test.ts` - 重写测试用例
- `src/services/__tests__/GameStateService.*.test.ts` - 更新 `wolfKillDisabled` 相关测试
- 其他受影响的测试文件

**验证**：`npm test` 全部通过

```
test: 更新测试适配 visibility 移除和 wolfKillDisabled 简化

- 移除 NightFlowController 测试中的 actsSolo mock
- 重写 RoomScreen.helpers 测试，验证 schema-driven 逻辑
- 更新 wolfKillDisabled 测试验证单一真相模式
- 所有 1113+ 测试通过
```

---

### Commit 6: 清理和文档

**范围**：清理遗留代码，更新文档

**文件变更**：

- 移除任何遗留的 `actsSolo` / `visibility` / `wolfMeetingPhase` 引用
- 更新 `copilot-instructions.md`（如需要）
- 更新本方案文档状态为"已完成"

**验证**：`npm run lint:fix && npm run format:write && npm test`

```
chore: 清理 wolf-vote 重构遗留代码

- 移除所有 actsSolo / visibility / wolfMeetingPhase 遗留引用
- 更新架构文档标记重构完成
```

---

## 10. 执行检查清单

- [x] Commit 1: Schema 扩展 (`e5abc01`)
  - [x] `npm run typecheck` 通过
  - [x] `npm test` 通过（行为无变化）
- [x] Commit 2: 移除 visibility + 重构 UI 逻辑 (`503bafe`)
  - [x] 移除 `visibility` 和 `actsSolo` 字段
  - [x] 重写 `determineActionerState()` 使用 schema-driven
  - [x] `npm run typecheck` 通过
  - [x] `npm test` 通过
- [x] Commit 3: (已合并到 Commit 2)
- [x] Commit 4: 简化 wolfKillDisabled (`279e81c`)
  - [x] `handlePlayerAction` 直接设置 `state.wolfKillDisabled`
  - [x] `toBroadcastState` 直接读取，移除双重计算
  - [x] `npm test` 全部通过
- [x] Commit 5: (测试更新已合并到 Commit 2)
- [x] Commit 6: 文档更新
  - [x] `npm run lint:fix` 无错误
  - [x] `npm run format:write` 完成

---

## 11. 回滚计划

如果重构出现问题，可以通过以下方式回滚：

```bash
git revert HEAD~5..HEAD  # 回滚最近 5 个 commit
# 或者
git reset --hard <commit-before-refactor>
```

建议在开始前创建备份分支：

```bash
git branch backup/before-wolf-vote-refactor
```
