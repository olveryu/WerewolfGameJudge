---
name: new-role
description: 'Add a new werewolf role end-to-end: spec, night step, resolver, audio, badge, config, tests. Use when: adding a role, creating a character, new role SOP, 新增角色, 添加角色.'
argument-hint: '角色名 + 阵营 + 技能简述（如：狐狸 神职 每晚查验一名玩家）'
---

# 新增角色 Skill（V2 架构）

端到端添加一个狼人杀角色。V2 架构中，角色的所有声明（abilities/effects/nightSteps/UI）全部内嵌在 `specs.ts` 的 ROLE_SPECS 条目中，不再有独立的 `schemas.ts` 或 `nightSteps.ts`。

## When to Use

- 用户要求新增/添加一个狼人杀角色
- 用户描述了一个新角色的技能并希望实现

---

## Procedure

### Phase 1 — 收集信息

1. 从用户输入中提取已知字段。
2. 对照下表检查缺失项，**主动询问**所有缺失的必填字段（不猜测）：

| 必填字段                | 说明                                                                                                  | 示例                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------- |
| 角色名                  | 中文名 + camelCase id                                                                                 | 隐狼 / `hiddenWolf`          |
| 阵营                    | `Faction.God` / `Faction.Wolf` / `Faction.Villager` / `Faction.Special`                               | `Faction.Wolf`               |
| team                    | `Team.Good` / `Team.Wolf` / `Team.Third`（决定预言家查验结果）                                        | `Team.Good`                  |
| shortName               | 单字简称（全局唯一）                                                                                  | `隐`                         |
| emoji                   | 角色图标 emoji                                                                                        | `👤🐺`                       |
| description             | 规则描述（遵循文案规范）                                                                              | 与其他狼人互不相认；…        |
| structuredDescription   | 分段描述（passive/skill/special/restriction/trigger/winCondition）                                    | 见模板                       |
| tags                    | 能力标签数组                                                                                          | `['check']`                  |
| Night-1 有行动？        | `true` / `false`                                                                                      | `true`                       |
| 行动类型 (actionKind)   | `chooseSeat` / `confirm` / `compound` / `swap` / `wolfVote` / `multiChooseSeat` / `groupConfirm` / 无 | `confirm`                    |
| 约束                    | `[]` / `[TargetConstraint.NotSelf]` / `[TargetConstraint.NotWolfFaction]` 等                          | `[TargetConstraint.NotSelf]` |
| 可跳过？                | `true` / `false`                                                                                      | `true`                       |
| effects                 | `[{ kind: 'check', resultType: 'faction' }]` 等                                                       | 见 effects 速查表            |
| 夜晚行动顺序            | 在哪个现有步骤之前/之后（引用 plan.ts NIGHT_STEP_ORDER_INTERNAL）                                     | 在 wolfQueenCharm 之后       |
| recognition（仅狼阵营） | `{ canSeeWolves: bool, participatesInWolfVote: bool }`                                                | `{ canSeeWolves: false, … }` |
| 特殊机制                | confirm 管道 / reveal / 死亡计算 / 免疫 / displayAs / 无                                              | confirm 管道                 |

3. 用 `grep_search` 验证 `shortName` 全局唯一。
4. 确认 description 符合文案规范（见下方「description 文案规范」节）。

> **NOTE**: 角色是否有夜晚行动由 `nightSteps` 数组决定（`hasNightAction()` 从 `nightSteps.length > 0` 推导）。

### Phase 2 — 制定变更计划

根据 Resolver 决策表和条件步骤，确定：

- genericResolver 还是独立 resolver（查决策表）
- 需要哪些条件步骤（C1-C10）
- 列出完整变更文件清单 + 每个文件的变更点

**输出变更计划，等待用户确认后再编码。**

### Phase 3 — 实现（用户确认后）

按 SOP 顺序逐步实现。

#### 核心步骤（有夜晚行动的角色）

| #   | 步骤                           | 文件                                                  |
| --- | ------------------------------ | ----------------------------------------------------- |
| 1   | ROLE_SPECS 添加条目            | `packages/game-engine/src/models/roles/spec/specs.ts` |
| 2   | NIGHT_STEP_ORDER_INTERNAL 插入 | `packages/game-engine/src/models/roles/spec/plan.ts`  |
| 3   | Resolver 注册                  | `packages/game-engine/src/resolvers/index.ts`         |
| 4   | 音频文件生成                   | 见「步骤 4 — 音频生成」                               |
| 5   | 注册音频                       | `src/services/infra/audio/audioRegistry.ts`           |
| 6   | ConfigScreen 添加              | `src/screens/ConfigScreen/configData.ts`              |
| 6b  | 角色徽章                       | 见「步骤 6b — 角色徽章生成」                          |

