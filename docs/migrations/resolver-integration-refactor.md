# Resolver 集成重构方案

> **创建日期:** 2026-01-19  
> **完成日期:** 2026-01-19  
> **状态:** ✅ 已完成 (Phase 1-3)  
> **优先级:** 高  
> **影响范围:** GameStateService, Resolvers, Night Flow

---

## 0. 完成摘要

### 已完成:
- ✅ Phase 1: 基础设施 (`currentNightResults` 状态字段)
- ✅ Phase 2: Nightmare Resolver 迁移 (移除内联 wolfKillDisabled 计算)
- ✅ Phase 3: Reveal 类 Resolver 迁移 (seer, psychic, gargoyle, wolfRobot)
- ✅ 删除 setSeerReveal/setPsychicReveal/setGargoyleReveal/setWolfRobotReveal 方法
- ✅ 修复 resolver 支持 canSkip/allowEmptyVote (wolf, psychic, wolfRobot)
- ✅ 修复 resolver 支持 magician swap 后查验 (getRoleAfterSwap)
- ✅ 所有 1110 测试通过

### 待优化 (低优先级):
- ⏳ Phase 4: wolfVote resolver 迁移 (handleWolfVote 内联验证)

---

## 1. 问题概述

### 1.1 发现背景

在修复 "板子里没有梦魇角色，但狼人显示技能被封锁" 的 bug 时，发现了一个严重的架构问题：

**Resolver 被完整定义和测试，但从未被 Host 调用！**

### 1.2 当前架构问题

```
预期架构:
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Player Action  │ ──▶ │   Resolver   │ ──▶ │  Host 应用结果  │
└─────────────────┘     │  (纯函数计算) │     └─────────────────┘
                        └──────────────┘

实际架构:
┌─────────────────┐     ┌──────────────┐
│  Player Action  │ ──▶ │   Host 内联  │  ← 完全绕过 Resolver
└─────────────────┘     │   重复计算   │
                        └──────────────┘
                        
                        ┌──────────────┐
                        │   Resolver   │  ← 从未被调用，只有测试
                        │   (孤岛)     │
                        └──────────────┘
```

### 1.3 证据

1. **`GameStateService.ts` 不导入任何 resolver**
   ```typescript
   // 只导入了工具函数，没有导入 RESOLVERS
   import { getRoleAfterSwap } from './night/resolvers/types';
   ```

2. **双写逻辑对比表**

   | 功能 | Resolver (纯函数) | GameStateService (内联) |
   |------|-------------------|------------------------|
   | Nightmare → wolfKillDisabled | `nightmare.ts:41` 返回 `updates.wolfKillDisabled` | `handlePlayerAction:869-875` 手动 `isWolfRole()` |
   | Seer 查验结果 | `seer.ts:44` 返回 `result.checkResult` | `setSeerReveal:2260-2289` 重新计算 |
   | Psychic 查验结果 | `psychic.ts:40` 返回 `result.identityResult` | `setPsychicReveal:2292-2322` 重新计算 |
   | Guard 守护 | `guard.ts:27` 返回 `updates.guardedSeat` | 直接 `actions.set('guard', ...)` |
   | Witch 用药 | `witch.ts:83` 返回 `updates.savedSeat/poisonedSeat` | 直接 `actions.set('witch', ...)` |
   | **Wolf 投票 immuneToWolfKill** | **新建 `wolfVote.ts`** | `handleWolfVote:951-972` `getWolfKillImmuneRoleIds()` |

3. **导致的问题**
   - 逻辑重复，难以维护
   - Resolver 修改不生效 (因为根本没被调用)
   - 行为不一致风险 (两套逻辑可能产生不同结果)
   - 违反单一职责原则

---

## 2. 设计目标

### 2.1 目标架构

```
ACTION (UI submit)
    │
    ▼
GameStateService.handlePlayerAction()
    │
    ├─ 1. 构建 ActionInput (从 wire protocol)
    │
    ├─ 2. 调用 Resolver
    │      invokeResolver(schemaId, context, input)
    │      └─▶ 返回 { valid, rejectReason?, updates?, result? }
    │
    ├─ 3. 如果 !valid → 拒绝，广播 actionRejected
    │
    └─ 4. 如果 valid → 应用结果
           applyResolverResult(result)
           ├─ 合并 updates → currentNightResults
           ├─ 设置 state fields (wolfKillDisabled, seerReveal, etc.)
           └─ 记录 action → state.actions
    │
    ▼
advanceToNextAction()
```

### 2.2 关键原则

