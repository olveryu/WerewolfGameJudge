# 新增 Night-1 行动角色（完整实现清单）

> 本 prompt 是新增角色的 12 步完整实现清单。
> 执行前必须先问清角色设定，执行后必须跑验证。

---

## 前置确认（执行前必须问用户）

1. **角色名称**（中文 displayName + 英文 id，例如 `守墓人 / graveyardKeeper`）
2. **阵营**（`Faction.God` / `Faction.Wolf` / `Faction.Villager` / `Faction.ThirdParty`
   ）
3. **team**（`'good'` / `'evil'` / `'neutral'`）
4. **Night-1 是否有行动**（`hasAction: true/false`）
5. **行动类型**
   - `chooseSeat`（选一个座位，如预言家查验）
   - `confirmTarget`（确认固定目标，如女巫救人）
   - `compound`（多子步骤，如女巫 save+poison）
   - `confirm`（无选择，仅确认身份，如猎人确认）
   - `wolfVote`（狼人会议投票）
   - `chooseSeatPair`（选一对座位，如魔术师交换）
6. **约束**（`notSelf` / `notWolf` / 无约束等）
7. **是否需要 reveal**（如预言家需要查验结果展示）
8. **是否有 meeting**（如狼人可互看，`canSeeEachOther: true`）
9. **在 `NIGHT_STEPS` 中的位置**（在哪个角色之后执行）
10. **音频文件名**（通常与 roleId 一致）

---

## Step 1: ROLE_SPECS — 角色固有属性

**文件**: `src/models/roles/spec/specs.ts`

在对应阵营区块添加：

```typescript
newRole: {
  id: 'newRole',
  displayName: '新角色',
  faction: Faction.God, // 根据确认结果
  team: 'good',
  description: '角色描述文字',
  night1: { hasAction: true },
} satisfies RoleSpec,
```

**狼阵营特殊字段**（如需）：

```typescript
wolfMeeting: {
  canSeeWolves: true,  // 在狼人会议阶段看到狼队友高亮
},
```

**检查项**:

- [ ] `id` 与对象 key 一致
- [ ] `team` 与 `faction` 匹配（God/Villager→good, Wolf→evil, ThirdParty→neutral）
- [ ] `RoleId` 类型自动推导（`keyof typeof ROLE_SPECS`），无需手动添加

---

## Step 2: SCHEMAS — 行动输入协议

**文件**: `src/models/roles/spec/schemas.ts`

```typescript
newRoleAction: {
  id: 'newRoleAction',
  displayName: '行动名称',
  kind: 'chooseSeat', // 根据确认结果
  constraints: [],     // 根据确认结果
  canSkip: true,
  ui: {
    confirmTitle: '确认行动',
    prompt: '请选择目标玩家',
    confirmText: '确定要对该玩家使用技能吗？',
    revealKind: 'newRole', // 仅 reveal 类需要
    bottomActionText: '不使用技能',
  },
} satisfies ActionSchema,
```

**compound 类型示例**（参考 witchAction）：

```typescript
newRoleAction: {
  id: 'newRoleAction',
  displayName: '行动名称',
  kind: 'compound',
  ui: { prompt: '请行动' },
  steps: [
    { key: 'sub1', displayName: '子步骤1', kind: 'confirmTarget', constraints: [], canSkip: true, ui: { ... } },
    { key: 'sub2', displayName: '子步骤2', kind: 'chooseSeat', constraints: [], canSkip: true, ui: { ... } },
  ],
} satisfies CompoundSchema,
```

**检查项**:

- [ ] `id` 与对象 key 一致
- [ ] constraints 完整（`notSelf` 等），schema-first 原则
- [ ] `SchemaId` 类型自动推导（`keyof typeof SCHEMAS`），无需手动添加
- [ ] 如有 reveal，`ui.revealKind` 已设置

---

## Step 3: NIGHT_STEPS — 夜晚步骤顺序

**文件**: `src/models/roles/spec/nightSteps.ts`

在 `NIGHT_STEPS_INTERNAL` 数组的正确位置插入：