#### 无夜晚行动的角色

只需步骤 1、7-9。

#### 条件步骤（按需）

根据角色特殊机制选择 C1-C10（详见下方「条件步骤参考」节）。

### Phase 3.5 — 核心原则自检

对本次所有修改逐条过核心原则 🔍 自检：

1. 是否有 band-aid 修复？（原则 1）
2. 涉及第三方 API 是否查了文档？（原则 2）
3. 是否有 `as any` / 不必要的 `?.`？（原则 3）
4. 是否有吞错误的 catch / 无反馈的失败路径？（原则 4）
5. 新增的类型/字段是否全管道贯穿？（原则 5）

### Phase 4 — 测试 & 验证

| #   | 步骤         | 方法                                                                                |
| --- | ------------ | ----------------------------------------------------------------------------------- |
| 7   | 集成测试     | 按角色特有逻辑新建测试（confirm → confirmContext.test.ts / 查验类 → resolver test） |
| 8   | 合约测试计数 | `roles.registry.contract.test.ts` + `v2Specs.contract.test.ts` 角色总数 +1          |
| 9   | 全量验证     | `pnpm run quality`；snapshot 变更用 `pnpm exec jest --updateSnapshot`               |

### Phase 5 — 收尾

- 确认 `pnpm run quality` 全绿
- 更新 `README.md` 和 `README.en.md` 中的角色数量、阵营计数和角色列表
- 更新 `docs/NIGHT1_ROLE_ALIGNMENT_MATRIX.md` 中的步骤顺序表和角色行为矩阵
- 确认 `docs/avatar-generation-prompts.md` 已追加新角色 prompt（步骤 6b.10）
- 确认 `scripts/badge-config.mjs` EMOJI_MAP 已添加新角色映射（步骤 6b.5）
- 确认 `rewardCatalog.ts` HAND_DRAWN_AVATAR_IDS + AVATAR_RARITY 已添加（步骤 6b.6-7）
- 确认 `avatarImages.ts` + `avatarImages.web.ts` 已注册（步骤 6b.8-9）
- **如果同时新增了预设板子**（通过 new-board skill 或直接添加），必须同步完成：
  - 在 `src/components/BoardStrategy/boardStrategyData.ts` 的 `BOARD_STRATEGY` 中新增攻略条目（key = 板子名），包含 difficulty / recommendLevel / tags / summary / goodStrategy / wolfStrategy / thirdStrategy（如有第三方）/ firstNight / pitfalls / meta
  - 更新 `README.md` 和 `README.en.md` 中的预设板子数量
  - 更新 `docs/PRESET_BOARDS.md` 预设板子参考文档
- 总结变更文件清单
- 提示用户提交（按 Conventional Commits：`feat(game-engine): add <roleName> role`）

---

## V2 架构关键知识

### 单一文件定义

V2 中每个角色的 **所有声明** 都在 `specs.ts` 的一个条目中：

```
ROLE_SPECS.<roleId> = {
  id, displayName, shortName, emoji,
  faction, team,
  description, structuredDescription,
  tags,
  recognition?,           // 狼阵营: { canSeeWolves, participatesInWolfVote }
  abilities[],            // 技能声明 (active/passive/triggered)
  nightSteps[],           // 夜间步骤 (stepId + displayName + audioKey + actionKind + ui)
  resources?,             // 资源限制 (bullet/antidote/poison)
  immunities?,            // 免疫声明
  deathCalcRole?,         // 死亡计算角色
  displayAs?,             // 伪装身份
  groups?,                // 角色组 (seerFamily 等)
}
```

不存在独立的 `schemas.ts` 或 `nightSteps.ts`。Schema 信息内嵌在 `nightSteps[].ui` 中，夜间顺序由 `plan.ts` 的 `NIGHT_STEP_ORDER_INTERNAL` 控制。

### 类型自动推导

- `RoleId` = `keyof typeof ROLE_SPECS`（新增条目自动纳入）
- `SchemaId` = 从所有 `ROLE_SPECS[*].nightSteps[*].stepId` 收集

### abilities 与 effects

abilities 声明角色的能力类型和效果：

```typescript
abilities: [
  {
    type: 'active',              // 'active' | 'passive' | 'triggered'
    timing: 'night',             // 'night' | 'day'
    actionKind: 'chooseSeat',    // 对应 nightSteps[].actionKind
    target: {
      count: { min: 1, max: 1 },
      constraints: [TargetConstraint.NotSelf],
    },
    canSkip: true,
    effects: [{ kind: 'check', resultType: 'faction' }],
    activeOnNight1: true,
  },
],
```

