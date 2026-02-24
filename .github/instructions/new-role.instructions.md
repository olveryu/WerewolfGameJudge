````instructions
---
applyTo: ''
---

# 新增角色 SOP

本文件定义「添加一个新角色」的完整流程。Copilot 收到类似 "加一个 XX 角色" 的需求时，按此 SOP 执行。

---

## 用户需提供的最小信息

| 字段 | 说明 | 示例 |
|---|---|---|
| **角色名** | 中文名 + camelCase id | 狐狸 / `fox` |
| **阵营** | `Villager` / `God` / `Wolf` / `Special` | `God` |
| **team** | `good` / `wolf` / `third`（决定预言家查验结果） | `good` |
| **shortName** | 单字简称（全局唯一） | `狐` |
| **description** | 一句话技能描述 | 每晚查验一名玩家… |
| **Night-1 有行动？** | `true` / `false` | `true` |
| **行动类型** | `chooseSeat` / `confirm` / `compound` / `swap` / `wolfVote` / 无 | `chooseSeat` |
| **约束** | `[]` / `['notSelf']` 等 | `['notSelf']` |
| **可跳过？** | `true` / `false` | `true` |
| **夜晚行动顺序** | 在哪个现有角色之前/之后 | 在 seer 之前 |
| **狼人会议配置**（仅狼阵营） | canSeeWolves / participatesInWolfVote | — |
| **特殊机制** | reveal 结果 / 影响死亡计算 / 预设上下文 / flags | 无 |

信息不全时 Copilot 应主动询问缺失项，不猜测。

---

## 步骤清单（有夜晚行动的角色）

没有夜晚行动的角色只需步骤 1、9、10、11。

### 步骤 1 — `ROLE_SPECS`

**文件**: `packages/game-engine/src/models/roles/spec/specs.ts`

在对应阵营区块添加条目。`RoleId` 从 `keyof typeof ROLE_SPECS` 自动推导，无需手动加类型。

```typescript
// 参考模板（chooseSeat 类神职）
newRole: {
  id: 'newRole',
  displayName: '中文名',
  shortName: '字',
  faction: Faction.God,     // God | Wolf | Villager | Special
  team: 'good',             // 'good' | 'wolf' | 'third'
  description: '技能描述',
  night1: { hasAction: true },
},

// 参考模板（狼人阵营）
newWolf: {
  id: 'newWolf',
  displayName: '中文名',
  shortName: '字',
  faction: Faction.Wolf,
  team: 'wolf',
  description: '技能描述',
  night1: { hasAction: true },
  wolfMeeting: { canSeeWolves: true, participatesInWolfVote: true },
},
````

### 步骤 2 — `SCHEMAS`

**文件**: `packages/game-engine/src/models/roles/spec/schemas.ts`

`SchemaId` 从 `keyof typeof SCHEMAS` 自动推导。

```typescript
// ---- chooseSeat 类（最常见）----
newRoleAction: {
  id: 'newRoleAction',
  displayName: '行动名',
  kind: 'chooseSeat',
  constraints: [],          // 或 ['notSelf']
  canSkip: true,
  ui: {
    confirmTitle: '确认行动',
    prompt: '请选择目标玩家，如不使用请点击「不使用技能」',
    confirmText: '确定要对该玩家使用技能吗？',
    bottomActionText: '不使用技能',
    // 有 reveal 结果时加：revealKind: 'newRole',
  },
},

// ---- confirm 类（查看状态）----
newRoleConfirm: {
  id: 'newRoleConfirm',
  displayName: '确认发动状态',
  kind: 'confirm',
  canSkip: true,
  ui: {
    confirmTitle: '确认行动',
    prompt: '请点击下方按钮查看技能发动状态',
    confirmText: '确定查看发动状态吗？',
    bottomActionText: '查看发动状态',
    statusDialogTitle: '技能状态',
    canShootText: '可以发动技能',
    cannotShootText: '不能发动技能',
  },
},

// ---- swap 类（交换两人）----
// 参考 magicianSwap

// ---- compound 类（多步骤）----
// 参考 witchAction