```typescript
{
  id: 'newRoleAction',     // 必须等于 SchemaId
  roleId: 'newRole',       // 必须等于 RoleId
  audioKey: 'newRole',     // 通常等于 roleId
},
```

**检查项**:

- [ ] `id` 是有效的 `SchemaId`（与 SCHEMAS 中的 key 一致）
- [ ] `roleId` 是有效的 `RoleId`（与 ROLE_SPECS 中的 key 一致）
- [ ] `audioKey` 非空
- [ ] 数组位置正确（按设计文档顺序）

---

## Step 4: Resolver — 行动验证与计算

**文件**: `src/services/night/resolvers/newRole.ts`（新建）

```typescript
/**
 * NewRole Resolver (HOST-ONLY)
 *
 * Validates action and computes result.
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 */

import { SCHEMAS } from '../../../models/roles/spec/schemas';
import { validateConstraints } from './constraintValidator';
import type { ResolverFn } from './types';

export const newRoleActionResolver: ResolverFn = (context, input) => {
  const { actorSeat, players } = context;
  const target = input.target;

  // Schema allows skip → treat null/undefined as skip
  if (target === undefined || target === null) {
    return { valid: true, result: {} };
  }

  // Validate constraints from schema
  const schema = SCHEMAS.newRoleAction;
  const constraintResult = validateConstraints(schema.constraints, { actorSeat, target });
  if (!constraintResult.valid) {
    return { valid: false, rejectReason: constraintResult.rejectReason };
  }

  // Target must exist
  const roleId = players.get(target);
  if (!roleId) {
    return { valid: false, rejectReason: '目标玩家不存在' };
  }

  // Compute result
  return {
    valid: true,
    result: {
      // ... 角色特定的结果
    },
    updates: {
      // ... 写入 currentNightResults 的累积数据（如需）
    },
  };
};
```

**检查项**:

- [ ] 纯函数，无副作用，无 IO
- [ ] Nightmare 阻断已由 actionHandler 层统一处理，resolver 无需重复检查
- [ ] 校验与 `SCHEMAS[*].constraints` 完全一致
- [ ] 函数签名：`ResolverFn = (context: ResolverContext, input: ActionInput) => ResolverResult`

---

## Step 5: Resolver Registry — 注册

**文件**: `src/services/night/resolvers/index.ts`

```typescript
import { newRoleActionResolver } from './newRole';

export const RESOLVERS: ResolverRegistry = {
  // ... 已有 resolvers
  newRoleAction: newRoleActionResolver,
};
```

**检查项**:

- [ ] key 是 `SchemaId`
- [ ] import 路径正确

---

## Step 6: BroadcastGameState + normalizeState（如需 reveal / context）

### 6a. 类型定义

**文件**: `src/services/engine/protocol/types.ts`（或对应的 state 类型文件）

添加 reveal 字段到 `BroadcastGameState` 类型：

```typescript
newRoleReveal?: {
  targetSeat: number;
  result: string; // 或具体类型
};
```

### 6b. normalizeState 同步（⚠️ 高频 bug 源）

**文件**: `src/services/engine/state/normalize.ts`

在 `normalizeState` 返回值中添加新字段：

```typescript
return {
  // ... 已有字段
  newRoleReveal: raw.newRoleReveal,
};
```

### 6c. actionHandler 处理 reveal

**文件**: `src/services/engine/handlers/actionHandler.ts`

添加 reveal 处理函数：

```typescript
function handleNewRoleReveal(
  result: ResolverResult,
  targetSeat: number,
): Pick<ApplyResolverResultAction['payload'], 'newRoleReveal'> {
  return { newRoleReveal: { targetSeat, result: result.result.xxx } };
}
```

在 `handlePlayerAction` / `applyResolverResult` 中调用。

**检查项**:

- [ ] 新字段已加到 `BroadcastGameState` 类型
- [ ] 新字段已加到 `normalizeState` 返回值
- [ ] Reveal 从 resolver 返回值读取，Host 不做二次计算

---

## Step 7: CurrentNightResults（如需跨步骤传递）