### effects 速查表

| kind          | 参数                                                       | 用途                 | 参考角色                |
| ------------- | ---------------------------------------------------------- | -------------------- | ----------------------- |
| `writeSlot`   | `slot: string`                                             | 写入夜间结果槽位     | guard, dreamcatcher     |
| `check`       | `resultType: 'faction' \| 'identity'`                      | 查验阵营/身份        | seer, psychic, gargoyle |
| `check`       | `resultType: 'faction', transformer: 'invert' \| 'random'` | 反转/随机查验        | mirrorSeer, drunkSeer   |
| `charm`       | —                                                          | 魅惑连接             | wolfQueen               |
| `chooseIdol`  | —                                                          | 选榜样               | slacker, wildChild      |
| `block`       | `disablesWolfKillOnWolfTarget?: bool`                      | 封锁技能             | nightmare               |
| `learn`       | `gateTriggersOnRoles?: string[]`                           | 学习技能+身份        | wolfRobot               |
| `confirm`     | `confirmType: 'shoot' \| 'faction' \| ...`                 | 确认类（见确认管道） | hunter, avenger         |
| `swap`        | —                                                          | 交换号码牌           | magician                |
| `hypnotize`   | —                                                          | 催眠                 | piper                   |
| `groupReveal` | —                                                          | 全员确认             | piper                   |
| `mimic`       | `pairedRole: string`                                       | 模仿                 | shadow                  |
| `convert`     | —                                                          | 转化阵营             | awakenedGargoyle        |
| `chooseCard`  | —                                                          | 选底牌               | thief, treasureMaster   |

### nightSteps 结构

```typescript
nightSteps: [
  {
    stepId: 'seerCheck',         // 全局唯一，即 SchemaId
    displayName: '查验',         // UI 展示名
    audioKey: 'seer',            // 音频 key（默认 === roleId）
    actionKind: 'chooseSeat',    // 与 abilities[].actionKind 对应
    ui: {
      confirmTitle: '确认查验',
      prompt: '请选择要查验的玩家，如不使用请点击「不用技能」',
      confirmText: '查验此玩家？',
      revealTitlePrefix: '查验结果',
      revealResultFormat: 'factionCheck',  // 'factionCheck' | 'roleName'
      bottomActionText: '不用技能',
      // confirm 类额外字段：
      confirmStatusUi: { kind: 'shoot', statusDialogTitle: '…', canText: '…', cannotText: '…' },
    },
  },
],
```

---

## Resolver 决策表

| 模式                                 | genericResolver                                                            | 独立 resolver                      |
| ------------------------------------ | -------------------------------------------------------------------------- | ---------------------------------- |
| chooseSeat + writeSlot               | ✅ guard, dreamcatcher, silenceElder, votebanElder, wolfQueen, crow        |                                    |
| chooseSeat + check                   | ✅ seer 家族, psychic, gargoyle, pureWhite, wolfWitch                      |                                    |
| chooseIdol / confirm / block / learn | ✅ slacker, wildChild, hunter, darkWolfKing, avenger, nightmare, wolfRobot |                                    |
| compound / wolfVote / swap           |                                                                            | ✅ witch, wolf, magician           |
| 跨角色联动 / 多目标+级联             |                                                                            | ✅ shadow, piper, awakenedGargoyle |

**genericResolver 路径**: 无需新建文件。`createGenericResolver('roleId')` 从 ROLE_SPECS 读取 abilities → 自动分发到对应 effect processor（`processWriteSlot` / `processCheck` / `processConfirm` 等）。

**独立 resolver 路径**: 新建 `packages/game-engine/src/resolvers/<newRole>.ts`。

---

## description 文案规范

### 通用规则

- **句式**: 分号（；）分隔独立规则子句
- **长度**: 15~80 字；**句末不加句号**
- **统一术语**: 袭击（非猎杀/刀人）、出局（非死亡）、查验阵营/身份、免疫、首夜、阿拉伯数字
- **语气**: 客观三人称，禁止自指角色名（用「自身」）
- **标点**: 中文全角；逗号分并列，分号分规则
- **禁止裁判话术**: 不写"睁眼""闭眼""请看手机"等流程语——那是音频旁白的事

### 固定模式速查