1. **Resolver 是唯一的验证和计算逻辑来源**
2. **Host 只负责应用结果，不做业务逻辑计算**
3. **currentNightResults 在步骤间传递累积结果**
4. **直接重构，不建兼容层** (wire protocol 可以一起改)

---

## 3. 详细设计

### 3.1 新增状态字段

```typescript
// src/services/types/GameStateTypes.ts
interface GameState {
  // ... 现有字段 ...
  
  /**
   * 当前夜晚累积的 resolver 结果。
   * 用于在步骤间传递信息 (如 nightmare block → wolf kill disabled)。
   * 每晚重置。
   */
  currentNightResults: CurrentNightResults;
}
```

### 3.2 新增 invokeResolver 方法

```typescript
// src/services/GameStateService.ts

import { RESOLVERS } from './night/resolvers';
import type { ResolverContext, ActionInput, ResolverResult, CurrentNightResults } from './night/resolvers/types';

/**
 * 调用 Resolver 进行验证和计算。
 * 
 * @param schemaId - 当前步骤的 schema ID
 * @param actorSeat - 行动者座位号
 * @param actorRoleId - 行动者角色
 * @param input - 行动输入
 * @returns ResolverResult
 */
private invokeResolver(
  schemaId: SchemaId,
  actorSeat: number,
  actorRoleId: RoleId,
  input: ActionInput,
): ResolverResult {
  const resolver = RESOLVERS[schemaId];
  
  // 部分 schema 没有 resolver (如 hunterConfirm 只是 ACK)
  if (!resolver) {
    return { valid: true };
  }

  const context: ResolverContext = {
    actorSeat,
    actorRoleId,
    players: this.buildRoleMap(),
    currentNightResults: this.state.currentNightResults ?? {},
    gameState: {
      witchHasAntidote: this.state.witchHasAntidote,
      witchHasPoison: this.state.witchHasPoison,
      isNight1: true, // Night-1-only scope
    },
  };

  return resolver(context, input);
}
```

### 3.3 新增 buildActionInput 方法

```typescript
/**
 * 从 wire protocol 构建 ActionInput。
 */
private buildActionInput(
  schemaId: SchemaId,
  target: number | null,
  extra?: any,
): ActionInput {
  const input: ActionInput = { schemaId };

  // 根据 schema kind 填充不同字段
  const schema = SCHEMAS[schemaId];
  if (!schema) return input;

  switch (schema.kind) {
    case 'chooseSeat':
      input.target = target ?? undefined;
      break;
      
    case 'wolfVote':
      input.target = target ?? undefined;
      break;
      
    case 'compound':
      // Witch: { save: true, target } or { poison: true, target }
      if (extra && typeof extra === 'object') {
        if ('save' in extra) {
          input.stepResults = { save: target };
        } else if ('poison' in extra) {
          input.stepResults = { poison: target };
        }
      }
      break;
      
    case 'swap':
      // Magician: encoded target = firstSeat + secondSeat * 100
      if (target !== null && target >= 100) {
        const firstSeat = target % 100;
        const secondSeat = Math.floor(target / 100);
        input.targets = [firstSeat, secondSeat];
      }
      break;
      
    case 'confirm':
      input.confirmed = true;
      break;
  }

  return input;
}
```

### 3.4 新增 applyResolverResult 方法

```typescript
/**
 * 应用 Resolver 返回的结果到 state。
 */
private applyResolverResult(
  schemaId: SchemaId,
  role: RoleId,
  seat: number,
  target: number | null,
  extra: any,
  result: ResolverResult,
): void {
  // 1. 合并 updates 到 currentNightResults
  if (result.updates) {
    this.state.currentNightResults = {
      ...this.state.currentNightResults,
      ...result.updates,
    };
    
    // 同步需要广播的字段
    if (result.updates.blockedSeat !== undefined) {
      this.state.nightmareBlockedSeat = result.updates.blockedSeat;
    }
    if (result.updates.wolfKillDisabled !== undefined) {
      this.state.wolfKillDisabled = result.updates.wolfKillDisabled;
    }
  }

  // 2. 设置 reveal 结果 (从 resolver result 读取，不再重新计算)
  if (result.result) {
    this.applyRevealResult(role, seat, target, result.result);
  }

  // 3. 记录 action 到 state.actions (保持现有格式)
  this.recordActionToState(role, target, extra);

  // 4. 记录到 nightFlow (用于日志)
  try {
    this.nightFlow.recordAction(role, target);
  } catch (err) {
    hostLog.error('NightFlow recordAction failed:', err);
    throw err;
  }
}

/**
 * 应用 reveal 类结果到 state。
 */
private applyRevealResult(
  role: RoleId,
  _seat: number,
  target: number | null,
  result: NonNullable<ResolverResult['result']>,
): void {
  if (target === null) return;

  // Seer: 查验阵营
  if (result.checkResult) {
    this.state.seerReveal = {
      targetSeat: target,
      result: result.checkResult,
    };
    hostLog.info('Set seerReveal from resolver:', target, result.checkResult);
  }

  // Psychic/Gargoyle/WolfRobot: 查验身份
  if (result.identityResult) {
    const displayName = ROLE_SPECS[result.identityResult].displayName;
    
    if (role === 'psychic') {
      this.state.psychicReveal = { targetSeat: target, result: displayName };
    } else if (role === 'gargoyle') {
      this.state.gargoyleReveal = { targetSeat: target, result: displayName };
    } else if (role === 'wolfRobot') {
      this.state.wolfRobotReveal = { targetSeat: target, result: displayName };
    }
    
    hostLog.info(`Set ${role}Reveal from resolver:`, target, displayName);
  }
}
```

