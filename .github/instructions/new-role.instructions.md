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
| **阵营** | `Faction.Villager` / `Faction.God` / `Faction.Wolf` / `Faction.Special` | `Faction.God` |
| **team** | `Team.Good` / `Team.Wolf` / `Team.Third`（决定预言家查验结果） | `Team.Good` |
| **shortName** | 单字简称（全局唯一） | `狐` |
| **emoji** | 角色图标 emoji | `🦊` |
| **description** | 一句话技能描述 | 每晚查验一名玩家… |
| **Night-1 有行动？** | `true` / `false` | `true` |
| **行动类型** | `chooseSeat` / `confirm` / `compound` / `swap` / `wolfVote` / `multiChooseSeat` / `groupConfirm` / 无 | `chooseSeat` |
| **约束** | `[]` / `[TargetConstraint.NotSelf]` / `[TargetConstraint.NotWolfFaction]` | `[TargetConstraint.NotSelf]` |
| **可跳过？** | `true` / `false` | `true` |
| **夜晚行动顺序** | 在哪个现有角色之前/之后 | 在 seer 之前 |
| **狼人会议配置**（仅狼阵营） | canSeeWolves / participatesInWolfVote | — |
| **特殊机制** | reveal 结果 / 影响死亡计算 / 预设上下文 / flags / displayAs | 无 |

信息不全时 Copilot 应主动询问缺失项，不猜测。

---

## 步骤清单（有夜晚行动的角色）

没有夜晚行动的角色只需步骤 1、9、10、11。

### 步骤 1 — `ROLE_SPECS`

**文件**: `packages/game-engine/src/models/roles/spec/specs.ts`

在对应阵营区块添加条目。`RoleId` 从 `keyof typeof ROLE_SPECS` 自动推导，无需手动加类型。

```typescript
import { Faction, Team } from './types';

// 参考模板（chooseSeat 类神职）
newRole: {
  id: 'newRole',
  displayName: '中文名',
  shortName: '字',
  emoji: '🎭',
  faction: Faction.God,     // God | Wolf | Villager | Special
  team: Team.Good,          // Team.Good | Team.Wolf | Team.Third
  description: '技能描述',
  night1: { hasAction: true },
},

// 参考模板（狼人阵营）
newWolf: {
  id: 'newWolf',
  displayName: '中文名',
  shortName: '字',
  emoji: '🐺',
  faction: Faction.Wolf,
  team: Team.Wolf,
  description: '技能描述',
  night1: { hasAction: true },
  wolfMeeting: { canSeeWolves: true, participatesInWolfVote: true },
},

// 参考模板（第三方）
newThird: {
  id: 'newThird',
  displayName: '中文名',
  shortName: '字',
  emoji: '🃏',
  faction: Faction.Special,
  team: Team.Third,
  description: '技能描述',
  night1: { hasAction: true },
},

// 参考模板（伪装角色 — 玩家看到的身份与实际不同）
newDisguised: {
  id: 'newDisguised',
  displayName: '中文名',
  shortName: '字',
  emoji: '🪞',
  faction: Faction.Villager,
  team: Team.Good,
  description: '技能描述',
  night1: { hasAction: true },
  displayAs: 'seer',  // 玩家看到的角色 ID（如灯影/酒鬼预言家伪装为 seer）
},
````

**可选字段**:

- `wolfMeeting?: { canSeeWolves, participatesInWolfVote }` — 仅狼阵营
- `flags?: { immuneToWolfKill?, immuneToPoison?, reflectsDamage? }` — 特殊免疫/反射
- `displayAs?: string` — 伪装身份（mirrorSeer / drunkSeer 用）

### 步骤 2 — `SCHEMAS`

**文件**: `packages/game-engine/src/models/roles/spec/schemas.ts`

`SchemaId` 从 `keyof typeof SCHEMAS` 自动推导。

**约束枚举**: `TargetConstraint.NotSelf`（不能选自己）、`TargetConstraint.NotWolfFaction`（不能选狼阵营）。

**bottomActionText 固定值**（4 字）:

- 跳过类：`'不用技能'`（prompt 内引用写 `「不用技能」`）
- 确认类：`'发动状态'`
- groupConfirm：`'催眠状态'`（或按角色定制）

```typescript
// ---- chooseSeat 类（最常见）----
newRoleAction: {
  id: 'newRoleAction',
  displayName: '行动名',
  kind: 'chooseSeat',
  constraints: [TargetConstraint.NotSelf],
  canSkip: true,
  ui: {
    confirmTitle: '确认行动',
    prompt: '请选择目标玩家，如不使用请点击「不用技能」',
    confirmText: '确定要对该玩家使用技能吗？',
    bottomActionText: '不用技能',
    // 有 reveal 结果时加：revealKind: 'newRole',
  },
},