```text
# 查验阵营类
每晚可查验一名玩家的阵营，获知其是好人还是狼人
# 查验身份类
每晚可查验一名玩家的身份，获知其具体角色名称
# 选择目标类
每晚可选择一名玩家进行[动作]，[效果描述]；[限制条件]
# 被动类
[触发条件]时[效果]；[限制条件]
# 出局触发类
出局时可[动作]；仅[条件]时可发动
```

### 狼阵营特有模式

以下为狼人阵营角色的标准用语，**必须完全复用**，不得换词：

| 语义           | 标准用语                                                                     | 示例角色             |
| -------------- | ---------------------------------------------------------------------------- | -------------------- |
| 不进狼队       | `与其他狼人互不相认`                                                         | gargoyle, wolfRobot  |
| 继承袭击       | `其他狼人全部出局后可主导袭击`                                               | gargoyle, wolfRobot  |
| 禁止自爆       | `不能自爆`                                                                   | wolfRobot            |
| 预言家查验好人 | `预言家查验为好人`                                                           | avenger（team=Good） |
| 不参与袭击投票 | 不写在 description 中（由 `recognition.participatesInWolfVote: false` 隐含） | —                    |

### structuredDescription 字段

按语义分类拆分 description 到以下 key（仅写有内容的 key）：

| key            | 语义         | 写法                                 |
| -------------- | ------------ | ------------------------------------ |
| `passive`      | 被动/状态    | 与其他狼人互不相认；预言家查验为好人 |
| `skill`        | 主动技能     | 首夜可获知狼同伴身份                 |
| `trigger`      | 触发效果     | 出局时可开枪带走一名玩家             |
| `special`      | 特殊条件效果 | 其他狼人全部出局后可主导袭击         |
| `restriction`  | 限制         | 不能自爆                             |
| `winCondition` | 胜利条件     | 与榜样阵营共同胜利（仅第三方需要）   |

---

## Confirm 步骤完整管道

当新角色使用 `actionKind: 'confirm'` 时，需要贯穿以下全管道：

### 1. 类型定义

**`packages/game-engine/src/protocol/types.ts`** — 新增 ConfirmStatus 变体：

```typescript
// 现有: ShootConfirmStatus | FactionConfirmStatus
// 新增变体加入 discriminated union:
export interface NewRoleConfirmStatus {
  readonly role: 'newRole';
  readonly someField: SomeType;
}
export type ConfirmStatus = ShootConfirmStatus | FactionConfirmStatus | NewRoleConfirmStatus;
```

**`packages/game-engine/src/models/roles/spec/schema.types.ts`** — 新增 ConfirmStatusUi 变体：

```typescript
// 现有: ShootConfirmUi | FactionConfirmUi
// 新增:
export interface NewRoleConfirmUi {
  readonly kind: 'newKind'; // discriminant tag
  readonly statusDialogTitle: string;
  readonly someUiField: string;
}
export type ConfirmStatusUi = ShootConfirmUi | FactionConfirmUi | NewRoleConfirmUi;
```

### 2. 服务端计算（confirmContext.ts）

**文件**: `packages/game-engine/src/engine/handlers/confirmContext.ts`

```typescript
// 1. 扩展 ConfirmRole 类型
type ConfirmRole = 'hunter' | 'darkWolfKing' | 'avenger' | 'newRole';

// 2. deriveConfirmStepRoleMap() 自动扫描（无需手动添加映射）
//    它遍历所有 ROLE_SPECS 的 nightSteps 找 actionKind === 'confirm'

// 3. computeConfirmStatus 新增分支
function computeConfirmStatus(role: ConfirmRole, state: NonNullState): ConfirmStatus {
  if (role === 'avenger') return computeAvengerConfirmStatus(state);
  if (role === 'newRole') return computeNewRoleConfirmStatus(state);
  // Hunter / DarkWolfKing (default shoot)
  ...
}

// 4. 实现计算函数
function computeNewRoleConfirmStatus(state: NonNullState): NewRoleConfirmStatus {
  // 纯函数，从 state 计算确认信息
  return { role: 'newRole', someField: computedValue };
}
```

**管道触发链**: `stepTransitionHandler.handleAdvanceNight()` → 检测 nextStepId → `maybeCreateConfirmStatusAction(nextStepId, state)` → 查 `CONFIRM_STEP_ROLE[stepId]` → `computeConfirmStatus()` → 返回 `SET_CONFIRM_STATUS` action → reducer 写入 `GameState.confirmStatus` → 广播。

### 3. 客户端展示（promptExecutor.ts）

**文件**: `src/screens/RoomScreen/executors/promptExecutor.ts`

`confirmTriggerExecutor` 中按 `statusUi.kind` 分发：