// ---- wolfVote 类（狼人集体投票）----
// 参考 wolfKill
```

### 步骤 3 — `NIGHT_STEPS`

**文件**: `packages/game-engine/src/models/roles/spec/nightSteps.ts`

在数组中**按正确位置**插入。合约测试强制 `audioKey === roleId`、`id === SchemaId`。

```typescript
{
  id: 'newRoleAction',   // 必须 === SchemaId
  roleId: 'newRole',     // 必须 === RoleId
  audioKey: 'newRole',   // 必须 === roleId（合约测试强制）
},
```

**现有顺序参考**:

1. magicianSwap → slackerChooseIdol
2. nightmareBlock → dreamcatcherDream → guardProtect
3. wolfKill → wolfQueenCharm
4. witchAction
5. hunterConfirm → darkWolfKingConfirm
6. wolfRobotLearn → seerCheck → gargoyleCheck → psychicCheck

### 步骤 4 — Resolver

**新建文件**: `packages/game-engine/src/resolvers/<newRole>.ts`

```typescript
/**
 * NewRole Resolver (HOST-ONLY, 纯函数)
 *
 * 职责：校验 <角色名> 行动 + 计算结果。
 * 不包含 IO（网络 / 音频 / Alert）。
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 */

import { SCHEMAS } from '../models/roles/spec/schemas';
import { validateConstraints } from './constraintValidator';
import type { ResolverFn } from './types';

export const newRoleActionResolver: ResolverFn = (context, input) => {
  const { actorSeat, players } = context;
  const target = input.target;

  // Schema allows skip → null/undefined = skip
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
  const targetRoleId = players.get(target);
  if (!targetRoleId) {
    return { valid: false, rejectReason: '目标玩家不存在' };
  }

  // === 计算结果（根据角色技能定制）===
  return {
    valid: true,
    // updates: { ... },  // 写入 currentNightResults 的字段
    // result: { ... },    // 返回给广播的结果
  };
};
```

### 步骤 5 — 注册 Resolver

**文件**: `packages/game-engine/src/resolvers/index.ts`

```typescript
import { newRoleActionResolver } from './newRole';

// 在 RESOLVERS 对象中添加：
newRoleAction: newRoleActionResolver,
```

### 步骤 6 — 音频文件

**文件**:

- `assets/audio/<snake_case>.mp3` — 开始音频
- `assets/audio_end/<snake_case>.mp3` — 结束音频

命名规则：camelCase roleId → snake_case 文件名（`wolfQueen` → `wolf_queen.mp3`）。
用 `scripts/generate_audio_edge_tts.py` 生成或手动提供。

### 步骤 7 — 注册音频

**文件**: `src/services/infra/AudioService.ts`

```typescript
// AUDIO_FILES 中添加：
newRole: require('../../../assets/audio/new_role.mp3'),

// AUDIO_END_FILES 中添加：
newRole: require('../../../assets/audio_end/new_role.mp3'),
```

### 步骤 8 — ConfigScreen

**文件**: `src/screens/ConfigScreen/configData.ts`

在 `FACTION_GROUPS` 对应阵营 → sections → roles 数组中添加 `{ roleId: 'newRole' }`。

- 神职 → `好人阵营` → `神职` section
- 技能狼 → `狼人阵营` → `技能狼` section
- 第三方 → `中立阵营` → `第三方` section

### 步骤 9 — Resolver 单测

**新建文件**: `packages/game-engine/src/resolvers/__tests__/<newRole>.resolver.test.ts`

必须覆盖：

- 跳过（null / undefined target）
- 有效目标 → 正确结果
- 不存在的目标 → 拒绝
- 约束违反（如 notSelf）→ 拒绝
- Nightmare 阻断（由 actionHandler 层处理，resolver 层不测；但若 resolver 有特殊 block 逻辑需测试）
- 角色特有边界情况

```typescript
import { newRoleActionResolver } from '@werewolf/game-engine/resolvers/newRole';
import type { ActionInput, ResolverContext } from '@werewolf/game-engine/resolvers/types';

function createContext(overrides: Partial<ResolverContext> = {}): ResolverContext {
  const defaultPlayers = new Map([
    [0, 'villager'], [1, 'wolf'], [2, 'newRole'], [3, 'seer'],
  ] as [number, string][]);
  return {
    actorSeat: 2,
    actorRoleId: 'newRole',
    players: defaultPlayers,
    currentNightResults: {},
    gameState: { isNight1: true },
    ...overrides,
  } as ResolverContext;
}

function createInput(target: number | null | undefined): ActionInput {
  return { schemaId: 'newRoleAction', target: target as number | undefined };
}