### 3.5 重构 handlePlayerAction

```typescript
private async handlePlayerAction(
  seat: number,
  role: RoleId,
  target: number | null,
  extra?: any,
): Promise<void> {
  if (!this.state || this.state.status !== GameStatus.ongoing) return;

  // ... 现有的 guards (nightFlow 检查, role 检查, phase 检查) ...

  // 获取当前 schemaId
  const schemaId = this.getCurrentSchemaId();
  if (!schemaId) {
    hostLog.error('handlePlayerAction: no schemaId for current step');
    return;
  }

  // ===== 新增: 调用 Resolver =====
  const input = this.buildActionInput(schemaId, target, extra);
  const result = this.invokeResolver(schemaId, seat, role, input);

  if (!result.valid) {
    // 拒绝 action
    const playerUid = this.state.players.get(seat)?.uid;
    if (playerUid) {
      this.state.actionRejected = {
        action: 'submitAction',
        reason: result.rejectReason ?? '行动无效',
        targetUid: playerUid,
      };
      await this.broadcastState();
    }
    hostLog.info('Action rejected by resolver:', result.rejectReason);
    return;
  }

  // ===== 应用结果 =====
  this.applyResolverResult(schemaId, role, seat, target, extra, result);

  // Reveal roles ACK 逻辑 (保持不变)
  if (this.isRevealRole(role) && target !== null) {
    this.pendingRevealAcks.add(this.makeRevealAckKey(this.stateRevision, role));
    return;
  }

  // 推进
  this.nightFlow.dispatch(NightEvent.ActionSubmitted);
  await this.advanceToNextAction();
}
```

### 3.6 更新 startGame 初始化

```typescript
startGame(): void {
  // ... 现有逻辑 ...

  // 重置夜晚累积结果
  this.state.currentNightResults = {};
  
  // ... 现有的其他重置逻辑 ...
}
```

---

## 4. 需要删除的代码

重构完成后，以下内联逻辑应该删除：

| 文件 | 位置 | 内容 | 替代方案 |
|------|------|------|----------|
| `GameStateService.ts` | L869-875 | `if (role === 'nightmare') ... wolfKillDisabled = true` | 由 `applyResolverResult` 处理 |
| `GameStateService.ts` | L880 | `this.setSeerReveal(seat, target)` | 由 `applyRevealResult` 处理 |
| `GameStateService.ts` | L882 | `this.setPsychicReveal(seat, target)` | 由 `applyRevealResult` 处理 |
| `GameStateService.ts` | L884 | `this.setGargoyleReveal(seat, target)` | 由 `applyRevealResult` 处理 |
| `GameStateService.ts` | L886 | `this.setWolfRobotReveal(seat, target)` | 由 `applyRevealResult` 处理 |
| `GameStateService.ts` | L2260-2289 | `setSeerReveal()` 方法 | 删除 |
| `GameStateService.ts` | L2292-2322 | `setPsychicReveal()` 方法 | 删除 |
| `GameStateService.ts` | L2324-2354 | `setGargoyleReveal()` 方法 | 删除 |
| `GameStateService.ts` | L2356-2386 | `setWolfRobotReveal()` 方法 | 删除 |

---

## 5. Resolver 补充检查

### 5.1 Magician Swap 处理

**问题:** Seer/Psychic 查验需要考虑 magician swap，但 swap 在他们之后执行。