```typescript
if (statusUi.kind === 'newKind') {
  // 从 confirmStatus 读取服务端计算的数据
  const data = confirmStatus?.role === 'newRole' ? confirmStatus.someField : fallback;
  statusMessage = formatMessage(statusUi, data);
} else if (statusUi.kind === 'faction') {
  // ...existing avenger
} else {
  // ...existing shoot (hunter/darkWolfKing)
}
```

### 4. Resolver

confirm 类 resolver 使用 `createGenericResolver()`，其内部 `processConfirm` 为 no-op（确认类不产生 state 变更，状态已由 confirmContext 预计算）。

### 现有 Confirm 变体参考

| 角色         | confirmType | ConfirmStatus          | ConfirmStatusUi    | 显示内容 |
| ------------ | ----------- | ---------------------- | ------------------ | -------- |
| hunter       | `'shoot'`   | `ShootConfirmStatus`   | `ShootConfirmUi`   | 能否开枪 |
| darkWolfKing | `'shoot'`   | `ShootConfirmStatus`   | `ShootConfirmUi`   | 能否开枪 |
| avenger      | `'faction'` | `FactionConfirmStatus` | `FactionConfirmUi` | 所属阵营 |

---

## 代码模板

### ROLE_SPECS — chooseSeat 类（最常见）

```typescript
newRole: {
  id: 'newRole',
  displayName: '中文名',
  shortName: '字',
  emoji: '🎭',
  faction: Faction.God,
  team: Team.Good,
  description: '每晚可查验一名玩家的阵营，获知其是好人还是狼人',
  structuredDescription: {
    skill: '每晚可查验一名玩家的阵营，获知其是好人还是狼人',
  },
  tags: ['check'],
  abilities: [
    {
      type: 'active',
      timing: 'night',
      actionKind: 'chooseSeat',
      target: {
        count: { min: 1, max: 1 },
        constraints: [TargetConstraint.NotSelf],
      },
      canSkip: true,
      effects: [{ kind: 'check', resultType: 'faction' }],
      activeOnNight1: true,
    },
  ],
  nightSteps: [
    {
      stepId: 'newRoleCheck',
      displayName: '查验',
      audioKey: 'newRole',
      actionKind: 'chooseSeat',
      ui: {
        confirmTitle: '确认查验',
        prompt: '请选择要查验的玩家，如不使用请点击「不用技能」',
        confirmText: '查验此玩家？',
        revealTitlePrefix: '查验结果',
        revealResultFormat: 'factionCheck',
        bottomActionText: '不用技能',
      },
    },
  ],
},
```

### ROLE_SPECS — 隐身狼人类（不入狼队）

```typescript
newWolf: {
  id: 'newWolf',
  displayName: '中文名',
  shortName: '字',
  emoji: '👤🐺',
  faction: Faction.Wolf,
  team: Team.Good,  // 或 Team.Wolf，取决于预言家查验结果
  description: '与其他狼人互不相认；[技能]；其他狼人全部出局后可主导袭击；不能自爆',
  structuredDescription: {
    passive: '与其他狼人互不相认；预言家查验为好人',
    skill: '[首夜/每晚]可[动作]',
    special: '其他狼人全部出局后可主导袭击',
    restriction: '不能自爆',
  },
  tags: ['confirm'],  // 或 ['check'] 等
  recognition: { canSeeWolves: false, participatesInWolfVote: false },
  abilities: [...],
  nightSteps: [...],
},
```

### ROLE_SPECS — 普通狼人类（入狼队）

```typescript
newWolf: {
  id: 'newWolf',
  displayName: '中文名',
  shortName: '字',
  emoji: '👸🐺',
  faction: Faction.Wolf,
  team: Team.Wolf,
  description: '[技能描述]；不能自爆',
  structuredDescription: {
    skill: '[技能描述]',
    restriction: '不能自爆',
  },
  tags: ['control'],
  recognition: { canSeeWolves: true, participatesInWolfVote: true },
  abilities: [...],
  nightSteps: [...],
},
```

### ROLE_SPECS — confirm 类

```typescript
newRole: {
  id: 'newRole',
  displayName: '中文名',
  shortName: '字',
  emoji: '🎭',
  faction: Faction.Wolf,
  team: Team.Good,
  description: '技能描述',
  structuredDescription: { ... },
  tags: ['confirm'],
  recognition: { canSeeWolves: false, participatesInWolfVote: false },
  abilities: [
    {
      type: 'active',
      timing: 'night',
      actionKind: 'confirm',
      canSkip: true,
      effects: [{ kind: 'confirm', confirmType: 'newConfirmType' }],
      activeOnNight1: true,
    },
  ],
  nightSteps: [
    {
      stepId: 'newRoleConfirm',
      displayName: '确认信息',
      audioKey: 'newRole',
      actionKind: 'confirm',
      ui: {
        confirmTitle: '确认行动',
        prompt: '请点击下方按钮查看信息',
        confirmText: '查看信息？',
        bottomActionText: '查看信息',
        confirmStatusUi: {
          kind: 'newKind',
          statusDialogTitle: '信息标题',
          // ...kind-specific UI fields
        },
      },
    },
  ],
},
```