// ---- confirm 类（查看发动状态）----
newRoleConfirm: {
  id: 'newRoleConfirm',
  displayName: '确认发动状态',
  kind: 'confirm',
  canSkip: true,
  ui: {
    confirmTitle: '确认行动',
    prompt: '请点击下方按钮查看技能发动状态',
    confirmText: '确定查看发动状态吗？',
    bottomActionText: '发动状态',
    statusDialogTitle: '技能状态',
    canShootText: '可以发动技能',
    cannotShootText: '不能发动技能',
  },
},

// ---- multiChooseSeat 类（选多个目标）----
newRoleMulti: {
  id: 'newRoleMulti',
  displayName: '行动名',
  kind: 'multiChooseSeat',
  constraints: [TargetConstraint.NotSelf],
  minTargets: 1,
  maxTargets: 2,
  canSkip: true,
  ui: {
    confirmTitle: '确认行动',
    prompt: '请选择1-2名目标玩家，如不使用请点击「不用技能」',
    confirmText: '确定要对选中的玩家使用技能吗？',
    bottomActionText: '不用技能',
    confirmButtonText: '确认行动({count}人)',  // {count} 占位符
  },
},

// ---- groupConfirm 类（全员确认）----
newRoleGroupConfirm: {
  id: 'newRoleGroupConfirm',
  displayName: '状态确认',
  kind: 'groupConfirm',
  requireAllAcks: true,
  ui: {
    prompt: '所有玩家请睁眼，请看手机确认信息',
    bottomActionText: '催眠状态',
    hypnotizedText: '你已被影响，当前受影响的座位：{seats}',
    notHypnotizedText: '你未受影响',
    confirmButtonText: '我知道了',
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

在数组中**按正确位置**插入。

**合约约束**:

- `id` 必须 === `SchemaId`
- `audioKey` 默认必须 === `roleId`（合约测试强制）
- 例外：一个角色有多个步骤时，第二步的 `audioKey` 可以不同（如 `piperHypnotizedReveal`）
- 可选 `audioEndKey`：结束音频与开始音频不同时使用（默认复用 `audioKey`）

```typescript
// 单步骤角色（最常见）
{
  id: 'newRoleAction',   // 必须 === SchemaId
  roleId: 'newRole',     // 必须 === RoleId
  audioKey: 'newRole',   // 默认必须 === roleId
},

// 多步骤角色的第二步（如 piper）
{
  id: 'newRoleSecondStep',
  roleId: 'newRole',
  audioKey: 'newRoleSecondStep',        // 可以不同于 roleId
  audioEndKey: 'newRoleSecondStep',     // 结束音频 key（可选，默认用 audioKey）
},
```

**现有完整顺序参考（23 步）**:

1. magicianSwap → slackerChooseIdol → wildChildChooseIdol
2. nightmareBlock → dreamcatcherDream → guardProtect → silenceElderSilence → votebanElderBan
3. wolfKill → wolfQueenCharm
4. witchAction
5. hunterConfirm → darkWolfKingConfirm
6. wolfRobotLearn → seerCheck → mirrorSeerCheck → drunkSeerCheck → wolfWitchCheck → gargoyleCheck → pureWhiteCheck → psychicCheck
7. piperHypnotize → piperHypnotizedReveal

### 步骤 4 — Resolver

**新建文件**: `packages/game-engine/src/resolvers/<newRole>.ts`

```typescript
/**
 * NewRole Resolver (SERVER-ONLY, 纯函数)
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
    // updates: { guardedSeat: target },  // 写入 currentNightResults 的字段
    // result: { guardedTarget: target },  // 返回给广播的结果
  };
};
```

**ResolverContext 关键字段参考**:

```typescript
interface ResolverContext {
  actorSeat: number;
  actorRoleId: RoleId;
  players: ReadonlyMap<number, RoleId>;
  currentNightResults: CurrentNightResults; // 本夜已累积结果
  wolfRobotContext?: { learnedSeat; disguisedRole };
  witchState?: { canSave; canPoison };
  gameState: {
    isNight1: boolean;
    hypnotizedSeats?: readonly number[]; // 吹笛者累积催眠座位
  };
}
```

**ResolverResult 关键字段参考**:

```typescript
interface ResolverResult {
  valid: boolean;
  rejectReason?: string;
  updates?: Partial<CurrentNightResults>;  // 合并入本夜累积结果
  result?: {
    checkResult?: '好人' | '狼人';          // seer 系
    identityResult?: RoleId;               // psychic / gargoyle / wolfRobot
    savedTarget? / poisonedTarget? / guardedTarget? / blockedTarget? /
    dreamTarget? / charmTarget? / swapTargets? / learnTarget? /
    idolTarget? / silenceTarget? / votebanTarget? / hypnotizedTargets?;
  };
}
```

### 步骤 5 — 注册 Resolver

**文件**: `packages/game-engine/src/resolvers/index.ts`

```typescript
import { newRoleActionResolver } from './newRole';

// 在 RESOLVERS 对象中添加：
newRoleAction: newRoleActionResolver,
```

当前已有 23 个 resolver 注册。

### 步骤 6 — 音频文件

**文件**:

- `assets/audio/<snake_case>.mp3` — 开始音频
- `assets/audio_end/<snake_case>.mp3` — 结束音频

命名规则：camelCase roleId → snake_case 文件名（`wolfQueen` → `wolf_queen.mp3`）。
用 `scripts/generate_audio_edge_tts.py` 生成或手动提供。

### 步骤 7 — 注册音频

**文件**: `src/services/infra/audio/audioRegistry.ts`

在 `AUDIO_REGISTRY` 中添加角色音频条目（begin + end 合并为一个 entry）：

```typescript
// 标准角色（audioKey === roleId）
newRole: {
  begin: require('../../../../assets/audio/new_role.mp3'),
  end: require('../../../../assets/audio_end/new_role.mp3'),
},
```

若角色有多步骤且第二步 `audioKey !== roleId`，还需在 `STEP_AUDIO` 中添加：

```typescript
// STEP_AUDIO — audioKey 不同于 roleId 的步骤
newRoleSecondStep: {
  begin: require('../../../../assets/audio/new_role_second_step.mp3'),
  end: require('../../../../assets/audio_end/new_role_second_step.mp3'),
},
```

音频查找链：`AUDIO_REGISTRY[roleId]` → `SEER_LABEL_AUDIO` → `STEP_AUDIO[audioKey]`。

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
- 约束违反（如 NotSelf / NotWolfFaction）→ 拒绝
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
// 当前为 32，新增角色后改为 33：
it('should have exactly 32 roles', () => {
  expect(getAllRoleIds()).toHaveLength(32); // → 33
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

适用于：查验类角色（如 seer / psychic / gargoyle / pureWhite / wolfWitch / mirrorSeer / drunkSeer）。

1. `schema.types.ts` — `RevealKind` 联合类型加新值（当前：`'seer' | 'psychic' | 'gargoyle' | 'wolfRobot' | 'pureWhite' | 'wolfWitch' | 'mirrorSeer' | 'drunkSeer'`）
2. `protocol/types.ts` — `GameState` 加 `newRoleReveal?` 字段
3. `engine/state/normalize.ts` — 加对应字段（有 `satisfies Complete<...>` 编译守卫）
4. `engine/reducer/types.ts` — `ApplyResolverResultAction.payload` 加 reveal 字段
5. Resolver 中 `result: { checkResult }` 返回查验结果
6. 查验类 resolver 必须使用 `resolveRoleForChecks()` 获取有效角色（处理魔术师交换 + 机械狼伪装）

### C2 — 影响死亡计算

适用于：守护/连带/免疫类（如 guard / dreamcatcher / spiritKnight）。

1. `engine/DeathCalculator.ts` — `NightActions` 接口加字段 + 处理逻辑
2. Resolver 的 `updates` 写入 `currentNightResults` 对应字段
3. `resolvers/types.ts` — `CurrentNightResults` 加新字段（当前字段：wolfVotesBySeat / blockedSeat / wolfKillDisabled / guardedSeat / savedSeat / poisonedSeat / dreamingSeat / swappedSeats / silencedSeat / votebannedSeat / hypnotizedSeats）

### C3 — 预设上下文 / Gate

适用于：需要前置信息注入的角色（如 witch 的 `witchContext`、hunter/darkWolfKing 的 `confirmStatus`、wolfRobot 的 `hunterGate`）。

1. `engine/handlers/stepTransitionHandler.ts` — 在步骤转换时构建上下文 actions
2. 可能需新建 `engine/handlers/<newRole>Context.ts`

### C4 — 新 Schema Kind

适用于：现有 `kind`（chooseSeat / confirm / confirmTarget / compound / swap / wolfVote / skip / multiChooseSeat / groupConfirm）不够用时。

1. `schema.types.ts` — 新增 schema 接口 + 加入 `ActionSchema` 联合类型
2. `actionHandler.ts` — 加对应分发逻辑
3. 客户端 UI 适配（BoardView / NightActionSheet）

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

### C8 — multiChooseSeat（多目标选择）

适用于：action.targets 为数组的角色（如 piper 催眠 1-2 人）。

1. `schemas.ts` — 用 `kind: 'multiChooseSeat'`，设 `minTargets` / `maxTargets` / `canSkip`
2. `schema.types.ts` — `MultiChooseSeatSchema` 已定义（含 `confirmButtonText` 支持 `{count}` 占位符）
3. Resolver 从 `input.targets` （非 `input.target`）读取目标数组
4. `resolvers/types.ts` — `ActionInput.targets` 已存在（`readonly number[]`）
5. 客户端 UI 需处理多选交互

### C9 — groupConfirm（全员确认）

适用于：所有玩家需在手机上确认状态的步骤（如 piper 催眠揭示）。

1. `schemas.ts` — 用 `kind: 'groupConfirm'`，设 `requireAllAcks`
2. `schema.types.ts` — `GroupConfirmSchema` 已定义（含 `hypnotizedText` / `notHypnotizedText` / `confirmButtonText`）
3. Resolver 对 `confirmed: true` 返回 valid，不需要 target
4. 通常作为角色的第二步骤（roleId 相同但 schemaId / audioKey 不同）
5. `nightSteps.ts` — 需要 `audioEndKey`（独立结束音频）
6. `audioRegistry.ts` — 在 `STEP_AUDIO` 中注册（非 `AUDIO_REGISTRY`）

### C10 — 多步骤角色

适用于：同一角色有多个 NIGHT_STEPS 条目（如 piper = piperHypnotize + piperHypnotizedReveal）。

1. `NIGHT_STEPS` 中添加多个条目，`roleId` 相同
2. 第二步的 `audioKey` 可以不同于 `roleId`（需在 `STEP_AUDIO` 注册音频）
3. 第二步可设 `audioEndKey`（独立结束音频）
4. `SCHEMAS` 中为每步各建一个 schema
5. `resolvers/index.ts` 中注册多个 resolver（可从同一文件导出）
6. 合约测试会检查"每个 `night1.hasAction=true` 的角色至少出现一次"（非恰好一次）

---

## 参考角色索引（按行动类型分类）

| 行动类型             | 参考角色                                                                                                 | SchemaId                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `chooseSeat`（查验） | seer, mirrorSeer, drunkSeer, psychic, gargoyle, pureWhite, wolfWitch                                     | `seerCheck`, `mirrorSeerCheck`, `drunkSeerCheck`, `psychicCheck`, `gargoyleCheck`, `pureWhiteCheck`, `wolfWitchCheck` |
| `chooseSeat`（效果） | guard, nightmare, dreamcatcher, wolfQueen, silenceElder, votebanElder                                    | `guardProtect`, `nightmareBlock`, `dreamcatcherDream`, `wolfQueenCharm`, `silenceElderSilence`, `votebanElderBan`     |
| `chooseSeat`（学习） | wolfRobot                                                                                                | `wolfRobotLearn`                                                                                                      |
| `chooseSeat`（选人） | slacker, wildChild                                                                                       | `slackerChooseIdol`, `wildChildChooseIdol`                                                                            |
| `confirm`            | hunter, darkWolfKing                                                                                     | `hunterConfirm`, `darkWolfKingConfirm`                                                                                |
| `compound`           | witch                                                                                                    | `witchAction`                                                                                                         |
| `swap`               | magician                                                                                                 | `magicianSwap`                                                                                                        |
| `wolfVote`           | wolf                                                                                                     | `wolfKill`                                                                                                            |
| `multiChooseSeat`    | piper                                                                                                    | `piperHypnotize`                                                                                                      |
| `groupConfirm`       | piper（第二步）                                                                                          | `piperHypnotizedReveal`                                                                                               |
| 无夜晚行动           | villager, idiot, knight, witcher, wolfKing, bloodMoon, spiritKnight, graveyardKeeper, dancer, masquerade | —                                                                                                                     |

---

## 关键约束（违反则合约测试失败）

- `NIGHT_STEPS[*].audioKey` 默认**必须** === `NIGHT_STEPS[*].roleId`（例外：多步骤角色的非首步，如 `piperHypnotizedReveal`）
- `NIGHT_STEPS[*].id` **必须** === 对应 `SchemaId`
- `ROLE_SPECS` 中 `night1.hasAction === true` 的角色**必须**在 `NIGHT_STEPS` 中至少出现一次
- Resolver 校验**必须**与 `SCHEMAS[*].constraints` 双向一致
- 新增 `GameState` 字段**必须**同步 `normalizeState`（编译期守卫）
- `shortName` 全局唯一（单字）
- `bottomActionText` **必须** 少于4 个汉字
- `AUDIO_REGISTRY` 必须覆盖所有 `NIGHT_STEPS` 中出现的 unique `roleId`（合约测试强制）
- `TargetConstraint` 使用枚举 `TargetConstraint.NotSelf` / `TargetConstraint.NotWolfFaction`，不用字符串

```

```