**当前夜晚顺序 (NIGHT_STEPS):**
1. nightmare
2. wolf
3. witch
4. seer
5. psychic
6. ...
7. magician (靠后)

**解决方案:** 查验类角色不需要考虑 magician swap，因为：
- Magician 在查验之后行动
- 查验结果基于行动时的身份
- 如果需要 "交换后身份"，那是死亡计算时的逻辑 (DeathCalculator)

**验证:** 现有 resolver 逻辑正确，不需要修改。

### 5.2 各 Resolver 完整性检查

| Resolver | 验证逻辑 | 计算逻辑 | Nightmare Block | 状态 |
|----------|----------|----------|-----------------|------|
| `seer.ts` | ✅ constraints | ✅ checkResult | ✅ 处理 | 完整 |
| `psychic.ts` | ✅ constraints | ✅ identityResult | ✅ 处理 | 完整 |
| `witch.ts` | ✅ save/poison 规则 | ✅ savedSeat/poisonedSeat | ✅ 处理 | 完整 |
| `guard.ts` | ✅ 可跳过 | ✅ guardedSeat | ✅ 处理 | 完整 |
| `nightmare.ts` | ✅ 目标存在 | ✅ blockedSeat/wolfKillDisabled | N/A | 完整 |
| `wolf.ts` | ✅ 目标存在 | ✅ wolfKillTarget | ✅ wolfKillDisabled | 完整 |
| `magician.ts` | ✅ 两个目标 | ✅ swappedSeats | ✅ 处理 | 完整 |
| `dreamcatcher.ts` | ✅ constraints | ✅ dreamingSeat | ✅ 处理 | 完整 |
| `gargoyle.ts` | 需检查 | 需检查 | 需检查 | 待验证 |
| `wolfRobot.ts` | 需检查 | 需检查 | 需检查 | 待验证 |
| `wolfQueen.ts` | 需检查 | 需检查 | 需检查 | 待验证 |
| `slacker.ts` | 需检查 | 需检查 | 需检查 | 待验证 |
| `hunter.ts` | ✅ 仅 ACK | N/A | N/A | 完整 |
| `darkWolfKing.ts` | ✅ 仅 ACK | N/A | N/A | 完整 |

### 5.3 新增 wolfVote Resolver (投票阶段验证)

**背景:** 狼人会议投票 (`handleWolfVote`) 需要验证 `immuneToWolfKill` 约束（如狼美人、恶灵骑士不能被投）。
目前这个验证逻辑在 `GameStateService.handleWolfVote` 中内联实现，应该迁移到 resolver 以保持一致性。

**职责划分:**

| 层级 | 职责 |
|------|------|
| UI (`RoomScreen.helpers.ts`) | 禁用座位 + 显示提示（纯 UX） |
| wolfVote Resolver | 验证投票目标是否合法（权威） |
| Host (`handleWolfVote`) | 调用 resolver，应用/拒绝结果 |

**新建文件:** `src/services/night/resolvers/wolfVote.ts`

```typescript
/**
 * Wolf Meeting Vote Resolver
 * 
 * 验证狼人会议中的单次投票是否合法。
 * 注意：这不是 night action step，而是 meeting 投票验证。
 */
import { getWolfKillImmuneRoleIds } from '../../../models/roles';
import type { RoleId } from '../../../models/roles/spec/types';

export interface WolfVoteInput {
  targetSeat: number;
}

export interface WolfVoteContext {
  actorSeat: number;
  actorRole: RoleId;
  players: Map<number, { role: RoleId }>;
}

export interface WolfVoteResult {
  valid: boolean;
  rejectReason?: string;
}

export function wolfVoteResolver(
  context: WolfVoteContext,
  input: WolfVoteInput,
): WolfVoteResult {
  const { targetSeat } = input;
  const { players } = context;

  // 检查目标是否存在
  const targetPlayer = players.get(targetSeat);
  if (!targetPlayer) {
    return { valid: false, rejectReason: '无效的目标' };
  }

  // 检查 immuneToWolfKill
  const immuneRoleIds = getWolfKillImmuneRoleIds();
  if (immuneRoleIds.includes(targetPlayer.role)) {
    return { valid: false, rejectReason: '无法投票该玩家' };
  }

  return { valid: true };
}
```

**迁移 `handleWolfVote`:**