### plan.ts — 步骤顺序

**文件**: `packages/game-engine/src/models/roles/spec/plan.ts`

```typescript
export const NIGHT_STEP_ORDER_INTERNAL = [
  // === 首发（魔术师/榜样/影子/复仇者）===
  'magicianSwap',
  'slackerChooseIdol',
  'wildChildChooseIdol',
  'shadowChooseMimic',
  'avengerConfirm',

  // === 蚀时狼妃放逐 ===
  'eclipseWolfQueenShelter',

  // === 守护/查验类（袭击前）===
  'nightmareBlock',
  'dreamcatcherDream',
  'guardProtect',
  'silenceElderSilence',
  'votebanElderBan',
  'crowCurse',

  // === 狼人会议阶段 ===
  'wolfKill',
  'wolfQueenCharm',
  // ← 不入狼队的狼人确认步骤插这里（如 hiddenWolfReveal）

  // === 女巫 / 毒师 ===
  'witchAction',
  'poisonerPoison',

  // === 确认类（猎人/狼王开枪状态）===
  'hunterConfirm',
  'darkWolfKingConfirm',

  // === 查验类（最后四个 + 石像鬼等）===
  'wolfRobotLearn',
  'seerCheck',
  'mirrorSeerCheck',
  'drunkSeerCheck',
  'wolfWitchCheck',
  'gargoyleCheck',
  'pureWhiteCheck',
  'psychicCheck',

  // === 觉醒石像鬼转化 ===
  'awakenedGargoyleConvert',

  // === 吹笛者 ===
  'piperHypnotize',
  'piperHypnotizedReveal',

  // === 觉醒石像鬼转化揭示 ===
  'awakenedGargoyleConvertReveal',
] as const;
```

在对应位置插入新 stepId。

### Resolver 注册

**文件**: `packages/game-engine/src/resolvers/index.ts`

```typescript
// Generic resolver (大多数角色)
newRoleAction: createGenericResolver('newRole'),

// 或带 abilityIndex 的（多 ability 角色的非首 ability）
newRoleSecond: createGenericResolver('newRole', 1),
```

### 独立 Resolver

**新建文件**: `packages/game-engine/src/resolvers/<newRole>.ts`

```typescript
/**
 * NewRole Resolver — [角色名]行动校验 + 结果计算
 *
 * 纯函数，不含 IO。
 */

import type { ResolverFn } from './types';

export const newRoleActionResolver: ResolverFn = (context, input) => {
  const target = input.target ?? input.targets?.[0] ?? null;

  if (target === null || target === undefined) {
    return { valid: true, result: {} };
  }

  if (!context.players.has(target)) {
    return { valid: false, rejectReason: 'TARGET_NOT_FOUND' };
  }

  // 角色特有逻辑...

  return {
    valid: true,
    result: {
      /* ... */
    },
  };
};
```

### 步骤 4 — 音频生成

**命名**: camelCase roleId → snake_case（`wolfQueen` → `wolf_queen`）

1. 在 `scripts/generate_audio_edge_tts.py` 中添加旁白文案：
   - `BEGIN_TEXT["<snake_case>"]` — `"XX请睁眼，请[行动描述]。"`
   - `END_TEXT["<snake_case>"]` — `"XX请闭眼。"`
2. **自动执行**生成命令（需 `.venv` 已激活）：
   ```bash
   python3 scripts/generate_audio_edge_tts.py --only <snake_case_key>
   ```
3. 确认 `assets/audio/<snake_case>.mp3` 和 `assets/audio_end/<snake_case>.mp3` 已生成。

**默认参数**: voice=`zh-CN-YunjianNeural` / pitch=`-20Hz` / rate=`-20%` / volume=`+100%` / boost=`10dB`

### 注册音频

**文件**: `src/services/infra/audio/audioRegistry.ts`

```typescript
newRole: {
  begin: require('../../../../assets/audio/new_role.mp3'),
  end: require('../../../../assets/audio_end/new_role.mp3'),
},
```