describe('newRoleActionResolver', () => {
  it('应该允许跳过', () => { ... });
  it('应该接受有效目标', () => { ... });
  it('应该拒绝不存在的目标', () => { ... });
  // ...角色特有 case
});
```

### 步骤 10 — 更新合约测试计数

**文件**: `packages/game-engine/src/models/roles/spec/__tests__/specs.contract.test.ts`

```typescript
// 修改：
it('should have exactly 22 roles', () => {
  expect(getAllRoleIds()).toHaveLength(22); // → 23
});
```

### 步骤 11 — 运行验证

```bash
pnpm run quality    # typecheck + lint + format + test 全跑
```

snapshot 更新（如 `nightSteps.contract.test.ts` 的 `getAllStepIds()` snapshot）：

```bash
pnpm exec jest --updateSnapshot
```

---

## 条件步骤（仅特殊机制角色需要）

### C1 — Reveal 结果

适用于：查验类角色（如 seer / psychic / gargoyle）。

1. `schema.types.ts` — `RevealKind` 联合类型加新值
2. `protocol/types.ts` — `GameState` 加 `newRoleReveal?` 字段
3. `engine/state/normalize.ts` — 加对应字段（有 `satisfies Complete<...>` 编译守卫）
4. `engine/reducer/types.ts` — `ApplyResolverResultAction.payload` 加 reveal 字段
5. Resolver 中 `result: { checkResult }` 返回查验结果

### C2 — 影响死亡计算

适用于：守护/连带/免疫类（如 guard / dreamcatcher / spiritKnight）。

1. `engine/DeathCalculator.ts` — `NightActions` 接口加字段 + 处理逻辑
2. Resolver 的 `updates` 写入 `currentNightResults` 对应字段
3. `resolvers/types.ts` — `CurrentNightResults` 加新字段

### C3 — 预设上下文 / Gate

适用于：需要前置信息注入的角色（如 witch 的 `witchContext`、hunter/darkWolfKing 的 `confirmStatus`）。

1. `engine/handlers/stepTransitionHandler.ts` — 在步骤转换时构建上下文 actions
2. 可能需新建 `engine/handlers/<newRole>Context.ts`

### C4 — 新 Action 形状

适用于：现有 `kind`（chooseSeat / confirm / compound / swap / wolfVote）不够用时。

1. `models/actions/RoleAction.ts` — 加新 discriminated union 变体
2. `engine/handlers/actionHandler.ts` — 加对应分发逻辑

### C5 — 新 GameState 字段

任何新增 `GameState` 字段都必须同步：

1. `protocol/types.ts` — 字段定义
2. `engine/state/normalize.ts` — 默认值（编译器会报错提醒）
3. `engine/reducer/types.ts` — 对应 StateAction（如需）

### C6 — 预设模板

**文件**: `packages/game-engine/src/models/Template.ts`

在 `PRESET_TEMPLATES` 中添加含新角色的模板（可选）。

### C7 — E2E 测试

**文件**: `e2e/specs/night-roles-*.spec.ts`

按角色行为分类：

- kill/status → `night-roles-kill.spec.ts`
- check/reveal → `night-roles-check.spec.ts`
- protect → `night-roles-protect.spec.ts`
- block/disable → `night-roles-block.spec.ts`

---

## 参考角色索引（按行动类型分类）

| 行动类型             | 参考角色                                                                             | SchemaId                                                                |
| -------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `chooseSeat`（查验） | seer, psychic, gargoyle                                                              | `seerCheck`, `psychicCheck`, `gargoyleCheck`                            |
| `chooseSeat`（效果） | guard, nightmare, dreamcatcher, wolfQueen                                            | `guardProtect`, `nightmareBlock`, `dreamcatcherDream`, `wolfQueenCharm` |
| `chooseSeat`（学习） | wolfRobot                                                                            | `wolfRobotLearn`                                                        |
| `chooseSeat`（选人） | slacker                                                                              | `slackerChooseIdol`                                                     |
| `confirm`            | hunter, darkWolfKing                                                                 | `hunterConfirm`, `darkWolfKingConfirm`                                  |
| `compound`           | witch                                                                                | `witchAction`                                                           |
| `swap`               | magician                                                                             | `magicianSwap`                                                          |
| `wolfVote`           | wolf                                                                                 | `wolfKill`                                                              |
| 无夜晚行动           | villager, idiot, knight, witcher, wolfKing, bloodMoon, spiritKnight, graveyardKeeper | —                                                                       |

---

## 关键约束（违反则合约测试失败）

- `NIGHT_STEPS[*].audioKey` **必须** === `NIGHT_STEPS[*].roleId`
- `NIGHT_STEPS[*].id` **必须** === 对应 `SchemaId`
- `ROLE_SPECS` 中 `night1.hasAction === true` 的角色**必须**在 `NIGHT_STEPS` 中出现恰好一次
- Resolver 校验**必须**与 `SCHEMAS[*].constraints` 双向一致
- 新增 `GameState` 字段**必须**同步 `normalizeState`（编译期守卫）
- `shortName` 全局唯一（单字）

```

```