```typescript
// 修改前 (内联验证)
async handleWolfVote(voterSeat: number, targetSeat: number): Promise<{ success: boolean }> {
  const immuneRoleIds = getWolfKillImmuneRoleIds();
  const targetRole = this.state.players.get(targetSeat)?.role;
  if (targetRole && immuneRoleIds.includes(targetRole)) {
    return { success: false };
  }
  // ... 其余逻辑
}

// 修改后 (调用 resolver)
async handleWolfVote(voterSeat: number, targetSeat: number): Promise<{ success: boolean }> {
  const result = wolfVoteResolver(
    { actorSeat: voterSeat, actorRole: voterRole, players: this.buildRoleMap() },
    { targetSeat }
  );
  if (!result.valid) {
    return { success: false };
  }
  // ... 其余逻辑
}
```

**删除内联代码:**

| 文件 | 位置 | 内容 |
|------|------|------|
| `GameStateService.ts` | L951-972 | `getWolfKillImmuneRoleIds()` 检查 |

---

## 6. 迁移计划

### Phase 1: 基础设施 (不改变行为)

1. 添加 `currentNightResults` 到 state
2. 添加 `invokeResolver` 方法 (但不调用)
3. 添加 `buildActionInput` 方法
4. 添加 `applyResolverResult` 方法 (但不调用)
5. 运行所有测试确保无回归

### Phase 2: Nightmare Resolver 迁移 (验证架构)

1. 在 `handlePlayerAction` 中调用 `invokeResolver` for nightmare
2. 使用 `applyResolverResult` 设置 `wolfKillDisabled`
3. 删除 L869-875 的内联逻辑
4. 运行测试，特别是 nightmare 相关测试

### Phase 3: Reveal 类 Resolver 迁移

1. 迁移 seer → 删除 `setSeerReveal`
2. 迁移 psychic → 删除 `setPsychicReveal`
3. 迁移 gargoyle → 删除 `setGargoyleReveal`
4. 迁移 wolfRobot → 删除 `setWolfRobotReveal`
5. 每个迁移后运行测试

### Phase 4: 其他 Resolver 迁移

1. 迁移 witch
2. 迁移 guard
3. 迁移 wolf
4. 迁移 magician
5. 迁移 dreamcatcher
6. 迁移其余角色
7. **新增 wolfVote resolver** → 删除 `handleWolfVote` 内联验证

### Phase 5: 清理和验证

1. 删除所有未使用的内联方法
2. 运行完整测试套件
3. 运行 E2E 测试
4. 手动验证关键流程

---

## 7. 测试策略

### 7.1 单元测试

- **Resolver 测试** (已存在): 验证纯函数逻辑
- **GameStateService 测试**: 验证 resolver 被正确调用
- **新增集成测试**: 验证 resolver → Host → broadcast 完整流程

### 7.2 E2E 测试

- `night1.basic.spec.ts`: 验证夜晚流程完整性
- 特别关注:
  - Nightmare block → wolf kill disabled
  - Seer/Psychic reveal 正确显示
  - Witch save/poison 正确记录

### 7.3 手动测试场景

1. 有 nightmare 的板子 → 封锁狼人 → 狼人只能空刀
2. 无 nightmare 的板子 → 狼人正常刀人
3. Seer 查验 → 正确显示好人/狼人
4. Witch 同一晚不能同时解救和毒杀

---

## 8. 风险评估

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 行为变化 | 高 | 中 | 逐步迁移，每步验证 |
| Wire protocol 不兼容 | 高 | 低 | 保持 input/output 格式不变 |
| Resolver 逻辑与内联逻辑不一致 | 中 | 中 | 对比测试，确保结果一致 |
| 测试覆盖不足 | 中 | 低 | 补充集成测试 |

---

## 9. 回滚计划

如果迁移过程中发现严重问题：

1. Git revert 到迁移前的 commit
2. 在 `invokeResolver` 中添加 feature flag，可快速切换回内联逻辑
3. 分析问题根因，修复后重新迁移

---

## 10. 完成标准

- [x] 所有 resolver 被 Host 正确调用
- [x] 所有内联重复逻辑已删除 (nightmare, seer, psychic, gargoyle, wolfRobot)
- [x] 所有现有测试通过 (1110 tests)
- [x] E2E 测试通过 (4 passed)
- [x] 无 TypeScript 编译错误
- [x] 无 ESLint 错误
- [x] 更新 copilot-instructions.md 架构说明

---

## 附录: 相关文件

- `src/services/GameStateService.ts` - Host 状态管理
- `src/services/night/resolvers/` - 所有 resolver 实现
- `src/services/night/resolvers/types.ts` - Resolver 类型定义
- `src/models/roles/spec/schemas.ts` - Schema 定义
- `src/models/roles/spec/nightSteps.ts` - 夜晚步骤定义