多步骤角色第二步在 `STEP_AUDIO` 中注册。查找链：`AUDIO_REGISTRY[roleId]` → `SEER_LABEL_AUDIO` → `STEP_AUDIO[audioKey]`。

### 步骤 6b — 角色徽章生成

**方式 A**: 用户提供现成 PNG → 跳到「放置与注册」。

**方式 B**: AI 文生图生成。

**工具**: 豆包 AI 文生图（或其他支持透明背景的 AI 工具）

**设置**: 1:1 正方形 / 24-30 步 / CFG 8-10 / DPM++ 2M Karras / 无模板

**Prompt** = 通用前缀 + 角色特征描述（30~80 字）

通用前缀（所有角色共用）：

```
狼人杀官方卡牌插画，蒂姆·波顿式暗黑怪诞童话风格，美式复古手绘插画，铅笔手绘松弛线条，水彩晕染上色，做旧粗糙纸张纹理，画面带细腻颗粒噪点，夸张变形的人物造型，长脸尖下巴，戏剧化的五官与肢体动作，粗粝手绘排线做阴影，暗黑诡异又诙谐的氛围感，高清细节，手绘质感拉满，PNG格式透明背景，alpha通道透明，纯透明无背景，无任何底色、场景、环境元素，背景完全空白透明，1:1正方形画幅，居中构图，半身像紧凑裁切，单个人物主体占画面80%，所有人物尺寸比例统一。
```

负面 Prompt（所有角色共用）：

```
文字、水印、logo、签名、多余边框、画框、相框、模糊、低画质、低分辨率、变形、比例失调、五官扭曲、多余肢体、缺手指、多手指、Q版、萌系、二次元动漫、真实照片、3D渲染、平滑数字绘画、赛璐珞上色、霓虹色、赛博朋克、高饱和荧光色、任何背景、底色、纯色背景、渐变背景、纸张背景、场景背景、环境背景、纹理背景、白色背景、黑色背景、带背景的画面、画面杂色、主体边缘白边、干净光滑的画面、无纹理、矢量图、线条僵硬、画面过曝、画面过暗、元素堆砌
```

根据角色特征编写 30~80 字的角色描述追加到通用前缀后面。参考已有角色 prompt 见 `docs/avatar-generation-prompts.md`。

**放置与注册**：

1. 原图保存到 `assets/avatars/raw/<roleId>.png`（透明背景 RGBA PNG）
2. 运行 `python3 scripts/process_avatars.py` 自动生成：
   - `assets/badges/png/512/role_<roleId>.png`（512px badge）
   - `assets/avatars/web/<roleId>.webp`（512px WebP avatar）
   - `assets/badges/web/role_<roleId>.webp`（128px WebP badge thumbnail）
3. `src/utils/roleBadges.ts` → `BADGE_MAP` 添加 native badge import
4. `src/utils/roleBadges.web.ts` → `BADGE_MAP` 添加 web badge import
5. `scripts/badge-config.mjs` → `EMOJI_MAP` 添加 `roleId: [folderName, fileName, hasSkinTone]` 映射（Fluent Emoji 3D 资源）
6. `packages/game-engine/src/growth/rewardCatalog.ts` → `HAND_DRAWN_AVATAR_IDS` 按字母序插入 roleId
7. `packages/game-engine/src/growth/rewardCatalog.ts` → `AVATAR_RARITY` 按稀有度区块插入（`legendary` / `epic`）
8. `src/utils/avatarImages.ts` → 添加 raw PNG import + badge PNG thumbnail import + `AVATAR_IMAGE_MAP` + `AVATAR_THUMB_MAP` 条目
9. `src/utils/avatarImages.web.ts` → 添加 WebP avatar import + WebP badge thumbnail import + `AVATAR_IMAGE_MAP` + `AVATAR_THUMB_MAP` 条目
10. 将生成 prompt 追加到 `docs/avatar-generation-prompts.md`（编号顺延，按阵营区块插入）

---

## 条件步骤参考