**文件**: `src/services/night/resolvers/types.ts`

在 `CurrentNightResults` 接口添加新字段：

```typescript
export interface CurrentNightResults {
  // ... 已有字段
  /** 新角色的影响结果 */
  readonly newRoleEffect?: SomeType;
}
```

**检查项**:

- [ ] 类型为 `readonly`
- [ ] 后续 resolver 可通过 `context.currentNightResults.newRoleEffect` 读取

---

## Step 8: 音频文件

**位置**: `assets/audio/` 和 `assets/audio_end/`（如有结束音频）

- [ ] 放置 `newRole.mp3`（开始音频）
- [ ] 如需结束音频，放置 `assets/audio_end/newRole.mp3`
- [ ] 音频文件名与 `NIGHT_STEPS` 中的 `audioKey` 一致

---

## Step 9: Resolver 单元测试

**文件**: `src/services/night/resolvers/__tests__/newRole.resolver.test.ts`（新建）

必须覆盖：

```typescript
describe('newRoleActionResolver', () => {
  // Happy path
  it('should return valid result for valid target', () => { ... });

  // Skip
  it('should return valid empty result when target is null (skip)', () => { ... });

  // 约束拒绝（如有 notSelf）
  it('should reject when target violates schema constraints', () => { ... });

  // 目标不存在
  it('should reject when target player does not exist', () => { ... });

  // 边界条件
  it('should handle edge cases correctly', () => { ... });
});
```

**检查项**:

- [ ] 纯函数调用，无 mock service
- [ ] 覆盖 skip / 约束拒绝 / 目标不存在 / happy path
- [ ] 如果角色有与 nightmare / magician swap 的交互，单独覆盖

---

## Step 10: Integration Board Test

**文件**: `src/services/__tests__/boards/` 下对应板子测试

在已有的 board integration test 中加入新角色的行动步骤：

**硬规则**:

- [ ] 跑真实 NightFlow（按 NIGHT_STEPS 顺序）
- [ ] 禁止跳步 / 自动清 gate
- [ ] fail-fast（失败立即抛错）
- [ ] 断言基于 BroadcastGameState

---

## Step 11: Board UI Test

**文件**: `src/screens/RoomScreen/__tests__/boards-ui/` 下对应板子测试

**最低覆盖**:

- [ ] 行动 prompt 显示
- [ ] 行动 confirm 对话框
- [ ] reveal 显示（如有）+ REVEAL_ACK
- [ ] skip 路径
- [ ] 额外 gate 的点击/解除（如 `wolfRobotHunterStatusViewed`）

**硬规则**:

- [ ] 使用 `RoomScreenTestHarness`
- [ ] 覆盖断言用字面量数组
- [ ] 禁止 `.skip`

---

## Step 12: 合约测试验证

确认以下合约测试仍然通过：

- [ ] `NIGHT_STEPS` 引用有效性（roleId / SchemaId 都存在）
- [ ] Step ids 顺序确定性（snapshot）与唯一性
- [ ] `audioKey` 非空
- [ ] Night-1-only 红线（无跨夜字段）

---

## 验证命令

完成所有步骤后，依次运行：

```bash
# 1. TypeScript 类型检查
npx tsc --noEmit

# 2. ESLint 检查
npx eslint src/models/roles/spec/ src/services/night/resolvers/ --max-warnings=0

# 3. 相关测试
npx jest --testPathPattern="newRole|nightSteps|specs|schemas|normalize|board" --no-coverage

# 4. 全量测试
npx jest --no-coverage
```

---

## 红线（绝对禁止）

- ❌ 禁止跨夜状态（`previousActions`、`lastNightTarget`）
- ❌ 禁止在 resolver 中做 IO / import UI
- ❌ 禁止 `HostOnlyState` 或不广播的字段
- ❌ 禁止双写 audioKey（specs 和 steps 同时写）
- ❌ 禁止用 UI 文案作为逻辑 key
- ❌ 禁止 normalizeState 遗漏新字段（高频 bug 源！）
- ❌ 禁止 resolver 校验与 schema constraints 不一致