| 条件步骤             | 适用场景                    | 关键文件                                                          | 说明                                                            |
| -------------------- | --------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------- |
| C1 Reveal            | 查验类                      | `schema.types.ts` RevealKind + resolver `result: { checkResult }` | 使用 `resolveRoleForChecks()`                                   |
| C2 死亡计算          | 守护/连带/免疫类            | `deathCalcRole` 字段 + DeathCalculator                            | 新增 `deathCalcRole` 到 spec                                    |
| C3 Confirm 管道      | confirm 类                  | 见「Confirm 步骤完整管道」节                                      | protocol types + schema.types + confirmContext + promptExecutor |
| C4 新 GameState 字段 | 需要在 GameState 中存新信息 | `protocol/types.ts` + `normalize.ts`                              | 编译守卫                                                        |
| C5 预设模板          | 含新角色的预设板子          | `packages/game-engine/src/models/templates/presetTemplates.ts`    | 使用 new-board skill                                            |
| C6 E2E               | 按行为分类                  | `e2e/specs/night-roles-*.spec.ts`                                 | 使用 new-e2e-spec skill                                         |
| C7 multiChooseSeat   | 多目标选择                  | abilities target.count.max > 1 + resolver 读 `input.targets`      |                                                                 |
| C8 groupConfirm      | 全员确认                    | 第二步 nightStep + `STEP_AUDIO` 注册                              |                                                                 |
| C9 多步骤            | 同角色多 nightSteps 条目    | 每步各需 resolver + 音频                                          | 第二步 `audioKey` 通常 !== roleId                               |
| C10 免疫声明         | 免疫狼刀/毒药等             | `immunities: [{ kind: 'wolfAttack' }]` + DeathCalculator          |                                                                 |

---

## 参考角色索引

| 行动类型             | 参考角色                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `chooseSeat`（查验） | seer, mirrorSeer, drunkSeer, psychic, gargoyle, pureWhite, wolfWitch                                             |
| `chooseSeat`（效果） | guard, nightmare, dreamcatcher, wolfQueen, silenceElder, votebanElder, crow                                      |
| `chooseSeat`（学习） | wolfRobot                                                                                                        |
| `chooseSeat`（选人） | slacker, wildChild, shadow                                                                                       |
| `confirm`（开枪）    | hunter, darkWolfKing                                                                                             |
| `confirm`（阵营）    | avenger                                                                                                          |
| `compound`           | witch                                                                                                            |
| `swap`               | magician                                                                                                         |
| `wolfVote`           | wolf                                                                                                             |
| `multiChooseSeat`    | piper, cupid                                                                                                     |
| `groupConfirm`       | piper（第二步）, cupid（第二步）, awakenedGargoyle（第二步）                                                     |
| `chooseCard`         | thief, treasureMaster                                                                                            |
| 无夜晚行动           | villager, idiot, knight, witcher, wolfKing, bloodMoon, spiritKnight, graveyardKeeper, dancer, masquerade, warden |

---

## Key Constraints

以下违反会导致合约测试失败（必须逐条检查）：

- `nightSteps[*].stepId` 全局唯一（即 SchemaId）
- `nightSteps[*].audioKey` 默认 **===** `roleId`（例外：多步骤非首步）
- `nightSteps[*].actionKind` **===** 对应 `abilities[*].actionKind`
- 有 `nightSteps` 的角色的 `stepId` **必须**出现在 `plan.ts` NIGHT_STEP_ORDER_INTERNAL 中
- Resolver **必须**在 `resolvers/index.ts` 的 `RESOLVERS` registry 中注册
- 新增 `GameState` 字段**必须**同步 `normalizeState`
- `shortName` 全局唯一（单字）
- `bottomActionText` ≤ 4 汉字
- `AUDIO_REGISTRY` 必须覆盖所有 nightSteps 中的 unique `audioKey`
- `TargetConstraint` 用枚举引用，不用字符串
- 狼阵营**必须**有 `recognition` 字段
- `confirm` 类角色: `abilities[].effects[].confirmType` 必须与 `nightSteps[].ui.confirmStatusUi.kind` 语义对应

## Quality Checklist

实现完成后逐项确认：

- [ ] ROLE_SPECS 条目完整（id/displayName/shortName/emoji/faction/team/description/structuredDescription/tags/abilities/nightSteps）
- [ ] description 符合文案规范（术语统一、无裁判话术、无句号）
- [ ] structuredDescription 按语义正确分类
- [ ] abilities effects kind 正确，constraints 正确
- [ ] nightSteps ui 字段齐全，confirmStatusUi（若 confirm 类）正确
- [ ] plan.ts 步骤顺序正确
- [ ] Resolver 注册到 resolvers/index.ts
- [ ] confirm 管道贯穿（若适用）：protocol types + schema.types + confirmContext + promptExecutor
- [ ] 音频生成 + 注册到 AUDIO_REGISTRY
- [ ] ConfigScreen 分组已添加
- [ ] 合约测试计数已更新
- [ ] `README.md` + `README.en.md` 角色数量/阵营计数/角色列表已更新
- [ ] `docs/NIGHT1_ROLE_ALIGNMENT_MATRIX.md` 步骤顺序表 + 角色行为矩阵已更新
- [ ] `pnpm run quality` 全绿
