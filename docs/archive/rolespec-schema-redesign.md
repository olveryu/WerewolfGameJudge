# RoleSpec Schema 重设计：Data-Driven 角色定义系统

> 设计者视角：Blood on the Clocktower / TFT / Hearthstone 引擎架构经验
> 目标：让 spec 成为角色行为的唯一真相来源

---

## 第一部分：现状深度剖析

### 1.1 Spec vs Handler 行为分布

当前系统分三层表驱动：`ROLE_SPECS`（角色固有属性）、`SCHEMAS`（行动输入协议）、`NIGHT_STEPS`（步骤顺序）。但这三层只覆盖了**展示属性**和**输入约束**，实际的**行为规则**（查验结果如何计算、死亡如何判定、联动如何触发）全部散落在 resolver/engine 代码中。

| 角色             | spec 声明的行为                                                              | handler 独有的行为                                                                                    | data-driven % |
| ---------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------- |
| villager         | faction, team, night1=false                                                  | 无                                                                                                    | 100%          |
| seer             | faction, team, night1=true, constraints=[NotSelf]                            | 查验结果计算（getSeerCheckResultForTeam）、swap-aware 身份解析                                        | 40%           |
| mirrorSeer       | 同 seer + displayAs='seer'                                                   | 查验结果**反转**逻辑                                                                                  | 35%           |
| drunkSeer        | 同 seer + displayAs='seer'                                                   | 查验结果**50%随机**逻辑                                                                               | 30%           |
| witch            | faction, team, night1=true                                                   | **compound 双步骤**（救/毒）、canSave/canPoison 状态管理、自救限制、同夜不能救+毒、wolf kill 目标解析 | 15%           |
| hunter           | faction, team, night1=true                                                   | confirm UI、canShoot 计算（被毒=不能开枪）                                                            | 30%           |
| guard            | faction, team, night1=true                                                   | 守护目标写入 guardedSeat                                                                              | 50%           |
| idiot            | faction, team, night1=false                                                  | 无夜间行为                                                                                            | 100%          |
| knight           | faction, team, night1=false                                                  | 无夜间行为                                                                                            | 100%          |
| magician         | faction, team, night1=true                                                   | swap 类型校验（必须2人、不能重复）                                                                    | 40%           |
| witcher          | faction, team, immuneToPoison                                                | 无夜间行为（Night-1 scope）                                                                           | 100%          |
| psychic          | faction, team, constraints=[NotSelf]                                         | 身份查验（resolveRoleForChecks）                                                                      | 40%           |
| dreamcatcher     | faction, team, constraints=[NotSelf]                                         | dreamingSeat 写入                                                                                     | 50%           |
| graveyardKeeper  | faction, team, night1=false                                                  | 无夜间行为                                                                                            | 100%          |
| pureWhite        | faction, team, constraints=[NotSelf]                                         | 身份查验                                                                                              | 40%           |
| dancer           | faction, team, immuneToPoison                                                | 无夜间行为（Night-1 scope）                                                                           | 100%          |
| silenceElder     | faction, team                                                                | silencedSeat 写入                                                                                     | 50%           |
| votebanElder     | faction, team                                                                | votebannedSeat 写入                                                                                   | 50%           |
| wolf             | faction, team, wolfMeeting                                                   | 投票聚合、放弃袭击/撤回哨兵值、免疫角色过滤                                                           | 20%           |
| wolfQueen        | faction, team, wolfMeeting, immuneToWolfKill                                 | charmTarget 写入、constraints 校验                                                                    | 45%           |
| wolfKing         | faction, team, wolfMeeting                                                   | 无夜间行为                                                                                            | 100%          |
| darkWolfKing     | faction, team, wolfMeeting                                                   | confirm UI、canShoot 计算                                                                             | 30%           |
| nightmare        | faction, team, wolfMeeting                                                   | blockedSeat 写入、**team===Wolf 则 wolfKillDisabled**                                                 | 30%           |
| gargoyle         | faction, team, wolfMeeting(不互认)                                           | 身份查验                                                                                              | 40%           |
| awakenedGargoyle | faction, team, wolfMeeting                                                   | 转化目标校验（AdjacentToWolfFaction）、convertedSeat 写入、groupConfirm                               | 35%           |
| bloodMoon        | faction, team, wolfMeeting                                                   | 无夜间行为                                                                                            | 100%          |
| wolfRobot        | faction, team, wolfMeeting(不互认)                                           | 学习目标身份解析、**hunter 特判**（canShootAsHunter）、disguise context 写入                          | 20%           |
| wolfWitch        | faction, team, wolfMeeting                                                   | 身份查验 + NotWolfFaction 约束                                                                        | 40%           |
| spiritKnight     | faction, team, wolfMeeting, immuneToWolfKill, immuneToPoison, reflectsDamage | 无夜间行为（被动）                                                                                    | 100%          |
| masquerade       | faction, team, wolfMeeting(不互认), immuneToPoison                           | 无夜间行为（Night-1 scope）                                                                           | 100%          |
| warden           | faction, team, wolfMeeting                                                   | 无夜间行为（Night-1 scope）                                                                           | 100%          |
| slacker          | faction, team                                                                | 选榜样（canSkip=false + nightmare 例外）                                                              | 45%           |
| wildChild        | faction, team                                                                | 选榜样（同 slacker）                                                                                  | 45%           |
| piper            | faction, team                                                                | 多目标催眠（min/max targets）、去重写入 hypnotizedSeats                                               | 40%           |
| shadow           | faction, team                                                                | 模仿目标选择、**avenger 特判**（绑定=Team.Third）、阵营对立计算                                       | 20%           |
| avenger          | faction, team                                                                | confirm UI（faction 三态）                                                                            | 40%           |

**总体统计**：

- 无夜间行为的角色（12 个）：100% data-driven（spec 已完整描述）
- 有夜间行为的角色（24 个）：平均 ~35% data-driven
- **全局加权**：约 **55%** 由 spec 驱动，**45%** 由 handler 独占

### 1.2 硬编码地图

| 文件                                                  | 代码片段                                                                         | 原因（spec 缺什么）                           |
| ----------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------- |
| `resolvers/types.ts:247`                              | `effectiveRole === 'wolfRobot'`                                                  | spec 缺少 "伪装身份" 能力声明                 |
| `resolvers/wolfRobot.ts:103`                          | `effectiveRoleId === 'hunter'`                                                   | spec 缺少 "学习到特定角色时的额外效果" 声明   |
| `resolvers/shadow.ts:54`                              | `targetRoleId === 'avenger'`                                                     | spec 缺少 "目标角色的互动规则" 声明           |
| `engine/handlers/confirmContext.ts:48`                | `role === 'avenger'`                                                             | spec 缺少 "确认类型" 声明（shoot vs faction） |
| `engine/handlers/confirmContext.ts:35`                | `CONFIRM_STEP_ROLE` 硬编码映射                                                   | spec 缺少 "哪些角色需要 confirm context" 声明 |
| `engine/handlers/revealPayload.ts:101`                | `learnedRoleId === 'hunter'`                                                     | spec 缺少 "学习结果触发 gate" 声明            |
| `engine/handlers/gameControlHandler.ts:110`           | `r === 'seer'`                                                                   | spec 缺少 "seer-like 角色分组" 声明           |
| `engine/handlers/gameControlHandler.ts:111`           | `spec.displayAs === 'seer'`                                                      | 用 displayAs 推断 seer 家族，不够显式         |
| `engine/handlers/wolfRobotHunterGateHandler.ts:36-37` | `learnedRoleId === 'hunter'` + `role === 'wolfRobot'`                            | spec 缺少触发 gate 条件                       |
| `protocol/types.ts:235` (注释)                        | `wolfRobotReveal.learnedRoleId === 'hunter'`                                     | 同上                                          |
| `resolvers/nightmare.ts`                              | `targetSpec.team === Team.Wolf → wolfKillDisabled`                               | spec 缺少 "恐惧效果的阵营分支后果"            |
| `engine/DeathCalculator.ts`                           | `RoleSeatMap` 中硬编码 wolfQueen/dreamcatcher/seer/psychic/pureWhite/witch/guard | spec 缺少 "死亡计算中参与的角色效果" 声明     |
| `models/Template.ts:461`                              | `r === 'wolf'` 计数                                                              | spec 缺少 "基础狼人" 分类标签                 |

### 1.3 新增角色成本审计

以最近新增的 **avenger（复仇者）** 为例：

| 步骤                    | 文件                            | 修改行数                  |
| ----------------------- | ------------------------------- | ------------------------- |
| 1. ROLE_SPECS           | `specs.ts`                      | +25                       |
| 2. SCHEMAS              | `schemas.ts`                    | +15 (avengerConfirm)      |
| 3. NIGHT_STEPS          | `nightSteps.ts`                 | +5                        |
| 4. Resolver             | `resolvers/avenger.ts` (新文件) | +8                        |
| 5. Shadow resolver 联动 | `resolvers/shadow.ts`           | +20 (avenger 特判)        |
| 6. Confirm context      | `confirmContext.ts`             | +15 (faction 三态)        |
| 7. Protocol types       | `protocol/types.ts`             | +8 (FactionConfirmStatus) |
| 8. Schema types         | `schema.types.ts`               | +8 (FactionConfirmUi)     |
| 9. Reducer              | `nightActionReducers.ts`        | +5                        |
| 10. Resolver index      | `resolvers/index.ts`            | +1                        |
| 11. Tests               | 多个测试文件                    | +200                      |
| **合计**                | **11 文件**                     | **~310 行**               |

**理想目标对比**：

|                | 现在                                          | 理想            |
| -------------- | --------------------------------------------- | --------------- |
| 需修改文件数   | 11                                            | 1-2             |
| 需新增文件数   | 1 (resolver)                                  | 0               |
| 总代码行数     | ~310                                          | ~30 (spec 定义) |
| 需要了解的概念 | resolver/schema/step/confirm/protocol/reducer | spec 对象字段   |

---

## 第二部分：新架构设计

### 2.1 核心设计理念

#### 角色 = 能力的组合

每个角色是以下原子构件（building blocks）的声明式组合：

- **Abilities**（能力）：主动/被动/触发，定义角色"能做什么"
- **Immunities**（免疫）：定义角色"不受什么影响"
- **Recognition**（互认）：定义角色"能看到谁"
- **Resources**（资源）：定义角色"拥有什么消耗品"
- **Display**（展示）：定义角色"长什么样"

#### 引擎消费 spec 的方式：Registry + Interpreter

不采用 ECS（过度工程）也不采用 Visitor（难扩展），而是：

1. **Spec Registry**：`ROLE_SPECS` 保持为 `as const satisfies` 常量表，类型自动推导
2. **Ability Interpreter**：引擎运行时遍历角色的 `abilities` 数组，按 `kind` 分发到对应的**通用处理器**（Generic Processor）
3. **Effect Pipeline**：每个能力的 `effects` 描述"产生什么"，引擎的 Effect Pipeline 按顺序应用

#### 声明式 vs 命令式的平衡线

- **80%+ 声明式**：chooseSeat + check result / write slot / multi-target 等标准模式
- **< 20% 自定义 handler**：仅 witch（compound 双步骤状态机）、shadow（跨角色联动计算）需要自定义逻辑
- 自定义 handler 通过 `customResolver` 字段关联，spec 仍然声明能力元数据

### 2.2 完整 TypeScript 类型定义

```typescript
// =============================================================================
// packages/game-engine/src/models/roles/spec/v2/ability.types.ts
// 能力系统核心类型
// =============================================================================

import type { Faction, Team } from '../types';

// ---------------------------------------------------------------------------
// Target Constraints
// ---------------------------------------------------------------------------

export enum TargetConstraint {
  NotSelf = 'NotSelf',
  NotWolfFaction = 'NotWolfFaction',
  NotSameAsPreviousNight = 'NotSameAsPreviousNight',
  AdjacentToWolfFaction = 'AdjacentToWolfFaction',
}

/** How many targets the ability requires */
export interface TargetCount {
  readonly min: number;
  readonly max: number;
}

export interface TargetRule {
  readonly count: TargetCount;
  readonly constraints: readonly TargetConstraint[];
}

// ---------------------------------------------------------------------------
// Effects (what an ability produces)
// ---------------------------------------------------------------------------

/**
 * Check effect — 查验类：返回阵营或角色名
 *
 * `resultType`:
 * - 'faction': 返回 '好人'/'狼人'（seer family）
 * - 'identity': 返回具体角色名称（psychic, gargoyle, pureWhite, wolfWitch, wolfRobot）
 */
export interface CheckEffect {
  readonly kind: 'check';
  readonly resultType: 'faction' | 'identity';
  /**
   * Result transformer — 查验结果变换器
   * - 'identity': 原样返回（seer, psychic, gargoyle...）
   * - 'invert': 反转好人/狼人（mirrorSeer）
   * - 'random': 50% 概率反转（drunkSeer）
   */
  readonly transformer?: 'identity' | 'invert' | 'random';
}

/**
 * WriteSlot effect — 写入夜间结果槽位
 *
 * 用于把行动结果写入 CurrentNightResults 的特定字段。
 * 例如 guard → guardedSeat, dreamcatcher → dreamingSeat
 */
export interface WriteSlotEffect {
  readonly kind: 'writeSlot';
  /** The field name in CurrentNightResults to write to */
  readonly slot: string;
}

/**
 * Block effect — 封锁目标技能
 * nightmare 的核心效果
 */
export interface BlockEffect {
  readonly kind: 'block';
  /** When blocking a wolf-team target, also disable wolf kill */
  readonly disablesWolfKillOnWolfTarget?: boolean;
}

/**
 * Charm effect — 魅惑目标
 * wolfQueen 的核心效果
 */
export interface CharmEffect {
  readonly kind: 'charm';
}

/**
 * Swap effect — 交换两个目标的号码牌
 * magician 的核心效果
 */
export interface SwapEffect {
  readonly kind: 'swap';
}

/**
 * Learn effect — 学习目标角色的身份和技能
 * wolfRobot 的核心效果
 */
export interface LearnEffect {
  readonly kind: 'learn';
  /** Role IDs that trigger a gate when learned */
  readonly gateTriggersOnRoles?: readonly string[];
}

/**
 * ChooseIdol effect — 选择榜样
 * slacker / wildChild 的核心效果
 */
export interface ChooseIdolEffect {
  readonly kind: 'chooseIdol';
}

/**
 * Mimic effect — 模仿目标
 * shadow 的核心效果
 */
export interface MimicEffect {
  readonly kind: 'mimic';
  /** Computes faction for a paired role based on mimic target */
  readonly pairedRole?: string;
}

/**
 * Hypnotize effect — 催眠多目标
 * piper 的核心效果
 */
export interface HypnotizeEffect {
  readonly kind: 'hypnotize';
}

/**
 * Convert effect — 转化目标阵营
 * awakenedGargoyle 的核心效果
 */
export interface ConvertEffect {
  readonly kind: 'convert';
}

/**
 * GroupReveal effect — 全员确认信息
 * piperHypnotizedReveal / awakenedGargoyleConvertReveal
 */
export interface GroupRevealEffect {
  readonly kind: 'groupReveal';
}

/**
 * Confirm effect — 确认类（查看状态）
 * hunter/darkWolfKing/avenger confirm
 */
export interface ConfirmEffect {
  readonly kind: 'confirm';
  readonly confirmType: 'shoot' | 'faction';
}

/**
 * All possible effects (discriminated by `kind`)
 */
export type AbilityEffect =
  | CheckEffect
  | WriteSlotEffect
  | BlockEffect
  | CharmEffect
  | SwapEffect
  | LearnEffect
  | ChooseIdolEffect
  | MimicEffect
  | HypnotizeEffect
  | ConvertEffect
  | GroupRevealEffect
  | ConfirmEffect;

// ---------------------------------------------------------------------------
// Abilities (what a role can do)
// ---------------------------------------------------------------------------

/** When the ability activates */
export type AbilityTiming = 'night' | 'day' | 'onDeath' | 'onExile' | 'passive';

/** The action kind for UI / input handling */
export type ActionKind =
  | 'chooseSeat'
  | 'multiChooseSeat'
  | 'wolfVote'
  | 'compound'
  | 'swap'
  | 'confirm'
  | 'groupConfirm';

/**
 * Active ability — 需要玩家主动操作
 *
 * 夜间/白天选目标，产生效果
 */
export interface ActiveAbility {
  readonly type: 'active';
  readonly timing: AbilityTiming;
  /** Action kind for UI dispatch */
  readonly actionKind: ActionKind;
  /** Target selection rules (undefined = no target needed, e.g. confirm) */
  readonly target?: TargetRule;
  /** Can the player skip this ability? */
  readonly canSkip: boolean;
  /** Effects produced when ability is used */
  readonly effects: readonly AbilityEffect[];
  /** Night-1 specific: is this ability active during night 1? */
  readonly activeOnNight1: boolean;
  /**
   * Reference to custom resolver (only for abilities that cannot be
   * expressed purely declaratively). Engine falls back to generic
   * processor when undefined.
   */
  readonly customResolver?: string;
}

/**
 * Passive ability — 始终生效，无需操作
 *
 * 修改检查结果/伤害计算/死亡判定等
 */
export interface PassiveAbility {
  readonly type: 'passive';
  /** What this passive does */
  readonly effect: PassiveEffectKind;
}

export type PassiveEffectKind =
  | 'immuneToWolfKill'
  | 'immuneToPoison'
  | 'immuneToNightDamage'
  | 'reflectsDamage'
  | 'disguiseAsSeer';

/**
 * Triggered ability — 事件触发
 *
 * onDeath / onExile / onChecked 等
 */
export interface TriggeredAbility {
  readonly type: 'triggered';
  readonly trigger: TriggerCondition;
  readonly effect: TriggeredEffectKind;
}

export type TriggerCondition =
  | 'onDeath'
  | 'onExile'
  | 'onDayExile'
  | 'onCheckedByNonWolf'
  | 'onPoisoned'
  | 'onSelfDeath';

export type TriggeredEffectKind =
  | 'shoot' // hunter / darkWolfKing: 出局开枪
  | 'linkDeath' // wolfQueen: 出局时 charmed target 随之出局
  | 'linkDreamDeath' // dreamcatcher: 自身出局时 dream target 出局
  | 'flipCard' // idiot: 被投票放逐时翻牌
  | 'selfDestruct' // wolfKing: 白天自爆带走一人
  | 'reflectDamage' // spiritKnight: 被查验/毒杀时反伤
  | 'stab'; // avenger: 出局刺杀

export type Ability = ActiveAbility | PassiveAbility | TriggeredAbility;

// ---------------------------------------------------------------------------
// Immunities
// ---------------------------------------------------------------------------

export type ImmunityKind =
  | 'wolfAttack' // 免疫狼人袭击
  | 'poison' // 免疫女巫毒药
  | 'nightDamage' // 免疫所有夜间伤害
  | 'seerCheck'; // 免疫预言家查验（查验结果被修改）

export interface Immunity {
  readonly kind: ImmunityKind;
  /** Conditional immunity (e.g., dancer immune only when self is in dance pool) */
  readonly condition?: string;
}

// ---------------------------------------------------------------------------
// Recognition (互认)
// ---------------------------------------------------------------------------

export interface RecognitionConfig {
  /** Can this role see other wolves during wolf meeting? */
  readonly canSeeWolves: boolean;
  /** Does this role participate in the wolf kill vote? */
  readonly participatesInWolfVote: boolean;
  /**
   * Acts solo during nightmare phase (cannot see wolf teammates).
   * Nightmare sees all seats equally.
   */
  readonly actsSolo?: boolean;
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

export type ResourceKind = 'antidote' | 'poison' | 'bullet' | 'mask' | 'flipChance';

export interface Resource {
  readonly kind: ResourceKind;
  /** Total uses (-1 = unlimited) */
  readonly uses: number;
  /** Refreshes each night? */
  readonly refreshPerNight: boolean;
}

// ---------------------------------------------------------------------------
// UI Display
// ---------------------------------------------------------------------------

export interface RoleLabel {
  readonly text: string;
  readonly color?: string;
}

/**
 * Structured description for card rendering (unchanged from v1).
 */
export interface RoleDescription {
  readonly skill?: string;
  readonly passive?: string;
  readonly trigger?: string;
  readonly restriction?: string;
  readonly special?: string;
  readonly winCondition?: string;
}

/**
 * UI metadata for action schemas (prompts, buttons, dialog text).
 * Separated from behavior to keep spec JSON-serializable.
 */
export interface ActionUi {
  readonly prompt?: string;
  readonly confirmTitle?: string;
  readonly confirmText?: string;
  readonly bottomActionText?: string;
  readonly revealTitlePrefix?: string;
  readonly revealResultFormat?: 'factionCheck' | 'roleName';
  readonly emptyVoteText?: string;
  readonly voteConfirmTemplate?: string;
  readonly emptyVoteConfirmTemplate?: string;
  readonly firstTargetTitle?: string;
  readonly firstTargetPromptTemplate?: string;
  readonly emptyKillTitle?: string;
  readonly confirmStatusUi?: ConfirmStatusUi;
  readonly hypnotizedText?: string;
  readonly notHypnotizedText?: string;
  readonly confirmButtonText?: string;
  readonly hunterGatePrompt?: string;
  readonly hunterGateButtonText?: string;
  readonly hunterGateDialogTitle?: string;
  readonly hunterGateCanShootText?: string;
  readonly hunterGateCannotShootText?: string;
  readonly cannotSavePrompt?: string;
  readonly promptTemplate?: string;
  readonly blockedTitle?: string;
  readonly blockedMessage?: string;
  readonly blockedSkipButtonText?: string;
  readonly blockedEmptyVoteText?: string;
}

export interface ShootConfirmStatusUi {
  readonly kind: 'shoot';
  readonly statusDialogTitle: string;
  readonly canText: string;
  readonly cannotText: string;
}

export interface FactionConfirmStatusUi {
  readonly kind: 'faction';
  readonly statusDialogTitle: string;
  readonly goodText: string;
  readonly wolfText: string;
  readonly bondedText: string;
}

export type ConfirmStatusUi = ShootConfirmStatusUi | FactionConfirmStatusUi;

// ---------------------------------------------------------------------------
// Meeting Config
// ---------------------------------------------------------------------------

export interface MeetingConfig {
  readonly canSeeEachOther: boolean;
  readonly resolution: 'majority' | 'unanimous';
  readonly allowEmptyVote: boolean;
}

// =============================================================================
// packages/game-engine/src/models/roles/spec/v2/roleSpec.types.ts
// 角色定义核心类型
// =============================================================================

/**
 * Complete Role Specification v2
 *
 * The single source of truth for everything a role IS and DOES.
 * Handler code only fills gaps that cannot be expressed declaratively.
 */
export interface RoleSpecV2 {
  // --- Identity ---
  readonly id: string;
  readonly displayName: string;
  readonly shortName: string;
  readonly emoji: string;
  readonly englishName?: string;

  // --- Classification ---
  readonly faction: Faction;
  readonly team: Team;
  /** Tags for grouping (seerFamily, wolfBase, thirdParty, idol...) */
  readonly tags?: readonly string[];

  // --- Abilities ---
  readonly abilities: readonly Ability[];

  // --- Immunities ---
  readonly immunities?: readonly Immunity[];

  // --- Recognition (wolf meeting) ---
  readonly recognition?: RecognitionConfig;

  // --- Resources ---
  readonly resources?: readonly Resource[];

  // --- Night Action ---
  readonly night1: {
    readonly hasAction: boolean;
  };

  /**
   * Night step definitions for this role.
   * Replaces the separate NIGHT_STEPS + SCHEMAS tables.
   * Array order = step execution order within this role's phase.
   */
  readonly nightSteps?: readonly NightStepDef[];

  // --- Display ---
  readonly description: string;
  readonly structuredDescription?: RoleDescription;
  /** Disguised identity for player-facing UI */
  readonly displayAs?: string;

  // --- Death Calculation Participation ---
  /**
   * Declares how this role participates in death calculation.
   * Replaces hardcoded RoleSeatMap fields.
   */
  readonly deathCalcRole?: DeathCalcRole;
}

/**
 * Night step definition — combines step ordering + schema in one place.
 */
export interface NightStepDef {
  /** Step/schema ID (must be globally unique) */
  readonly stepId: string;
  /** Audio key for this step (defaults to role ID) */
  readonly audioKey?: string;
  /** End audio key (defaults to audioKey) */
  readonly audioEndKey?: string;
  /** Action kind */
  readonly actionKind: ActionKind;
  /** UI metadata */
  readonly ui: ActionUi;
  /** Meeting config (wolfVote only) */
  readonly meeting?: MeetingConfig;
}

/**
 * Death calculation role — declares what role-specific death rules apply.
 */
export type DeathCalcRole =
  | 'wolfQueenLink' // 出局时 charm target 随之出局
  | 'dreamcatcherLink' // 保护 dream target + 出局时 dream target 出局
  | 'checkSource' // 查验类角色（seer/psychic/pureWhite）— 被反伤
  | 'poisonSource' // 毒药类角色（witch）— 被反伤
  | 'guardProtector' // 守卫 — nightmare block 判定
  | 'reflectTarget'; // 反伤目标（spiritKnight）
```

### 2.3 用新 Schema 重写全部 36 个角色

```typescript
// =============================================================================
// packages/game-engine/src/models/roles/spec/v2/specs.ts
// 全部 36 角色声明式定义
// =============================================================================

import type { RoleSpecV2 } from './roleSpec.types';
import { Faction, Team } from '../types';
import { TargetConstraint } from './ability.types';

export const ROLE_SPECS_V2 = {
  // ===================================================================
  // VILLAGER FACTION (3)
  // ===================================================================

  villager: {
    id: 'villager',
    displayName: '平民',
    shortName: '民',
    emoji: '👤',
    faction: Faction.Villager,
    team: Team.Good,
    description: '没有特殊技能，依靠推理和投票帮助好人阵营获胜',
    structuredDescription: {
      passive: '没有特殊技能，依靠推理和投票帮助好人阵营获胜',
    },
    night1: { hasAction: false },
    abilities: [],
  },

  mirrorSeer: {
    id: 'mirrorSeer',
    displayName: '灯影预言家',
    shortName: '灯',
    emoji: '🪞',
    faction: Faction.Villager,
    team: Team.Good,
    description:
      '每晚可查验一名玩家的阵营，但结果与真实阵营相反；自身不知真实身份，以预言家身份示人',
    structuredDescription: {
      skill: '每晚可查验一名玩家的阵营，但结果与真实阵营相反',
      passive: '自身不知真实身份，以预言家身份示人',
    },
    tags: ['seerFamily'],
    night1: { hasAction: true },
    displayAs: 'seer',
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
        effects: [{ kind: 'check', resultType: 'faction', transformer: 'invert' }],
        activeOnNight1: true,
      },
      {
        type: 'passive',
        effect: 'disguiseAsSeer',
      },
    ],
    nightSteps: [
      {
        stepId: 'mirrorSeerCheck',
        audioKey: 'mirrorSeer',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认查验',
          prompt: '请选择要查验的玩家，如不使用请点击「不用技能」',
          confirmText: '确定要查验该玩家吗？',
          revealTitlePrefix: '查验结果',
          revealResultFormat: 'factionCheck',
          bottomActionText: '不用技能',
        },
      },
    ],
  },

  drunkSeer: {
    id: 'drunkSeer',
    displayName: '酒鬼预言家',
    shortName: '酒',
    emoji: '🍺🔮',
    faction: Faction.Villager,
    team: Team.Good,
    description:
      '每晚可查验一名玩家的阵营，但结果随机（50%正确/50%错误）；自身不知真实身份，以预言家身份示人',
    structuredDescription: {
      skill: '每晚可查验一名玩家的阵营，但结果随机（50%正确/50%错误）',
      passive: '自身不知真实身份，以预言家身份示人',
    },
    tags: ['seerFamily'],
    night1: { hasAction: true },
    displayAs: 'seer',
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
        effects: [{ kind: 'check', resultType: 'faction', transformer: 'random' }],
        activeOnNight1: true,
      },
      {
        type: 'passive',
        effect: 'disguiseAsSeer',
      },
    ],
    nightSteps: [
      {
        stepId: 'drunkSeerCheck',
        audioKey: 'drunkSeer',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认查验',
          prompt: '请选择要查验的玩家，如不使用请点击「不用技能」',
          confirmText: '确定要查验该玩家吗？',
          revealTitlePrefix: '查验结果',
          revealResultFormat: 'factionCheck',
          bottomActionText: '不用技能',
        },
      },
    ],
  },

  // ===================================================================
  // GOD FACTION (15)
  // ===================================================================

  seer: {
    id: 'seer',
    displayName: '预言家',
    shortName: '预',
    emoji: '🔮',
    faction: Faction.God,
    team: Team.Good,
    description: '每晚可查验一名玩家的阵营，获知其是好人还是狼人',
    structuredDescription: {
      skill: '每晚可查验一名玩家的阵营，获知其是好人还是狼人',
    },
    tags: ['seerFamily'],
    night1: { hasAction: true },
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
        effects: [{ kind: 'check', resultType: 'faction', transformer: 'identity' }],
        activeOnNight1: true,
      },
    ],
    deathCalcRole: 'checkSource',
    nightSteps: [
      {
        stepId: 'seerCheck',
        audioKey: 'seer',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认查验',
          prompt: '请选择要查验的玩家，如不使用请点击「不用技能」',
          confirmText: '确定要查验该玩家吗？',
          revealTitlePrefix: '查验结果',
          revealResultFormat: 'factionCheck',
          bottomActionText: '不用技能',
        },
      },
    ],
  },

  witch: {
    id: 'witch',
    displayName: '女巫',
    shortName: '女',
    emoji: '🧙‍♀️',
    faction: Faction.God,
    team: Team.Good,
    description:
      '拥有一瓶解药和一瓶毒药，每晚可救活被狼人袭击的玩家或毒杀一名玩家；每瓶药限用一次，不能自救',
    structuredDescription: {
      skill: '每晚可救活被狼人袭击的玩家或毒杀一名玩家',
      passive: '拥有一瓶解药和一瓶毒药',
      restriction: '每瓶药限用一次；不能自救',
    },
    night1: { hasAction: true },
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'compound',
        canSkip: true,
        effects: [], // compound 行为由 customResolver 处理
        activeOnNight1: true,
        customResolver: 'witchAction',
      },
    ],
    resources: [
      { kind: 'antidote', uses: 1, refreshPerNight: false },
      { kind: 'poison', uses: 1, refreshPerNight: false },
    ],
    deathCalcRole: 'poisonSource',
    nightSteps: [
      {
        stepId: 'witchAction',
        audioKey: 'witch',
        actionKind: 'compound',
        ui: {
          prompt: '女巫请行动',
          emptyKillTitle: '昨夜无人倒台',
        },
      },
    ],
  },

  hunter: {
    id: 'hunter',
    displayName: '猎人',
    shortName: '猎',
    emoji: '🏹',
    faction: Faction.God,
    team: Team.Good,
    description: '出局时可开枪带走一名玩家；被女巫毒杀则不能开枪',
    structuredDescription: {
      trigger: '出局时可开枪带走一名玩家',
      restriction: '被女巫毒杀则不能开枪',
    },
    night1: { hasAction: true },
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'confirm',
        canSkip: true,
        effects: [{ kind: 'confirm', confirmType: 'shoot' }],
        activeOnNight1: true,
      },
      {
        type: 'triggered',
        trigger: 'onDeath',
        effect: 'shoot',
      },
    ],
    resources: [{ kind: 'bullet', uses: 1, refreshPerNight: false }],
    nightSteps: [
      {
        stepId: 'hunterConfirm',
        audioKey: 'hunter',
        actionKind: 'confirm',
        ui: {
          confirmTitle: '确认行动',
          prompt: '请点击下方按钮查看技能发动状态',
          confirmText: '确定查看猎人发动状态吗？',
          bottomActionText: '发动状态',
          confirmStatusUi: {
            kind: 'shoot',
            statusDialogTitle: '技能状态',
            canText: '猎人可以发动技能',
            cannotText: '猎人不能发动技能',
          },
        },
      },
    ],
  },

  guard: {
    id: 'guard',
    displayName: '守卫',
    shortName: '守',
    emoji: '🛡️',
    faction: Faction.God,
    team: Team.Good,
    description:
      '每晚可守护一名玩家使其免受狼人袭击，不能连续两晚守护同一人；同时被守护和解药救活则仍然出局；无法防御女巫毒药',
    structuredDescription: {
      skill: '每晚可守护一名玩家使其免受狼人袭击',
      restriction: '不能连续两晚守护同一人；同时被守护和解药救活则仍然出局；无法防御女巫毒药',
    },
    night1: { hasAction: true },
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'chooseSeat',
        target: {
          count: { min: 1, max: 1 },
          constraints: [],
        },
        canSkip: true,
        effects: [{ kind: 'writeSlot', slot: 'guardedSeat' }],
        activeOnNight1: true,
      },
    ],
    deathCalcRole: 'guardProtector',
    nightSteps: [
      {
        stepId: 'guardProtect',
        audioKey: 'guard',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认行动',
          prompt: '请选择要守护的玩家，如不使用请点击「不用技能」',
          confirmText: '确定要守护该玩家吗？',
          bottomActionText: '不用技能',
        },
      },
    ],
  },

  idiot: {
    id: 'idiot',
    displayName: '愚者',
    shortName: '白',
    emoji: '🤡',
    faction: Faction.God,
    team: Team.Good,
    description: '被投票放逐时可翻牌免死，此后失去投票权和技能使用权',
    structuredDescription: {
      trigger: '被投票放逐时可翻牌免死',
      restriction: '此后失去投票权和技能使用权',
    },
    night1: { hasAction: false },
    abilities: [
      {
        type: 'triggered',
        trigger: 'onDayExile',
        effect: 'flipCard',
      },
    ],
  },

  knight: {
    id: 'knight',
    displayName: '骑士',
    shortName: '骑',
    emoji: '🗡️',
    faction: Faction.God,
    team: Team.Good,
    description: '白天可翻牌与一名玩家决斗：对方是狼人则对方出局，对方是好人则自身出局',
    structuredDescription: {
      skill: '白天可翻牌与一名玩家决斗：对方是狼人则对方出局，对方是好人则自身出局',
    },
    night1: { hasAction: false },
    abilities: [
      {
        type: 'active',
        timing: 'day',
        actionKind: 'chooseSeat',
        target: {
          count: { min: 1, max: 1 },
          constraints: [TargetConstraint.NotSelf],
        },
        canSkip: true,
        effects: [], // 白天决斗逻辑超出 Night-1 scope
        activeOnNight1: false,
      },
    ],
  },

  magician: {
    id: 'magician',
    displayName: '魔术师',
    shortName: '术',
    emoji: '🎩',
    faction: Faction.God,
    team: Team.Good,
    description: '每晚最先行动，交换两名玩家的号码牌，仅当晚有效',
    structuredDescription: {
      skill: '每晚最先行动，交换两名玩家的号码牌，仅当晚有效',
    },
    night1: { hasAction: true },
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'swap',
        target: {
          count: { min: 2, max: 2 },
          constraints: [],
        },
        canSkip: true,
        effects: [{ kind: 'swap' }],
        activeOnNight1: true,
      },
    ],
    nightSteps: [
      {
        stepId: 'magicianSwap',
        audioKey: 'magician',
        actionKind: 'swap',
        ui: {
          confirmTitle: '确认交换',
          prompt: '请选择要交换的两名玩家，如不使用请点击「不用技能」',
          confirmText: '确定要交换这两名玩家吗？',
          bottomActionText: '不用技能',
          firstTargetTitle: '已选择第一位玩家',
          firstTargetPromptTemplate: '{seat}号，请选择第二位玩家',
        },
      },
    ],
  },

  witcher: {
    id: 'witcher',
    displayName: '猎魔人',
    shortName: '魔',
    emoji: '🔪',
    faction: Faction.God,
    team: Team.Good,
    description:
      '从第二夜起，每晚可选择一名玩家狩猎：对方是狼人则对方次日出局，是好人则自身次日出局；免疫女巫毒药',
    structuredDescription: {
      skill: '从第二夜起，每晚可选择一名玩家狩猎：对方是狼人则对方次日出局，是好人则自身次日出局',
      passive: '免疫女巫毒药',
    },
    night1: { hasAction: false },
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
        effects: [], // Night-2+ only，超出 Night-1 scope
        activeOnNight1: false,
      },
    ],
    immunities: [{ kind: 'poison' }],
  },

  psychic: {
    id: 'psychic',
    displayName: '通灵师',
    shortName: '通',
    emoji: '👁️',
    faction: Faction.God,
    team: Team.Good,
    description: '每晚可查验一名玩家的身份，获知其具体角色名称',
    structuredDescription: {
      skill: '每晚可查验一名玩家的身份，获知其具体角色名称',
    },
    night1: { hasAction: true },
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
        effects: [{ kind: 'check', resultType: 'identity' }],
        activeOnNight1: true,
      },
    ],
    deathCalcRole: 'checkSource',
    nightSteps: [
      {
        stepId: 'psychicCheck',
        audioKey: 'psychic',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认通灵',
          prompt: '请选择要通灵的玩家，如不使用请点击「不用技能」',
          confirmText: '确定要通灵该玩家吗？',
          revealTitlePrefix: '通灵结果',
          revealResultFormat: 'roleName',
          bottomActionText: '不用技能',
        },
      },
    ],
  },

  dreamcatcher: {
    id: 'dreamcatcher',
    displayName: '摄梦人',
    shortName: '摄',
    emoji: '🌙',
    englishName: 'Dreamcatcher',
    faction: Faction.God,
    team: Team.Good,
    description:
      '每晚可选择一名玩家成为梦游者，梦游者不知情且免疫夜间伤害；自身夜间出局则梦游者一并出局，连续两晚被摄梦也会出局',
    structuredDescription: {
      skill: '每晚可选择一名玩家成为梦游者，梦游者不知情且免疫夜间伤害',
      trigger: '自身夜间出局则梦游者一并出局；连续两晚被摄梦也会出局',
    },
    night1: { hasAction: true },
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
        effects: [{ kind: 'writeSlot', slot: 'dreamingSeat' }],
        activeOnNight1: true,
      },
      {
        type: 'triggered',
        trigger: 'onSelfDeath',
        effect: 'linkDreamDeath',
      },
    ],
    deathCalcRole: 'dreamcatcherLink',
    nightSteps: [
      {
        stepId: 'dreamcatcherDream',
        audioKey: 'dreamcatcher',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认行动',
          prompt: '请选择要摄梦的玩家，如不使用请点击「不用技能」',
          confirmText: '确定要摄梦该玩家吗？',
          bottomActionText: '不用技能',
        },
      },
    ],
  },

  graveyardKeeper: {
    id: 'graveyardKeeper',
    displayName: '守墓人',
    shortName: '墓',
    emoji: '⚰️',
    faction: Faction.God,
    team: Team.Good,
    description: '每晚可得知上一个白天被放逐玩家的阵营（好人/狼人）',
    structuredDescription: {
      skill: '每晚可得知上一个白天被放逐玩家的阵营（好人/狼人）',
    },
    night1: { hasAction: false },
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'confirm',
        canSkip: true,
        effects: [{ kind: 'check', resultType: 'faction' }],
        activeOnNight1: false, // No "last day exile" on first night
      },
    ],
  },

  pureWhite: {
    id: 'pureWhite',
    displayName: '纯白之女',
    shortName: '纯',
    emoji: '🤍',
    faction: Faction.God,
    team: Team.Good,
    description: '每晚可查验一名玩家的身份，获知其具体角色名称；从第二夜起，查验到狼人则该狼人出局',
    structuredDescription: {
      skill: '每晚可查验一名玩家的身份，获知其具体角色名称',
      trigger: '从第二夜起，查验到狼人则该狼人出局',
    },
    night1: { hasAction: true },
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
        effects: [{ kind: 'check', resultType: 'identity' }],
        activeOnNight1: true,
      },
    ],
    deathCalcRole: 'checkSource',
    nightSteps: [
      {
        stepId: 'pureWhiteCheck',
        audioKey: 'pureWhite',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认查验',
          prompt: '请选择要查验的玩家，如不使用请点击「不用技能」',
          confirmText: '确定要查验该玩家吗？',
          revealTitlePrefix: '纯白查验',
          revealResultFormat: 'roleName',
          bottomActionText: '不用技能',
        },
      },
    ],
  },

  dancer: {
    id: 'dancer',
    displayName: '舞者',
    shortName: '舞',
    emoji: '💃',
    faction: Faction.God,
    team: Team.Good,
    description:
      '从第二夜起，每晚必须选择三名玩家共舞（可含自身），若三人分属不同阵营则人数少的一方出局；仅当自身参舞时，舞池中三人当夜免疫狼人袭击；免疫女巫毒药',
    structuredDescription: {
      skill:
        '从第二夜起，每晚必须选择三名玩家共舞（可含自身），若三人分属不同阵营则人数少的一方出局',
      passive: '仅当自身参舞时，舞池中三人当夜免疫狼人袭击；免疫女巫毒药',
    },
    night1: { hasAction: false },
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'multiChooseSeat',
        target: {
          count: { min: 3, max: 3 },
          constraints: [],
        },
        canSkip: false,
        effects: [], // Night-2+ only
        activeOnNight1: false,
      },
    ],
    immunities: [{ kind: 'poison' }, { kind: 'wolfAttack', condition: 'selfInDancePool' }],
  },

  silenceElder: {
    id: 'silenceElder',
    displayName: '禁言长老',
    shortName: '禁',
    emoji: '🤫',
    faction: Faction.God,
    team: Team.Good,
    description:
      '每晚可禁言一名玩家，使其次日发言阶段只能用肢体动作表达；不能连续两晚禁言同一人；禁言信息与死讯同时公布',
    structuredDescription: {
      skill: '每晚可禁言一名玩家，使其次日发言阶段只能用肢体动作表达',
      restriction: '不能连续两晚禁言同一人；禁言信息与死讯同时公布',
    },
    night1: { hasAction: true },
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'chooseSeat',
        target: {
          count: { min: 1, max: 1 },
          constraints: [],
        },
        canSkip: true,
        effects: [{ kind: 'writeSlot', slot: 'silencedSeat' }],
        activeOnNight1: true,
      },
    ],
    nightSteps: [
      {
        stepId: 'silenceElderSilence',
        audioKey: 'silenceElder',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认禁言',
          prompt: '请选择要禁言的玩家，如不使用请点击「不用技能」',
          confirmText: '确定要禁言该玩家吗？',
          bottomActionText: '不用技能',
        },
      },
    ],
  },

  votebanElder: {
    id: 'votebanElder',
    displayName: '禁票长老',
    shortName: '票',
    emoji: '🚫',
    faction: Faction.God,
    team: Team.Good,
    description:
      '每晚可禁票一名玩家，使其次日放逐环节不能投票；不能连续两晚禁票同一人；禁票信息与死讯同时公布',
    structuredDescription: {
      skill: '每晚可禁票一名玩家，使其次日放逐环节不能投票',
      restriction: '不能连续两晚禁票同一人；禁票信息与死讯同时公布',
    },
    night1: { hasAction: true },
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'chooseSeat',
        target: {
          count: { min: 1, max: 1 },
          constraints: [],
        },
        canSkip: true,
        effects: [{ kind: 'writeSlot', slot: 'votebannedSeat' }],
        activeOnNight1: true,
      },
    ],
    nightSteps: [
      {
        stepId: 'votebanElderBan',
        audioKey: 'votebanElder',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认禁票',
          prompt: '请选择要禁票的玩家，如不使用请点击「不用技能」',
          confirmText: '确定要禁票该玩家吗？',
          bottomActionText: '不用技能',
        },
      },
    ],
  },

  // ===================================================================
  // WOLF FACTION (13)
  // ===================================================================

  wolf: {
    id: 'wolf',
    displayName: '狼人',
    shortName: '狼',
    emoji: '🐺',
    faction: Faction.Wolf,
    team: Team.Wolf,
    description: '每晚与狼队友共同选择一名玩家进行袭击',
    structuredDescription: {
      skill: '每晚与狼队友共同选择一名玩家进行袭击',
    },
    tags: ['wolfBase'],
    night1: { hasAction: true },
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'wolfVote',
        canSkip: true,
        effects: [], // Wolf vote 结果通过 resolveWolfVotes 聚合
        activeOnNight1: true,
      },
    ],
    nightSteps: [
      {
        stepId: 'wolfKill',
        audioKey: 'wolf',
        actionKind: 'wolfVote',
        meeting: {
          canSeeEachOther: true,
          resolution: 'majority',
          allowEmptyVote: true,
        },
        ui: {
          prompt: '请选择袭击目标',
          confirmTitle: '狼人投票',
          confirmText: '确定袭击该玩家？',
          emptyVoteText: '放弃袭击',
          voteConfirmTemplate: '{wolf} 确定袭击{seat}号？',
          emptyVoteConfirmTemplate: '{wolf} 确定放弃袭击？',
        },
      },
    ],
  },

  wolfQueen: {
    id: 'wolfQueen',
    displayName: '狼美人',
    shortName: '美',
    emoji: '👸🐺',
    faction: Faction.Wolf,
    team: Team.Wolf,
    description:
      '每晚可魅惑一名玩家；白天出局时被魅惑者随之殉情出局，被魅惑者不知情；不能自爆，不能袭击自己',
    structuredDescription: {
      skill: '每晚可魅惑一名玩家',
      restriction: '不能自爆；不能袭击自己',
      trigger: '白天出局时被魅惑者随之殉情出局，被魅惑者不知情',
    },
    night1: { hasAction: true },
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
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
        effects: [{ kind: 'charm' }],
        activeOnNight1: true,
      },
      {
        type: 'triggered',
        trigger: 'onDayExile',
        effect: 'linkDeath',
      },
    ],
    immunities: [{ kind: 'wolfAttack' }],
    deathCalcRole: 'wolfQueenLink',
    nightSteps: [
      {
        stepId: 'wolfQueenCharm',
        audioKey: 'wolfQueen',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认行动',
          prompt: '请选择要魅惑的玩家，如不使用请点击「不用技能」',
          confirmText: '确定要魅惑该玩家吗？',
          bottomActionText: '不用技能',
        },
      },
    ],
  },

  wolfKing: {
    id: 'wolfKing',
    displayName: '白狼王',
    shortName: '王',
    emoji: '👑🐺',
    faction: Faction.Wolf,
    team: Team.Wolf,
    description: '白天可自爆并带走一名玩家；非自爆出局时不能发动技能',
    structuredDescription: {
      skill: '白天可自爆并带走一名玩家',
      restriction: '非自爆出局时不能发动技能',
    },
    night1: { hasAction: false },
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
    abilities: [
      {
        type: 'triggered',
        trigger: 'onDayExile',
        effect: 'selfDestruct',
      },
    ],
  },

  darkWolfKing: {
    id: 'darkWolfKing',
    displayName: '狼王',
    shortName: '黑',
    emoji: '🖤🐺',
    faction: Faction.Wolf,
    team: Team.Wolf,
    description: '出局时可开枪带走一名玩家；被女巫毒杀则不能开枪',
    structuredDescription: {
      trigger: '出局时可开枪带走一名玩家',
      restriction: '被女巫毒杀则不能开枪',
    },
    night1: { hasAction: true },
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'confirm',
        canSkip: true,
        effects: [{ kind: 'confirm', confirmType: 'shoot' }],
        activeOnNight1: true,
      },
      {
        type: 'triggered',
        trigger: 'onDeath',
        effect: 'shoot',
      },
    ],
    resources: [{ kind: 'bullet', uses: 1, refreshPerNight: false }],
    nightSteps: [
      {
        stepId: 'darkWolfKingConfirm',
        audioKey: 'darkWolfKing',
        actionKind: 'confirm',
        ui: {
          confirmTitle: '确认行动',
          prompt: '请点击下方按钮查看技能发动状态',
          confirmText: '确定查看狼王发动状态吗？',
          bottomActionText: '发动状态',
          confirmStatusUi: {
            kind: 'shoot',
            statusDialogTitle: '技能状态',
            canText: '狼王可以发动技能',
            cannotText: '狼王不能发动技能',
          },
        },
      },
    ],
  },

  nightmare: {
    id: 'nightmare',
    displayName: '噩梦之影',
    shortName: '魇',
    emoji: '😱',
    faction: Faction.Wolf,
    team: Team.Wolf,
    description:
      '每晚在多数角色行动之前恐惧一名玩家，使其当夜无法使用技能；不能连续两晚恐惧同一人；首夜行动时尚未与狼队互认；若恐惧到狼人，狼人阵营当夜无法袭击',
    structuredDescription: {
      skill: '每晚在多数角色行动之前恐惧一名玩家，使其当夜无法使用技能',
      restriction: '不能连续两晚恐惧同一人；首夜行动时尚未与狼队互认',
      special: '若恐惧到狼人，狼人阵营当夜无法袭击',
    },
    night1: { hasAction: true },
    recognition: { canSeeWolves: true, participatesInWolfVote: true, actsSolo: true },
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'chooseSeat',
        target: {
          count: { min: 1, max: 1 },
          constraints: [],
        },
        canSkip: true,
        effects: [{ kind: 'block', disablesWolfKillOnWolfTarget: true }],
        activeOnNight1: true,
      },
    ],
    nightSteps: [
      {
        stepId: 'nightmareBlock',
        audioKey: 'nightmare',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认行动',
          prompt: '请选择要恐惧的玩家，如不使用请点击「不用技能」',
          confirmText: '确定要恐惧该玩家吗？',
          bottomActionText: '不用技能',
        },
      },
    ],
  },

  gargoyle: {
    id: 'gargoyle',
    displayName: '石像鬼',
    shortName: '石',
    emoji: '🗿',
    faction: Faction.Wolf,
    team: Team.Wolf,
    description:
      '与其他狼人互不相认；每晚可查验一名玩家的身份，获知其具体角色名称；其他狼人全部出局后可主导袭击',
    structuredDescription: {
      skill: '每晚可查验一名玩家的身份，获知其具体角色名称',
      passive: '与其他狼人互不相认',
      special: '其他狼人全部出局后可主导袭击',
    },
    night1: { hasAction: true },
    recognition: { canSeeWolves: false, participatesInWolfVote: false },
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
        effects: [{ kind: 'check', resultType: 'identity' }],
        activeOnNight1: true,
      },
    ],
    nightSteps: [
      {
        stepId: 'gargoyleCheck',
        audioKey: 'gargoyle',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认查验',
          prompt: '请选择要查验的玩家，如不使用请点击「不用技能」',
          confirmText: '确定要查验该玩家吗？',
          revealTitlePrefix: '石像鬼探查',
          revealResultFormat: 'roleName',
          bottomActionText: '不用技能',
        },
      },
    ],
  },

  awakenedGargoyle: {
    id: 'awakenedGargoyle',
    displayName: '觉醒石像鬼',
    shortName: '石',
    emoji: '🗿🔥',
    faction: Faction.Wolf,
    team: Team.Wolf,
    description:
      '首夜必须选择一名与狼人阵营相邻的玩家转化至狼人阵营；被转化者天亮前知晓转变，不入狼队，保留自身技能；其他狼人全部出局后失去原技能并主导袭击；被转化者不可自爆',
    structuredDescription: {
      skill: '首夜必须选择一名与狼人阵营相邻的玩家转化至狼人阵营',
      special:
        '被转化者天亮前知晓转变，不入狼队，保留自身技能；其他狼人全部出局后失去原技能并主导袭击',
      restriction: '被转化者不可自爆',
    },
    night1: { hasAction: true },
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'chooseSeat',
        target: {
          count: { min: 1, max: 1 },
          constraints: [
            TargetConstraint.NotSelf,
            TargetConstraint.NotWolfFaction,
            TargetConstraint.AdjacentToWolfFaction,
          ],
        },
        canSkip: false,
        effects: [{ kind: 'convert' }],
        activeOnNight1: true,
      },
      {
        type: 'active',
        timing: 'night',
        actionKind: 'groupConfirm',
        canSkip: false,
        effects: [{ kind: 'groupReveal' }],
        activeOnNight1: true,
      },
    ],
    nightSteps: [
      {
        stepId: 'awakenedGargoyleConvert',
        audioKey: 'awakenedGargoyle',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认转化',
          prompt: '请选择狼人阵营相邻的一名神民角色进行转化',
          confirmText: '确定要转化该玩家吗？',
        },
      },
      {
        stepId: 'awakenedGargoyleConvertReveal',
        audioKey: 'awakenedGargoyleConvertReveal',
        audioEndKey: 'awakenedGargoyleConvertReveal',
        actionKind: 'groupConfirm',
        ui: {
          prompt: '所有玩家请睁眼，请看手机确认转化信息',
          bottomActionText: '转化状态',
          hypnotizedText: '你已被觉醒石像鬼转化为狼人阵营',
          notHypnotizedText: '你未被转化',
          confirmButtonText: '知道了',
        },
      },
    ],
  },

  bloodMoon: {
    id: 'bloodMoon',
    displayName: '血月使徒',
    shortName: '血',
    emoji: '🩸',
    faction: Faction.Wolf,
    team: Team.Wolf,
    description:
      '自爆后的当晚所有好人阵营的技能被封印；若为最后一个被放逐的狼人，可存活至下一个白天天亮后才出局',
    structuredDescription: {
      trigger: '自爆后的当晚所有好人阵营的技能被封印',
      passive: '若为最后一个被放逐的狼人，可存活至下一个白天天亮后才出局',
    },
    night1: { hasAction: false },
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
    abilities: [
      {
        type: 'triggered',
        trigger: 'onDayExile',
        effect: 'selfDestruct', // self-destruct triggers skill seal
      },
    ],
  },

  wolfRobot: {
    id: 'wolfRobot',
    displayName: '机械狼人',
    shortName: '机',
    emoji: '🤖🐺',
    faction: Faction.Wolf,
    team: Team.Wolf,
    description:
      '与其他狼人互不相认；首夜可学习一名玩家的技能并获知其身份，当夜不能使用，次夜可用；其他狼人全部出局后可主导袭击，不能自爆',
    structuredDescription: {
      skill: '首夜可学习一名玩家的技能并获知其身份，当夜不能使用，次夜可用',
      passive: '与其他狼人互不相认',
      restriction: '不能自爆',
      special: '其他狼人全部出局后可主导袭击',
    },
    night1: { hasAction: true },
    recognition: { canSeeWolves: false, participatesInWolfVote: false },
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
        effects: [{ kind: 'learn', gateTriggersOnRoles: ['hunter'] }],
        activeOnNight1: true,
      },
    ],
    nightSteps: [
      {
        stepId: 'wolfRobotLearn',
        audioKey: 'wolfRobot',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认学习',
          prompt: '请选择要学习的玩家，如不使用请点击「不用技能」',
          confirmText: '确定要学习该玩家吗？',
          revealTitlePrefix: '学习结果',
          revealResultFormat: 'roleName',
          bottomActionText: '不用技能',
          hunterGatePrompt: '你学习到了猎人，请确认是否可发动技能',
          hunterGateButtonText: '查看技能状态',
          hunterGateDialogTitle: '猎人技能状态',
          hunterGateCanShootText: '当前可发动技能',
          hunterGateCannotShootText: '当前不可发动技能',
        },
      },
    ],
  },

  wolfWitch: {
    id: 'wolfWitch',
    displayName: '狼巫',
    shortName: '巫',
    emoji: '🧙🐺',
    faction: Faction.Wolf,
    team: Team.Wolf,
    description:
      '每晚可查验一名非狼人阵营玩家的身份，获知其具体角色名称；从第二夜起，查验到纯白之女则其出局',
    structuredDescription: {
      skill: '每晚可查验一名非狼人阵营玩家的身份，获知其具体角色名称',
      trigger: '从第二夜起，查验到纯白之女则其出局',
    },
    night1: { hasAction: true },
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'chooseSeat',
        target: {
          count: { min: 1, max: 1 },
          constraints: [TargetConstraint.NotWolfFaction],
        },
        canSkip: true,
        effects: [{ kind: 'check', resultType: 'identity' }],
        activeOnNight1: true,
      },
    ],
    nightSteps: [
      {
        stepId: 'wolfWitchCheck',
        audioKey: 'wolfWitch',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认查验',
          prompt: '请选择要查验的非狼人阵营玩家，如不使用请点击「不用技能」',
          confirmText: '确定要查验该玩家吗？',
          revealTitlePrefix: '狼巫查验',
          revealResultFormat: 'roleName',
          bottomActionText: '不用技能',
        },
      },
    ],
  },

  spiritKnight: {
    id: 'spiritKnight',
    displayName: '恶灵骑士',
    shortName: '灵',
    emoji: '⚔️',
    faction: Faction.Wolf,
    team: Team.Wolf,
    description: '永久免疫夜间伤害；被非狼人阵营角色查验或女巫毒杀时反伤，次日对方出局；不能自爆',
    structuredDescription: {
      passive: '永久免疫夜间伤害',
      trigger: '被非狼人阵营角色查验或女巫毒杀时反伤，次日对方出局',
      restriction: '不能自爆',
    },
    night1: { hasAction: false },
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
    abilities: [
      {
        type: 'passive',
        effect: 'immuneToWolfKill',
      },
      {
        type: 'passive',
        effect: 'immuneToPoison',
      },
      {
        type: 'passive',
        effect: 'reflectsDamage',
      },
      {
        type: 'triggered',
        trigger: 'onCheckedByNonWolf',
        effect: 'reflectDamage',
      },
      {
        type: 'triggered',
        trigger: 'onPoisoned',
        effect: 'reflectDamage',
      },
    ],
    immunities: [{ kind: 'wolfAttack' }, { kind: 'poison' }, { kind: 'nightDamage' }],
    deathCalcRole: 'reflectTarget',
  },

  masquerade: {
    id: 'masquerade',
    displayName: '假面',
    shortName: '假',
    emoji: '🎭🐺',
    faction: Faction.Wolf,
    team: Team.Wolf,
    description:
      '与其他狼人互不相认；从第二夜起可查看一名玩家是否在舞池中，并可赐予一名玩家面具使其共舞结算时阵营反转；其他狼人全部出局后可主导袭击；免疫女巫毒药',
    structuredDescription: {
      skill: '从第二夜起可查看一名玩家是否在舞池中，并可赐予一名玩家面具使其共舞结算时阵营反转',
      passive: '与其他狼人互不相认；免疫女巫毒药',
      special: '其他狼人全部出局后可主导袭击',
    },
    night1: { hasAction: false },
    recognition: { canSeeWolves: false, participatesInWolfVote: false },
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'chooseSeat',
        target: {
          count: { min: 1, max: 1 },
          constraints: [],
        },
        canSkip: true,
        effects: [], // Night-2+ only
        activeOnNight1: false,
      },
    ],
    immunities: [{ kind: 'poison' }],
    resources: [{ kind: 'mask', uses: 1, refreshPerNight: false }],
  },

  warden: {
    id: 'warden',
    displayName: '典狱长',
    shortName: '狱',
    emoji: '⛓️',
    faction: Faction.Wolf,
    team: Team.Wolf,
    description:
      '从第二夜起，每晚选择2名玩家进行交易，随后与狼人共同袭击；双方得知对象但不知身份，各自选「交易」或「背叛」：同交易免夜间伤害，同背叛互为当夜技能目标，两人中一人选「交易」、另一人选「背叛」时，选了「交易」的那个人出局；选自身交易时，对方与自身同选则自身出局，不同则对方出局；每人限交易1次',
    structuredDescription: {
      skill:
        '从第二夜起，每晚选择2名玩家进行交易，随后与狼人共同袭击；双方得知对象但不知身份，各自选「交易」或「背叛」：同交易免夜间伤害，同背叛互为当夜技能目标，一交一叛时选「交易」的出局；选自身交易时，对方与自身同选则自身出局，不同则对方出局',
      restriction: '每人限交易1次',
    },
    night1: { hasAction: false },
    recognition: { canSeeWolves: true, participatesInWolfVote: true },
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'multiChooseSeat',
        target: {
          count: { min: 2, max: 2 },
          constraints: [],
        },
        canSkip: false,
        effects: [], // Night-2+ only, complex custom logic
        activeOnNight1: false,
        customResolver: 'wardenTrade',
      },
    ],
  },

  // ===================================================================
  // THIRD-PARTY FACTION (5)
  // ===================================================================

  slacker: {
    id: 'slacker',
    displayName: '混血儿',
    shortName: '混',
    emoji: '😴',
    faction: Faction.Special,
    team: Team.Third,
    description:
      '首夜选择一名玩家作为榜样，与榜样同阵营，但不知道榜样的具体身份；与榜样阵营共同胜利',
    structuredDescription: {
      skill: '首夜选择一名玩家作为榜样，与榜样同阵营，但不知道榜样的具体身份',
      winCondition: '与榜样阵营共同胜利',
    },
    night1: { hasAction: true },
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'chooseSeat',
        target: {
          count: { min: 1, max: 1 },
          constraints: [TargetConstraint.NotSelf],
        },
        canSkip: false,
        effects: [{ kind: 'chooseIdol' }],
        activeOnNight1: true,
      },
    ],
    nightSteps: [
      {
        stepId: 'slackerChooseIdol',
        audioKey: 'slacker',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认行动',
          prompt: '请选择你的榜样',
          confirmText: '确定选择该玩家为榜样吗？',
          bottomActionText: '不用技能',
        },
      },
    ],
  },

  wildChild: {
    id: 'wildChild',
    displayName: '野孩子',
    shortName: '野',
    emoji: '👶',
    faction: Faction.Special,
    team: Team.Third,
    description:
      '首夜选择一名玩家作为榜样；榜样被投票出局时自身变为狼人，若先于榜样出局则始终为好人阵营；未变身时随好人阵营胜利，变为狼人后随狼人阵营胜利',
    structuredDescription: {
      skill: '首夜选择一名玩家作为榜样',
      trigger: '榜样被投票出局时自身变为狼人；若先于榜样出局则始终为好人阵营',
      winCondition: '未变身时随好人阵营胜利；变为狼人后随狼人阵营胜利',
    },
    night1: { hasAction: true },
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'chooseSeat',
        target: {
          count: { min: 1, max: 1 },
          constraints: [TargetConstraint.NotSelf],
        },
        canSkip: false,
        effects: [{ kind: 'chooseIdol' }],
        activeOnNight1: true,
      },
    ],
    nightSteps: [
      {
        stepId: 'wildChildChooseIdol',
        audioKey: 'wildChild',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认行动',
          prompt: '请选择你的榜样',
          confirmText: '确定选择该玩家为榜样吗？',
          bottomActionText: '不用技能',
        },
      },
    ],
  },

  piper: {
    id: 'piper',
    displayName: '吹笛者',
    shortName: '笛',
    emoji: '🪈',
    faction: Faction.Special,
    team: Team.Third,
    description:
      '每晚可选择 1~2 名玩家进行催眠，被催眠的玩家会醒来互相确认；当所有其他存活玩家均被催眠时获胜',
    structuredDescription: {
      skill: '每晚可选择 1~2 名玩家进行催眠，被催眠的玩家会醒来互相确认',
      winCondition: '当所有其他存活玩家均被催眠时获胜',
    },
    night1: { hasAction: true },
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'multiChooseSeat',
        target: {
          count: { min: 1, max: 2 },
          constraints: [TargetConstraint.NotSelf],
        },
        canSkip: true,
        effects: [{ kind: 'hypnotize' }],
        activeOnNight1: true,
      },
      {
        type: 'active',
        timing: 'night',
        actionKind: 'groupConfirm',
        canSkip: false,
        effects: [{ kind: 'groupReveal' }],
        activeOnNight1: true,
      },
    ],
    nightSteps: [
      {
        stepId: 'piperHypnotize',
        audioKey: 'piper',
        actionKind: 'multiChooseSeat',
        ui: {
          confirmTitle: '确认催眠',
          prompt: '请选择1-2名要催眠的玩家，如不使用请点击「不用技能」',
          confirmText: '确定要催眠选中的玩家吗？',
          bottomActionText: '不用技能',
          confirmButtonText: '确认催眠({count}人)',
        },
      },
      {
        stepId: 'piperHypnotizedReveal',
        audioKey: 'piperHypnotizedReveal',
        audioEndKey: 'piperHypnotizedReveal',
        actionKind: 'groupConfirm',
        ui: {
          prompt: '所有玩家请睁眼，请看手机确认催眠信息',
          bottomActionText: '催眠状态',
          hypnotizedText: '你已被吹笛者催眠，当前被催眠的座位：{seats}',
          notHypnotizedText: '你未被催眠',
          confirmButtonText: '知道了',
        },
      },
    ],
  },

  shadow: {
    id: 'shadow',
    displayName: '影子',
    shortName: '影',
    emoji: '🌑',
    faction: Faction.Special,
    team: Team.Third,
    description:
      '首夜模仿一名玩家，目标出局后继承其身份和技能状态；非绑定时随继承的阵营胜利；模仿到复仇者时二人绑定，失去原技能，成为同生共死第三方；第二天起每晚影子轮次二人睁眼，可袭击一名玩家，袭击无视一切保护效果；绑定时胜利条件为屠城',
    structuredDescription: {
      skill: '首夜模仿一名玩家，目标出局后继承其身份和技能状态',
      special:
        '模仿到复仇者时二人绑定，失去原技能，成为同生共死第三方；第二天起每晚影子轮次二人睁眼，可袭击一名玩家，袭击无视一切保护效果',
      winCondition: '非绑定时随继承的阵营胜利；绑定时胜利条件为屠城',
    },
    night1: { hasAction: true },
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'chooseSeat',
        target: {
          count: { min: 1, max: 1 },
          constraints: [TargetConstraint.NotSelf],
        },
        canSkip: false,
        effects: [{ kind: 'mimic', pairedRole: 'avenger' }],
        activeOnNight1: true,
        customResolver: 'shadowChooseMimic',
      },
    ],
    nightSteps: [
      {
        stepId: 'shadowChooseMimic',
        audioKey: 'shadow',
        actionKind: 'chooseSeat',
        ui: {
          confirmTitle: '确认模仿',
          prompt: '请选择你要模仿的玩家',
          confirmText: '确定模仿该玩家吗？',
        },
      },
    ],
  },

  avenger: {
    id: 'avenger',
    displayName: '复仇者',
    shortName: '仇',
    emoji: '⚔️',
    faction: Faction.Special,
    team: Team.Third,
    description:
      '首夜获知自身阵营，永远与影子模仿目标阵营对立；非绑定时随自身阵营胜利；若影子模仿复仇者则二人绑定，失去原技能，成为同生共死第三方；第二天起每晚影子轮次二人睁眼，可袭击一名玩家，袭击无视一切保护效果；绑定时胜利条件为屠城；非绑定时：出局可刺杀一名玩家，命中敌方有效、己方无效；命中未变身影子则单独胜利；帮好人时算神职，帮狼时与其他狼人互不相认，其他狼人全部出局后可主导袭击；预言家查验为好人',
    structuredDescription: {
      skill: '首夜获知自身阵营',
      passive: '永远与影子模仿目标阵营对立；预言家查验为好人',
      trigger: '出局可刺杀一名玩家，命中敌方有效、己方无效；命中未变身影子则单独胜利',
      special:
        '若影子模仿复仇者则二人绑定，失去原技能，成为同生共死第三方；第二天起每晚影子轮次二人睁眼，可袭击一名玩家，袭击无视一切保护效果；帮好人时算神职，帮狼时与其他狼人互不相认，其他狼人全部出局后可主导袭击',
      winCondition: '非绑定时随自身阵营胜利；绑定时胜利条件为屠城',
    },
    night1: { hasAction: true },
    abilities: [
      {
        type: 'active',
        timing: 'night',
        actionKind: 'confirm',
        canSkip: true,
        effects: [{ kind: 'confirm', confirmType: 'faction' }],
        activeOnNight1: true,
      },
      {
        type: 'triggered',
        trigger: 'onDeath',
        effect: 'stab',
      },
    ],
    nightSteps: [
      {
        stepId: 'avengerConfirm',
        audioKey: 'avenger',
        actionKind: 'confirm',
        ui: {
          confirmTitle: '确认行动',
          prompt: '请点击下方按钮查看你的阵营信息',
          confirmText: '确定查看阵营信息吗？',
          bottomActionText: '查看阵营',
          confirmStatusUi: {
            kind: 'faction',
            statusDialogTitle: '阵营信息',
            goodText: '你属于好人阵营',
            wolfText: '你属于狼人阵营',
            bondedText: '你与影子绑定，同属第三方阵营',
          },
        },
      },
    ],
  },
} as const satisfies Record<string, RoleSpecV2>;
```

**需要 customResolver 的角色（3 个，占 8%）**：

| 角色       | 原因                                                                              |
| ---------- | --------------------------------------------------------------------------------- |
| **witch**  | Compound 双步骤（save + poison），依赖 wolfKill 结果，互斥约束（不能同夜救+毒）   |
| **shadow** | 跨角色联动：模仿目标是 avenger 时触发绑定，需计算 avenger 的阵营（对立规则）      |
| **wolf**   | 投票聚合逻辑（majority resolution, sentinel values -1/-2, immune role filtering） |

> **piper 不需要 customResolver**。当前代码中的 `mergeHypnotizedSeats()` 累积合并和"不能重复催眠已催眠者"校验是为多夜预留的 dead code——Night-1 scope 下 `state.hypnotizedSeats` 在 piper 行动时永远为空数组。piper 实质是 multiChooseSeat → writeSlot，可由通用处理器完全驱动。

其余 33 个角色（92%）可完全由声明式 spec 驱动通用处理器。

### 2.4 引擎消费方案

#### 通用处理器核心循环（伪代码）

```typescript
// engine/processors/genericResolver.ts

function genericResolve(
  spec: RoleSpecV2,
  ability: ActiveAbility,
  context: ResolverContext,
  input: ActionInput,
): ResolverResult {
  // 1. 如果有 customResolver，委托给它
  if (ability.customResolver) {
    return CUSTOM_RESOLVERS[ability.customResolver](context, input);
  }

  // 2. 跳过检查
  const target = input.target;
  if (ability.canSkip && isSkipInput(input)) {
    return { valid: true, result: {} };
  }
  if (!ability.canSkip && isSkipInput(input) && !isNightmareBlocked(context)) {
    return { valid: false, rejectReason: '必须选择目标' };
  }

  // 3. 目标约束校验（从 spec 读取）
  if (ability.target) {
    const validation = validateTargetConstraints(ability.target, context, input);
    if (!validation.valid) return validation;
  }

  // 4. 遍历 effects，按 kind 分发
  const updates: Partial<CurrentNightResults> = {};
  const result: Record<string, unknown> = {};

  for (const effect of ability.effects) {
    switch (effect.kind) {
      case 'check': {
        const checkResult = processCheckEffect(effect, target!, context);
        Object.assign(result, checkResult);
        break;
      }
      case 'writeSlot': {
        updates[effect.slot] = target;
        result[effect.slot.replace('Seat', 'Target')] = target;
        break;
      }
      case 'block': {
        updates.blockedSeat = target;
        if (effect.disablesWolfKillOnWolfTarget) {
          const targetSpec = getSpec(context.players.get(target!));
          if (targetSpec.team === Team.Wolf) {
            updates.wolfKillDisabled = true;
          }
        }
        break;
      }
      case 'charm': {
        result.charmTarget = target;
        break;
      }
      case 'swap': {
        const [t1, t2] = input.targets!;
        updates.swappedSeats = [t1, t2];
        result.swapTargets = [t1, t2];
        break;
      }
      case 'learn': {
        const learnResult = processLearnEffect(effect, target!, context);
        Object.assign(result, learnResult);
        break;
      }
      case 'chooseIdol': {
        result.idolTarget = target;
        break;
      }
      case 'convert': {
        updates.convertedSeat = target;
        result.convertTarget = target;
        break;
      }
      case 'confirm': {
        // No-op, confirm context computed by step transition
        break;
      }
      case 'hypnotize': {
        const hypResult = processHypnotizeEffect(effect, input.targets!, context);
        if (!hypResult.valid) return hypResult;
        Object.assign(updates, hypResult.updates);
        Object.assign(result, hypResult.result);
        break;
      }
      case 'groupReveal': {
        // No-op, groupConfirm steps just gate on acks
        break;
      }
    }
  }

  return { valid: true, updates, result };
}
```

#### NightEngine 如何读取能力

```typescript
// 构建夜晚计划时，从 spec.nightSteps 提取步骤
function buildNightPlanV2(templateRoles: RoleId[]): NightPlan {
  const allSteps: NightPlanStep[] = [];

  // NIGHT_ORDER 定义全局角色执行顺序（仅 roleId 列表）
  for (const roleId of NIGHT_ORDER) {
    if (!templateRoles.includes(roleId)) continue;
    const spec = ROLE_SPECS_V2[roleId];
    if (!spec.nightSteps) continue;

    for (const stepDef of spec.nightSteps) {
      allSteps.push({
        roleId,
        stepId: stepDef.stepId,
        audioKey: stepDef.audioKey ?? roleId,
        audioEndKey: stepDef.audioEndKey,
        actionKind: stepDef.actionKind,
      });
    }
  }

  return { steps: allSteps };
}
```

#### DeathCalculator 如何读取免疫

```typescript
// 替代硬编码 RoleSeatMap，从 spec 动态构建
function buildRoleSeatMapV2(players: Map<number, RoleId>): RoleSeatMap {
  const map: RoleSeatMap = { ...DEFAULT_ROLE_SEAT_MAP };

  for (const [seat, roleId] of players) {
    const spec = ROLE_SPECS_V2[roleId];

    // 从 immunities 读取
    if (spec.immunities?.some((i) => i.kind === 'poison')) {
      map.poisonImmuneSeats.push(seat);
    }
    if (spec.immunities?.some((i) => i.kind === 'wolfAttack' || i.kind === 'nightDamage')) {
      // immuneToWolfKill 等
    }

    // 从 abilities 读取 passive
    for (const ability of spec.abilities) {
      if (ability.type === 'passive' && ability.effect === 'reflectsDamage') {
        map.reflectsDamageSeats.push(seat);
      }
    }

    // 从 deathCalcRole 读取
    if (spec.deathCalcRole === 'wolfQueenLink') map.wolfQueen = seat;
    if (spec.deathCalcRole === 'dreamcatcherLink') map.dreamcatcher = seat;
    if (spec.deathCalcRole === 'checkSource') {
      // 根据 stepId 判断是 seer/psychic/pureWhite
      // ...
    }
  }

  return map;
}
```

#### ConfirmContext 如何读取

```typescript
// 替代硬编码 CONFIRM_STEP_ROLE 映射
function maybeCreateConfirmStatusActionV2(
  nextStepId: string,
  state: NonNullState,
): SetConfirmStatusAction | null {
  // 从 spec 找到包含此 stepId 的角色
  const roleSpec = findRoleByStepId(nextStepId);
  if (!roleSpec) return null;

  // 从 abilities 找到 confirm effect
  const confirmAbility = roleSpec.abilities.find(
    (a) => a.type === 'active' && a.effects.some((e) => e.kind === 'confirm'),
  );
  if (!confirmAbility) return null;

  const confirmEffect = (confirmAbility as ActiveAbility).effects.find(
    (e) => e.kind === 'confirm',
  ) as ConfirmEffect;

  if (confirmEffect.confirmType === 'shoot') {
    return computeShootConfirmStatus(roleSpec.id, state);
  } else {
    return computeFactionConfirmStatus(state);
  }
}
```

### 2.5 类型安全设计

以下 5 个示例展示如何在编译期捕获配置错误：

#### 示例 1：非狼角色配置了 recognition

```typescript
// ❌ 编译错误：WolfOnlyFields 约束
type WolfOnlySpec = RoleSpecV2 & {
  faction: typeof Faction.Wolf;
};

// 类型守卫：recognition 只允许 Wolf faction
type ValidateRecognition<T extends RoleSpecV2> = T extends { recognition: RecognitionConfig }
  ? T extends { faction: typeof Faction.Wolf }
    ? T
    : 'ERROR: recognition only allowed for Wolf faction'
  : T;

// 使用 satisfies 约束 — 村民配了 recognition 会报错
const badVillager = {
  id: 'badVillager',
  faction: Faction.Villager,
  recognition: { canSeeWolves: true, participatesInWolfVote: true },
  // ...
} as const;
// satisfies ValidateRecognition<typeof badVillager>
// → 类型错误: 'ERROR: recognition only allowed for Wolf faction'
```

#### 示例 2：行动选 3 个目标但能力只允许 1 个

```typescript
// TargetCount 带编译期 min <= max 约束
type ValidTargetCount<T extends TargetCount> = T['min'] extends number
  ? T['max'] extends number
    ? T['min'] extends T['max'] | number // 基本范围检查
      ? T
      : 'ERROR: min > max in target count'
    : never
  : never;

// 更强：效果需要的目标数与 target.count 必须匹配
// 例如 swap effect 要求恰好 2 个目标
type SwapRequiresTwo<T extends ActiveAbility> = T['effects'] extends readonly (infer E)[]
  ? E extends SwapEffect
    ? T['target'] extends { count: { min: 2; max: 2 } }
      ? T
      : 'ERROR: swap effect requires exactly 2 targets'
    : T
  : T;
```

#### 示例 3：声明了毒药免疫但没在 abilities 中声明对应 passive

```typescript
// 使用条件类型交叉检查
type ImmunityRequiresPassive<T extends RoleSpecV2> = T extends { immunities: readonly (infer I)[] }
  ? I extends { kind: 'poison' }
    ? T['abilities'] extends readonly (infer A)[]
      ? Extract<A, { type: 'passive'; effect: 'immuneToPoison' }> extends never
        ? 'ERROR: poison immunity declared but no immuneToPoison passive ability'
        : T
      : T
    : T
  : T;
```

#### 示例 4：给村民配了主动夜间能力

```typescript
// 村民 faction 的角色不应有 night1.hasAction = true
type VillagerNoNightAction<T extends RoleSpecV2> = T extends { faction: typeof Faction.Villager }
  ? T extends {
      abilities: readonly (infer A)[];
    }
    ? A extends { type: 'active'; timing: 'night'; activeOnNight1: true }
      ? T extends { displayAs: string }
        ? T // 允许：mirrorSeer/drunkSeer 是 Villager 但有伪装
        : 'ERROR: Villager faction roles should not have active night abilities'
      : T
    : T
  : T;
```

#### 示例 5：资源引用了不存在的类型

```typescript
// ResourceKind 是封闭枚举，直接由类型系统保证
// 如果写 { kind: 'nonexistent', uses: 1, refreshPerNight: false }
// 会直接报 Type '"nonexistent"' is not assignable to type 'ResourceKind'

const badRole = {
  resources: [
    { kind: 'superPotion' as ResourceKind, uses: 1, refreshPerNight: false },
    //         ^^^^^^^^^^^^ Type '"superPotion"' is not assignable to type 'ResourceKind'
  ],
} satisfies Partial<RoleSpecV2>;
```

**实际项目中的编译期安全策略**：

```typescript
// 最实用的做法：在 ROLE_SPECS_V2 定义处用 satisfies + as const
// TypeScript 会在每个角色对象上自动检查：
// 1. 所有必需字段是否提供
// 2. 所有枚举值是否有效（Faction, Team, TargetConstraint, ActionKind...）
// 3. 所有 discriminated union 是否正确（AbilityEffect.kind, Ability.type...）
// 4. readonly 约束是否满足

// 额外的 contract test（运行时兜底）
describe('RoleSpec V2 contract', () => {
  for (const [id, spec] of Object.entries(ROLE_SPECS_V2)) {
    it(`${id}: wolf faction must have recognition`, () => {
      if (spec.faction === Faction.Wolf) {
        expect(spec.recognition).toBeDefined();
      }
    });

    it(`${id}: nightSteps stepIds must be globally unique`, () => {
      // ...
    });

    it(`${id}: immunities and passive abilities are consistent`, () => {
      if (spec.immunities?.some((i) => i.kind === 'poison')) {
        const hasPassive = spec.abilities.some(
          (a) => a.type === 'passive' && a.effect === 'immuneToPoison',
        );
        expect(hasPassive).toBe(true);
      }
    });
  }
});
```

---

## 第三部分：迁移方案

### 3.1 迁移策略

**推荐：渐进式迁移（Strangler Fig Pattern）**

理由：

1. **36 个角色 + 完整引擎 = 大风险一次性重写**。当前系统能跑，有完整测试覆盖，不能承受长时间 broken main branch
2. **消费方众多**（UI / AI / Edge Functions / reducer / handler），同时改全部消费方的 review 负担过重
3. **schema 设计需要验证**。只有真正跑过引擎的 spec 才能证明设计正确。逐批迁移允许中途调整 schema
4. **Night-1 scope 限制**。当前只实现了 Night-1，很多角色的复杂行为（witcher 从 Night-2 起的狩猎、dancer 的共舞、warden 的交易）还未实现。此时冻结 spec 过于冒险

### 3.2 分阶段计划

| 阶段                            | 内容                                                                                                                                                                | 影响范围                           | 风险 | 验证方式                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ---- | --------------------------- |
| **P0: 类型定义**                | 新增 `v2/` 目录，定义所有类型（`ability.types.ts`, `roleSpec.types.ts`），不修改现有代码                                                                            | 0 文件变更                         | 极低 | `tsc --noEmit`              |
| **P1: 并行 spec**               | 创建 `ROLE_SPECS_V2`（全部 36 角色），与 `ROLE_SPECS` 并存。添加 contract test 验证 V1/V2 等价                                                                      | +2 新文件                          | 低   | contract tests 对比 V1/V2   |
| **P2: 通用处理器**              | 实现 `genericResolver`，对 7 个"简单 chooseSeat + writeSlot" 角色（guard, dreamcatcher, silenceElder, votebanElder, slacker, wildChild, wolfQueen）替换为通用处理器 | 7 resolver 文件 + actionHandler    | 中   | 现有 integration tests 全绿 |
| **P3: check 家族**              | 将 seer/mirrorSeer/drunkSeer/psychic/gargoyle/pureWhite/wolfWitch 的 resolver 替换为从 V2 spec 的 `CheckEffect` 驱动                                                | 7 resolver + shared.ts             | 中   | check result 测试全绿       |
| **P4: 复杂角色**                | nightmare(block effect), wolfRobot(learn effect), awakenedGargoyle(convert effect), piper(hypnotize effect)                                                         | 4 resolver                         | 高   | 逐角色 integration test     |
| **P5: 合并 nightSteps/schemas** | 将 `SCHEMAS` 和 `NIGHT_STEPS` 的数据迁入 `RoleSpecV2.nightSteps`，保留向后兼容函数                                                                                  | plan.ts, schemas.ts, nightSteps.ts | 高   | 全量 test:all + E2E         |
| **P6: 消费方切换**              | UI/AI/Edge Functions 从 V1 切到 V2                                                                                                                                  | src/ + supabase/                   | 中   | E2E 全绿                    |
| **P7: 清理**                    | 删除 V1 spec types、旧 resolver 文件、adapter 层                                                                                                                    | 删除 ~2000 行                      | 低   | pnpm run quality            |

### 3.3 新增角色对比

|                | 现在                                                                                   | 新架构                       |
| -------------- | -------------------------------------------------------------------------------------- | ---------------------------- |
| 需修改文件数   | 8-11                                                                                   | 1（specs.ts 添加角色对象）   |
| 需新增文件数   | 1（resolver）                                                                          | 0（除非需要 customResolver） |
| 总代码行数     | ~300                                                                                   | ~40-60（spec 对象）          |
| 需要了解的概念 | RoleSpec + SCHEMAS + NIGHT_STEPS + Resolver + ConfirmContext + RevealPayload + Reducer | RoleSpecV2 的字段含义        |

**标准角色新增流程（新架构）**：

```typescript
// 唯一需要编辑的文件：specs.ts
newRole: {
  id: 'newRole',
  displayName: '新角色',
  shortName: '新',
  emoji: '🆕',
  faction: Faction.God,
  team: Team.Good,
  description: '每晚可...',
  structuredDescription: { skill: '每晚可...' },
  night1: { hasAction: true },
  abilities: [{
    type: 'active',
    timing: 'night',
    actionKind: 'chooseSeat',
    target: { count: { min: 1, max: 1 }, constraints: [TargetConstraint.NotSelf] },
    canSkip: true,
    effects: [{ kind: 'check', resultType: 'identity' }],
    activeOnNight1: true,
  }],
  nightSteps: [{
    stepId: 'newRoleAction',
    audioKey: 'newRole',
    actionKind: 'chooseSeat',
    ui: {
      confirmTitle: '确认行动',
      prompt: '请选择目标...',
      confirmText: '确定吗？',
      bottomActionText: '不用技能',
      revealTitlePrefix: '查验结果',
      revealResultFormat: 'roleName',
    },
  }],
}
// + 准备音频文件
// + 更新 NIGHT_ORDER 数组插入位置
// 完成。无需新建任何文件。
```

### 3.4 对消费方的影响

#### UI 组件（RoleCardContent）

- **无影响**：`displayName`, `description`, `structuredDescription`, `faction`, `emoji`, `displayAs` 这些字段在 V2 中完全保留，类型签名不变
- 适配工作：更新 import 路径从 `ROLE_SPECS` 到 `ROLE_SPECS_V2`（或维护兼容导出）

#### AI Chat Service

- **无影响**：只读 `displayName` 和 `description`，这两个字段类型不变
- 适配工作：P6 阶段更新 import

#### Edge Functions

- **中等影响**：Edge Functions 使用 `@werewolf/game-engine` 包，需在 P2-P5 各阶段确保 resolver 调用方式不变
- 适配工作：actionHandler 的 dispatch 逻辑需要支持 genericResolver 路由。通过 P2 的 adapter 层平滑过渡

#### 测试

- **高影响**：
  - Contract tests 需扩展覆盖 V2 spec（P1 新增）
  - Integration board tests 不需改（它们测的是端到端行为，不关心 resolver 内部实现）
  - Resolver unit tests 对被替换的角色需移除/重写（P2-P4 逐批）
  - 新增 genericResolver 单元测试（每种 effect kind 一个 test suite）

### 3.5 Commit-Level Breakdown

每阶段的具体 commit 序列。每个 commit 必须让 `pnpm run quality` 保持全绿。

> **约定**：commit message 遵循 `<type>(<scope>): <description>` (Conventional Commits)。
> 每个 commit 标注 **[files]**（涉及文件）、**[verify]**（验证命令）、**[risk]**（风险等级）。

---

#### P0: 类型定义（3 commits）

```
commit P0-1: feat(game-engine): add v2 ability type definitions
  [files]
    + packages/game-engine/src/models/roles/spec/v2/ability.types.ts  (新文件)
  [内容]
    TargetConstraint enum, TargetCount, TargetRule, 全部 12 个 Effect interfaces
    (CheckEffect, WriteSlotEffect, BlockEffect, CharmEffect, SwapEffect, LearnEffect,
     ChooseIdolEffect, MimicEffect, HypnotizeEffect, ConvertEffect, GroupRevealEffect,
     ConfirmEffect), AbilityEffect union, AbilityTiming, ActionKind, ActiveAbility,
    PassiveAbility (+ PassiveEffectKind), TriggeredAbility (+ TriggerCondition,
    TriggeredEffectKind), Ability union, ImmunityKind, Immunity, RecognitionConfig,
    ResourceKind, Resource, RoleDescription, ActionUi, ConfirmStatusUi,
    ShootConfirmStatusUi, FactionConfirmStatusUi, MeetingConfig
  [verify] npx tsc --noEmit
  [risk] 极低 — 纯新增，零导入现有代码

commit P0-2: feat(game-engine): add v2 roleSpec type definitions
  [files]
    + packages/game-engine/src/models/roles/spec/v2/roleSpec.types.ts  (新文件)
  [内容]
    RoleSpecV2 interface (identity / classification / abilities / immunities /
    recognition / resources / night1 / nightSteps / display / deathCalcRole),
    NightStepDef interface, DeathCalcRole type,
    RoleLabel interface
  [verify] npx tsc --noEmit
  [risk] 极低

commit P0-3: feat(game-engine): add v2 barrel export
  [files]
    + packages/game-engine/src/models/roles/spec/v2/index.ts  (新文件)
  [内容]
    re-export ability.types + roleSpec.types
  [verify] npx tsc --noEmit
  [risk] 极低
```

---

#### P1: 并行 spec（4 commits）

```
commit P1-1: feat(game-engine): add v2 specs for villager faction (3 roles)
  [files]
    + packages/game-engine/src/models/roles/spec/v2/specs.ts  (新文件)
  [内容]
    ROLE_SPECS_V2 对象，先写 villager / mirrorSeer / drunkSeer 三个 Villager faction 角色。
    使用 `as const satisfies Record<string, RoleSpecV2>` 确保类型安全。
  [verify] npx tsc --noEmit
  [risk] 低

commit P1-2: feat(game-engine): add v2 specs for god faction (15 roles)
  [files]
    ~ packages/game-engine/src/models/roles/spec/v2/specs.ts
  [内容]
    追加 seer, witch, hunter, guard, idiot, knight, magician, witcher, psychic,
    dreamcatcher, graveyardKeeper, pureWhite, dancer, silenceElder, votebanElder
    共 15 个 God faction 角色。
  [verify] npx tsc --noEmit
  [risk] 低

commit P1-3: feat(game-engine): add v2 specs for wolf + third-party factions (18 roles)
  [files]
    ~ packages/game-engine/src/models/roles/spec/v2/specs.ts
  [内容]
    追加 13 个 Wolf faction 角色：wolf, wolfQueen, wolfKing, darkWolfKing, nightmare,
    gargoyle, awakenedGargoyle, bloodMoon, wolfRobot, wolfWitch, spiritKnight,
    masquerade, warden。
    追加 5 个 Third-party 角色：slacker, wildChild, piper, shadow, avenger。
    至此 ROLE_SPECS_V2 包含全部 36 角色。
  [verify] npx tsc --noEmit
  [risk] 低

commit P1-4: test(game-engine): add v1-v2 equivalence contract tests
  [files]
    + packages/game-engine/src/models/roles/spec/v2/__tests__/v2Specs.contract.test.ts  (新文件)
    ~ packages/game-engine/src/models/roles/spec/v2/index.ts  (追加 specs 导出)
  [内容]
    contract test 验证 V1/V2 等价性：
    - V2 的 key set === V1 的 key set（完整覆盖 36 角色）
    - 对每个角色：displayName/shortName/emoji/faction/team/description/
      structuredDescription/night1.hasAction 完全一致
    - nightSteps 的 stepId set === NIGHT_STEPS 中该角色对应的步骤
    - wolf faction 角色的 recognition 配置与 V1 的 wolfMeeting 语义一致
    - abilities tag 一致性：V1 的 immuneToPoison 对应 V2 immunities
  [verify] pnpm run test:all
  [risk] 低 — 纯新增测试，如果 V2 spec 有错误这里能捕获
```

---

#### P2: 通用处理器 — 简单 writeSlot 角色（6 commits）

```
commit P2-1: feat(game-engine): implement genericResolver core
  [files]
    + packages/game-engine/src/resolvers/genericResolver.ts  (新文件)
  [内容]
    genericResolver(roleId, action, context) 函数：
    - 从 ROLE_SPECS_V2 查找 spec
    - 遍历 spec.abilities 找到匹配 activeOnNight1 的 active ability
    - 按 effects[0].kind 分发到 effect processors：
      - writeSlot → 写入 context.currentNightResults[slot] = action.selectedSeats[0]
      - chooseIdol → 写入 idol seat + role 联动
    - 返回 ResolverResult
    注意：此 commit 只实现 writeSlot + chooseIdol 两种 effect，后续 P3/P4 逐步扩展
  [verify] npx tsc --noEmit
  [risk] 中 — 新抽象层，需要仔细设计 ResolverResult 返回格式

commit P2-2: test(game-engine): add genericResolver unit tests for writeSlot + chooseIdol
  [files]
    + packages/game-engine/src/resolvers/__tests__/genericResolver.test.ts  (新文件)
  [内容]
    测试 writeSlot effect（以 guard 为参照：输入 selectedSeats=[3]，
    验证 result.guardedSeat === 3）。测试 chooseIdol effect（以 slacker 为参照）。
    测试 canSkip=true 时空选结果。测试无匹配 ability 时的错误路径。
  [verify] pnpm run test:all
  [risk] 低

commit P2-3: refactor(game-engine): migrate guard + dreamcatcher to genericResolver
  [files]
    ~ packages/game-engine/src/resolvers/guard.ts         (精简为 adapter → genericResolver)
    ~ packages/game-engine/src/resolvers/dreamcatcher.ts   (同上)
    ~ packages/game-engine/src/resolvers/index.ts          (更新 RESOLVERS 注册)
  [内容]
    guard.ts / dreamcatcher.ts 的 resolve 函数改为调用 genericResolver(roleId, ...).
    保留各自文件（adapter 模式），actionHandler dispatch 不变。
    RESOLVERS[guard/dreamcatcher] 指向新 adapter。
  [verify] pnpm run test:all（确保 guard.resolver.test.ts + dreamcatcher.resolver.test.ts 全绿）
  [risk] 中 — 两个简单角色验证 adapter 模式可行性

commit P2-4: refactor(game-engine): migrate silenceElder + votebanElder to genericResolver
  [files]
    ~ packages/game-engine/src/resolvers/silenceElder.ts
    ~ packages/game-engine/src/resolvers/votebanElder.ts
    ~ packages/game-engine/src/resolvers/index.ts
  [verify] pnpm run test:all（silenceElder.resolver.test.ts + votebanElder.resolver.test.ts）
  [risk] 低 — 模式已验证

commit P2-5: refactor(game-engine): migrate slacker + wildChild to genericResolver
  [files]
    ~ packages/game-engine/src/resolvers/slacker.ts
    ~ packages/game-engine/src/resolvers/wildChild.ts
    ~ packages/game-engine/src/resolvers/index.ts
  [verify] pnpm run test:all（slacker.resolver.test.ts + wildChild.resolver.test.ts）
  [risk] 低

commit P2-6: refactor(game-engine): migrate wolfQueen to genericResolver
  [files]
    ~ packages/game-engine/src/resolvers/wolfQueen.ts
    ~ packages/game-engine/src/resolvers/index.ts
  [内容]
    wolfQueen 使用 charm effect（writeSlot 的变体），genericResolver 中需确保
    constraints 校验（NotSelf）通过。校验逻辑复用现有 constraintValidator.ts。
  [verify] pnpm run test:all（wolfQueen.resolver.test.ts）
  [risk] 中 — wolfQueen 有约束校验，比纯 writeSlot 复杂一点
```

---

#### P3: check 家族（5 commits）

```
commit P3-1: feat(game-engine): extend genericResolver with check effect processor
  [files]
    ~ packages/game-engine/src/resolvers/genericResolver.ts
  [内容]
    新增 check effect processor：
    - resultType='faction' → 调用现有 getSeerCheckResultForTeam（swap-aware）
    - resultType='identity' → 调用现有 resolveRoleForChecks
    - transformer='invert' → 反转结果
    - transformer='random' → 50% 概率反转
    复用 shared.ts 中的 getSeerCheckResultForTeam / resolveRoleForChecks 函数。
  [verify] npx tsc --noEmit
  [risk] 中 — 查验结果的正确性是游戏核心

commit P3-2: test(game-engine): add genericResolver check effect unit tests
  [files]
    ~ packages/game-engine/src/resolvers/__tests__/genericResolver.test.ts
  [内容]
    测试 check-faction（seer 场景）、check-identity（psychic 场景）、
    check-faction + invert（mirrorSeer 场景）、check-faction + random（drunkSeer 场景）。
    mock swap state 验证 swap-aware 逻辑正确。
  [verify] pnpm run test:all
  [risk] 低

commit P3-3: refactor(game-engine): migrate seer + mirrorSeer + drunkSeer to genericResolver
  [files]
    ~ packages/game-engine/src/resolvers/seer.ts
    ~ packages/game-engine/src/resolvers/mirrorSeer.ts
    ~ packages/game-engine/src/resolvers/drunkSeer.ts
    ~ packages/game-engine/src/resolvers/shared.ts    (保留 util 函数，删除 factory)
    ~ packages/game-engine/src/resolvers/index.ts
  [内容]
    seer/mirrorSeer/drunkSeer 的 resolve 改为 genericResolver adapter。
    shared.ts 中 createSeerCheckResolver factory 不再被直接调用，
    但其内部 util（getSeerCheckResultForTeam）仍被 genericResolver 复用。
  [verify] pnpm run test:all（seer/mirrorSeer/drunkSeer.resolver.test.ts）
  [risk] 中 — seer 是最高频角色，查验结果不能出错

commit P3-4: refactor(game-engine): migrate psychic + gargoyle + pureWhite to genericResolver
  [files]
    ~ packages/game-engine/src/resolvers/psychic.ts
    ~ packages/game-engine/src/resolvers/gargoyle.ts
    ~ packages/game-engine/src/resolvers/pureWhite.ts
    ~ packages/game-engine/src/resolvers/index.ts
  [verify] pnpm run test:all（psychic/gargoyle/pureWhite.resolver.test.ts）
  [risk] 低 — check-identity 模式已验证

commit P3-5: refactor(game-engine): migrate wolfWitch to genericResolver
  [files]
    ~ packages/game-engine/src/resolvers/wolfWitch.ts
    ~ packages/game-engine/src/resolvers/index.ts
  [内容]
    wolfWitch 是 check-identity + NotWolfFaction 约束。
    genericResolver 的 constraint 校验需覆盖 NotWolfFaction。
  [verify] pnpm run test:all（wolfWitch.resolver.test.ts）
  [risk] 低
```

---

#### P4: 复杂角色（6 commits）

```
commit P4-1: feat(game-engine): extend genericResolver with block + learn + convert + hypnotize
  [files]
    ~ packages/game-engine/src/resolvers/genericResolver.ts
  [内容]
    新增 4 个 effect processor：
    - block → 写入 blockedSeat + 条件触发 wolfKillDisabled
      (disablesWolfKillOnWolfTarget: true 时检查 target team)
    - learn → 写入 learned roleId + disguise context +
      gateTriggersOnRoles 判定（hunter → canShootAsHunter）
    - convert → 写入 convertedSeat + groupConfirm action
    - hypnotize → 写入 hypnotizedSeats（Night-1 下无累积，直接赋值）
  [verify] npx tsc --noEmit
  [risk] 高 — 4 种 effect 各有边界条件

commit P4-2: test(game-engine): add complex effect processor unit tests
  [files]
    ~ packages/game-engine/src/resolvers/__tests__/genericResolver.test.ts
  [内容]
    - block: 普通目标 / wolf team 目标（触发 wolfKillDisabled）/ 被 block 后的 guard 无效
    - learn: 学习 hunter 时触发 gate / 学习普通角色 / swap 场景
    - convert: 目标 adjacent 约束 / groupConfirm 生成
    - hypnotize: 多目标去重 / 空选跳过
  [verify] pnpm run test:all
  [risk] 中

commit P4-3: refactor(game-engine): migrate nightmare to genericResolver
  [files]
    ~ packages/game-engine/src/resolvers/nightmare.ts
    ~ packages/game-engine/src/resolvers/index.ts
  [verify] pnpm run test:all（nightmare.resolver.test.ts）
  [risk] 中 — wolfKillDisabled 条件分支必须验证

commit P4-4: refactor(game-engine): migrate wolfRobot to genericResolver
  [files]
    ~ packages/game-engine/src/resolvers/wolfRobot.ts
    ~ packages/game-engine/src/resolvers/index.ts
  [内容]
    wolfRobot 有 learn effect + gateTriggersOnRoles=['hunter']。
    同时需确认 revealPayload.ts 和 wolfRobotHunterGateHandler.ts 中
    的 learnedRoleId==='hunter' 硬编码仍工作（此 commit 不改 handler，
    只改 resolver side；handler 的数据驱动化留到 P5/P6）。
  [verify] pnpm run test:all（wolfRobot.resolver.test.ts + wolfRobot.types.contract.test.ts）
  [risk] 高 — hunter gate 是 wolfRobot 核心联动

commit P4-5: refactor(game-engine): migrate awakenedGargoyle to genericResolver
  [files]
    ~ packages/game-engine/src/resolvers/awakenedGargoyle.ts
    ~ packages/game-engine/src/resolvers/index.ts
  [verify] pnpm run test:all（awakenedGargoyle.resolver.test.ts）
  [risk] 中

commit P4-6: refactor(game-engine): migrate piper to genericResolver
  [files]
    ~ packages/game-engine/src/resolvers/piper.ts
    ~ packages/game-engine/src/resolvers/index.ts
  [内容]
    piper 是 multiChooseSeat → writeSlot(hypnotizedSeats)，无累积逻辑（Night-1 only）。
    迁移后可删除 mergeHypnotizedSeats() dead code 和重复催眠校验。
  [verify] pnpm run test:all（piper.resolver.test.ts）
  [risk] 低
```

---

#### P5: 合并 nightSteps/schemas（5 commits）

```
commit P5-1: feat(game-engine): add buildNightPlan() from v2 specs
  [files]
    + packages/game-engine/src/models/roles/spec/v2/nightPlan.ts  (新文件)
  [内容]
    buildNightPlanFromV2(roleIds: RoleId[]): NightStep[] 函数，
    从 ROLE_SPECS_V2 的 nightSteps 字段 + NIGHT_ORDER 顺序数组
    生成与现有 buildNightPlan() 等价的步骤列表。
  [verify] npx tsc --noEmit
  [risk] 中 — 步骤排序逻辑关键

commit P5-2: feat(game-engine): add buildSchemas() from v2 specs
  [files]
    + packages/game-engine/src/models/roles/spec/v2/schemas.ts  (新文件)
  [内容]
    buildSchemasFromV2(): Record<string, ActionSchema> 函数，
    从 ROLE_SPECS_V2 的 nightSteps[].ui + nightSteps[].actionKind
    生成与现有 SCHEMAS 等价的 schema 映射。
  [verify] npx tsc --noEmit
  [risk] 中

commit P5-3: test(game-engine): add v2 nightPlan + schemas equivalence tests
  [files]
    + packages/game-engine/src/models/roles/spec/v2/__tests__/nightPlan.contract.test.ts
    + packages/game-engine/src/models/roles/spec/v2/__tests__/schemas.contract.test.ts
  [内容]
    对每个 preset template 的 roleIds，验证 V2 生成的 nightPlan ===
    V1 buildNightPlan() 的结果（stepId 顺序 + schema keys 一致）。
    验证 V2 生成的 schemas === V1 SCHEMAS（key set + 每个 schema
    的 actionKind / constraints / canSkip 一致）。
  [verify] pnpm run test:all
  [risk] 低 — 等价性测试能立即发现偏差

commit P5-4: refactor(game-engine): wire v2 nightPlan + schemas into existing consumers
  [files]
    ~ packages/game-engine/src/models/roles/spec/plan.ts     (改为 delegate 到 v2/nightPlan.ts)
    ~ packages/game-engine/src/models/roles/spec/schemas.ts  (改为 delegate 到 v2/schemas.ts)
    ~ packages/game-engine/src/models/roles/spec/nightSteps.ts  (添加 deprecated 注释)
  [内容]
    plan.ts 的 buildNightPlan() 改为内部调用 buildNightPlanFromV2()，
    对外签名不变。schemas.ts 的 SCHEMAS 改为 buildSchemasFromV2() 的返回值。
    NIGHT_STEPS 数组保留但标记 @deprecated。
  [verify] pnpm run test:all + pnpm exec playwright test --reporter=list
  [risk] 高 — 步骤排序和 schema 直接影响游戏流程，必须 E2E 验证

commit P5-5: refactor(game-engine): data-drive confirmContext + revealPayload from v2 specs
  [files]
    ~ packages/game-engine/src/engine/handlers/confirmContext.ts
    ~ packages/game-engine/src/engine/handlers/revealPayload.ts
  [内容]
    confirmContext.ts：删除 CONFIRM_STEP_ROLE 硬编码映射，改为
    遍历 ROLE_SPECS_V2 查找包含 confirm effect 的角色（见 2.4 伪代码）。
    revealPayload.ts：REVEAL_HANDLERS 中的 wolfRobot handler 改为
    从 V2 spec 的 learn effect + gateTriggersOnRoles 字段驱动。
  [verify] pnpm run test:all
  [risk] 高 — confirm 流程和 reveal 直接影响玩家体验
```

---

#### P6: 消费方切换（4 commits）

```
commit P6-1: refactor(game-engine): update DeathCalculator to use v2 deathCalcRole
  [files]
    ~ packages/game-engine/src/engine/DeathCalculator.ts
  [内容]
    替换 RoleSeatMap 入参中按 roleId 硬查的逻辑，
    改为从 ROLE_SPECS_V2[roleId].deathCalcRole 字段驱动。
    例如 wolfQueenSeat → 找 deathCalcRole==='wolfQueenLink' 的角色的 seat。
    保持 calculateDeaths() 的处理顺序和返回接口不变。
  [verify] pnpm run test:all（DeathCalculator.test.ts 必须全绿）
  [risk] 高 — 死亡结算是最核心逻辑

commit P6-2: refactor(game-engine): update gameControlHandler to use v2 tags
  [files]
    ~ packages/game-engine/src/engine/handlers/gameControlHandler.ts
  [内容]
    将 `r === 'seer' || spec.displayAs === 'seer'` 硬编码替换为
    从 V2 spec 的 tags 字段查询 `tags.includes('seerFamily')`。
  [verify] pnpm run test:all
  [risk] 低

commit P6-3: refactor: update client-side consumers to import from v2
  [files]
    ~ src/screens/game/components/RoleCardContent.tsx  (import ROLE_SPECS_V2)
    ~ src/services/feature/AIChatService.ts             (import ROLE_SPECS_V2)
    ~ src/hooks/useDebugMode.ts                         (import 路径更新)
    ~ src/utils/roleBadges.ts                           (import 路径更新)
  [内容]
    所有读 displayName/description/structuredDescription/faction/emoji 的
    消费方 import 从 ROLE_SPECS 切到 ROLE_SPECS_V2。
    字段签名不变，只是 import path 和对象名称变更。
  [verify] npx tsc --noEmit + pnpm exec playwright test --reporter=list
  [risk] 中 — 涉及多个前端文件，但字段兼容

commit P6-4: refactor: rebuild edge function game-engine bundle
  [files]
    ~ supabase/functions/_shared/game-engine/index.js  (重新 bundle)
  [内容]
    重新执行 game-engine 的 build 脚本，将 V2 resolver 和 spec 打包
    进 edge function 的 shared bundle。Edge Functions 承诺不直接引用
    ROLE_SPECS，它们通过 engine API（actionHandler + GameStore）消费，
    因此只需重新 bundle 即可。
  [verify] pnpm exec playwright test --reporter=list（E2E 验证端到端流程）
  [risk] 中 — edge function bundle 是线上代码
```

---

#### P7: 清理（4 commits）

```
commit P7-1: refactor(game-engine): remove v1 resolver files replaced by genericResolver
  [files]
    - packages/game-engine/src/resolvers/guard.ts
    - packages/game-engine/src/resolvers/dreamcatcher.ts
    - packages/game-engine/src/resolvers/silenceElder.ts
    - packages/game-engine/src/resolvers/votebanElder.ts
    - packages/game-engine/src/resolvers/slacker.ts
    - packages/game-engine/src/resolvers/wildChild.ts
    - packages/game-engine/src/resolvers/wolfQueen.ts
    - packages/game-engine/src/resolvers/seer.ts
    - packages/game-engine/src/resolvers/mirrorSeer.ts
    - packages/game-engine/src/resolvers/drunkSeer.ts
    - packages/game-engine/src/resolvers/psychic.ts
    - packages/game-engine/src/resolvers/gargoyle.ts
    - packages/game-engine/src/resolvers/pureWhite.ts
    - packages/game-engine/src/resolvers/wolfWitch.ts
    - packages/game-engine/src/resolvers/nightmare.ts
    - packages/game-engine/src/resolvers/wolfRobot.ts
    - packages/game-engine/src/resolvers/awakenedGargoyle.ts
    - packages/game-engine/src/resolvers/piper.ts
    ~ packages/game-engine/src/resolvers/index.ts  (统一指向 genericResolver)
  [内容]
    删除 18 个已被 genericResolver 替代的 adapter 文件。
    RESOLVERS 注册表改为 genericResolver 统一路由。
    保留 3 个需要 customResolver 的文件：witch.ts, shadow.ts, wolf.ts。
    保留 shared.ts（util 函数仍被 genericResolver 使用）、
    types.ts、constraintValidator.ts、index.ts。
    保留 avenger.ts, darkWolfKing.ts, hunter.ts（confirm 类角色暂保留）。
  [verify] pnpm run test:all
  [risk] 中 — 大批量删除，但每个文件都已在 P2-P4 被架空

commit P7-2: refactor(game-engine): remove v1 spec types + NIGHT_STEPS array
  [files]
    - packages/game-engine/src/models/roles/spec/spec.types.ts (删除或精简)
    ~ packages/game-engine/src/models/roles/spec/nightSteps.ts (删除 NIGHT_STEPS 数组)
    ~ packages/game-engine/src/models/roles/spec/schemas.ts    (删除 V1 SCHEMAS 常量)
    ~ packages/game-engine/src/models/roles/spec/index.ts      (更新 re-export)
  [内容]
    删除 V1 的 RoleSpec interface（Night1Config, WolfMeetingConfig 等）。
    删除原始 NIGHT_STEPS 数组和 SCHEMAS 常量。
    保留 specs.ts 中的 ROLE_SPECS 但标记 @deprecated 并设为 ROLE_SPECS_V2 的 adapter。
    更新 barrel export 指向 v2/。
  [verify] pnpm run test:all
  [risk] 中

commit P7-3: refactor(game-engine): remove old resolver test files
  [files]
    - packages/game-engine/src/resolvers/__tests__/guard.resolver.test.ts
    - packages/game-engine/src/resolvers/__tests__/dreamcatcher.resolver.test.ts
    - packages/game-engine/src/resolvers/__tests__/silenceElder.resolver.test.ts
    - packages/game-engine/src/resolvers/__tests__/votebanElder.resolver.test.ts
    - packages/game-engine/src/resolvers/__tests__/slacker.resolver.test.ts
    - packages/game-engine/src/resolvers/__tests__/wildChild.resolver.test.ts
    - packages/game-engine/src/resolvers/__tests__/wolfQueen.resolver.test.ts
    - packages/game-engine/src/resolvers/__tests__/seer.resolver.test.ts
    - packages/game-engine/src/resolvers/__tests__/mirrorSeer.resolver.test.ts
    - packages/game-engine/src/resolvers/__tests__/drunkSeer.resolver.test.ts
    - packages/game-engine/src/resolvers/__tests__/psychic.resolver.test.ts
    - packages/game-engine/src/resolvers/__tests__/gargoyle.resolver.test.ts
    - packages/game-engine/src/resolvers/__tests__/pureWhite.resolver.test.ts
    - packages/game-engine/src/resolvers/__tests__/wolfWitch.resolver.test.ts
    - packages/game-engine/src/resolvers/__tests__/nightmare.resolver.test.ts
    - packages/game-engine/src/resolvers/__tests__/wolfRobot.resolver.test.ts
    - packages/game-engine/src/resolvers/__tests__/awakenedGargoyle.resolver.test.ts
    - packages/game-engine/src/resolvers/__tests__/piper.resolver.test.ts
  [内容]
    删除 18 个已被 genericResolver.test.ts 覆盖的旧 resolver 单测。
    保留 witch/shadow/wolf/magician/hunter/darkWolfKing/avenger 的测试。
    保留 contract test 文件（不受影响）。
  [verify] pnpm run test:all
  [risk] 低

commit P7-4: chore(game-engine): rename v2 → canonical, run knip cleanup
  [files]
    ~ packages/game-engine/src/models/roles/spec/v2/ → 重命名为直接在 spec/ 下
    ~ packages/game-engine/src/models/roles/spec/index.ts (更新 re-export)
    ~ 所有 import v2/ 路径的文件
  [内容]
    V2 已是唯一 spec 来源，移除 v2/ 子目录层级，
    将 ability.types.ts + roleSpec.types.ts + specs.ts 提升到 spec/ 下
    （或合并入现有文件）。运行 `npx knip --no-exit-code` 清理未使用导出。
  [verify] pnpm run quality（完整 typecheck + lint + format + test）
  [risk] 低 — 纯重组织
```

---

#### 总览

| 阶段     | commits | 新增文件 | 修改文件 | 删除文件 | 估计净 LOC 变化             |
| -------- | ------- | -------- | -------- | -------- | --------------------------- |
| P0       | 3       | 3        | 0        | 0        | +400                        |
| P1       | 4       | 2        | 0        | 0        | +1600                       |
| P2       | 6       | 2        | 9        | 0        | +200                        |
| P3       | 5       | 0        | 8        | 0        | +100                        |
| P4       | 6       | 0        | 5        | 0        | +200                        |
| P5       | 5       | 4        | 3        | 0        | +300                        |
| P6       | 4       | 0        | 6        | 0        | ±0                          |
| P7       | 4       | 0        | 3        | 36+      | **−2000**                   |
| P8       | 3       | 0        | 10+      | 2+       | **−500**                    |
| **合计** | **40**  | **11**   | **44+**  | **38+**  | **+800 → −2500 净减 ~1700** |

> **关键里程碑**：
>
> - P1-4 完成后：genericResolver 为止，每次 push 仍可部署上线
> - P5-4 完成后：V2 接管步骤排序和 schema，第一次真正删除 V1 数据流
> - P7-4 完成后：项目中不再存在 V1 代码，新增角色仅需编辑 specs.ts
> - P8 完成后：所有 V1 兼容层彻底删除，spec.types.ts 消失，schemas.ts 从手写 ~500 行变为 V2 派生 ~40 行

---

#### P8: V1 兼容层清除（3 commits）

> **背景**：P7 原计划"删除 V1 + 重命名 v2 → canonical"，但实际保留了 4 个 V1 兼容文件：
> `specs.ts`（600+ 行手写数据）、`spec.types.ts`（V1 type 定义）、`schemas.ts`（500 行手写 schema）、
> `nightSteps.ts`（V2 adapter）。P8 彻底消除前三个的 V1 残留。

```
commit P8-A: refactor(game-engine): switch specs + helpers to V2 re-exports ✅
  [files]
    ~ packages/game-engine/src/models/roles/spec/specs.ts         (687→68 行，V2 re-export)
    ~ packages/game-engine/src/models/roles/spec/index.ts         (删除 export * from spec.types)
    ~ packages/game-engine/src/models/roles/index.ts              (helpers 用 V2 recognition/immunities)
    ~ packages/game-engine/src/models/roles/spec/v2/roleSpec.types.ts  (接管 RoleDescription 定义)
    ~ src/components/RoleDescriptionView.tsx                      (import 改 V2)
    ~ src/components/__tests__/RoleDescriptionView.test.tsx        (import 改 V2)
    ~ packages/game-engine/src/models/roles/spec/__tests__/specs.contract.test.ts
    ~ packages/game-engine/src/models/roles/spec/__tests__/structuredDescription.contract.test.ts
    ~ packages/game-engine/src/models/roles/spec/v2/__tests__/v2Specs.contract.test.ts
  [内容]
    specs.ts 从 687 行完整手写数据改为 `ROLE_SPECS = ROLE_SPECS_V2` re-export + 6 个 helper 函数。
    roles/index.ts 的 canRoleSeeWolves / doesRoleParticipateInWolfVote / getWolfKillImmuneRoleIds
    全部从 V1 wolfMeeting/flags 切换到 V2 recognition/immunities。
    RoleDescription 从 spec.types.ts 移入 v2/roleSpec.types.ts（打断 V2→V1 依赖）。
    spec/index.ts 删除 `export * from './spec.types'`。
    contract tests 全部改为 V2 字段 + 自洽性测试。
  [verify] npx tsc --noEmit (clean)
  [risk] 中 — helpers 语义切换需验证所有消费者

commit P8-B: refactor(game-engine): derive SCHEMAS from V2 specs
  [files]
    ~ packages/game-engine/src/models/roles/spec/schemas.ts       (496→~40 行，V2 派生)
    ~ packages/game-engine/src/engine/handlers/actionGuards.ts     (3 处类型简化)
    ~ packages/game-engine/src/models/roles/spec/__tests__/schemas.contract.test.ts
    ~ src/screens/RoomScreen/hooks/__tests__/useRoomActions.witchSchema.contract.test.ts
  [内容]
    schemas.ts 删除 ~470 行手写 SCHEMAS 常量，改为模块初始化时调用
    buildSchemasFromV2() 生成。SchemaId 改为 NightStepId re-export。
    getSchema() 返回类型从 generic 窄字面量简化为 ActionSchema。
    actionGuards.ts 的 (typeof SCHEMAS)[SchemaId] → ActionSchema。
    test 中 SCHEMAS.witchAction.steps → (SCHEMAS.witchAction as CompoundSchema).steps。
  [verify] pnpm run test:all + npx tsc --noEmit
  [risk] 中 — SchemaId 类型变宽，需验证所有 discriminant switch

commit P8-C: chore(game-engine): delete spec.types.ts + barrel cleanup
  [files]
    - packages/game-engine/src/models/roles/spec/spec.types.ts     (删除)
    - scripts/_tmp_rewrite_specs.py                                 (删除临时脚本)
    ~ packages/game-engine/src/models/roles/spec/index.ts           (barrel 更新)
  [内容]
    spec.types.ts 已无消费者（RoleDescription 在 P8-A 移入 V2），删除。
    删除 P8-A 中产生的临时 Python 脚本。
    运行 knip 清理残余未使用导出。
  [verify] pnpm run quality
  [risk] 低 — 纯清理
```

---

#### P9: 去除 V2 后缀 + 消除 wrapper 层（4 commits）

> **背景**：P8 完成后 ROLE_SPECS_V2 已是唯一真相源，但符号仍保留 V2 后缀（ROLE_SPECS_V2、
> RoleSpecV2、RoleIdV2、buildNightPlanFromV2、buildSchemasFromV2），且 spec/ 目录存在 4 个
> 纯薄包装文件（specs.ts、schemas.ts、nightSteps.ts、plan.ts）做 V2→canonical 别名映射。
> P9 将 V2 符号重命名为正式名称，helper/派生逻辑下沉到 v2/ 文件，删除薄包装层。

```
commit P9-A: refactor(game-engine): rename V2-suffixed symbols to canonical names ✅
  [files]
    ~ packages/game-engine/src/models/roles/spec/v2/roleSpec.types.ts  (RoleSpecV2 → RoleSpec)
    ~ packages/game-engine/src/models/roles/spec/v2/specs.ts           (ROLE_SPECS_V2 → ROLE_SPECS, RoleIdV2 → RoleId)
    ~ packages/game-engine/src/models/roles/spec/v2/nightPlan.ts       (buildNightPlanFromV2 → buildNightPlan)
    ~ packages/game-engine/src/models/roles/spec/v2/schemas.ts         (buildSchemasFromV2 → buildSchemas)
    ~ packages/game-engine/src/models/roles/spec/v2/index.ts           (更新 re-export)
  [内容]
    6 个 V2 后缀符号统一去掉后缀：
    ROLE_SPECS_V2→ROLE_SPECS, RoleSpecV2→RoleSpec, RoleIdV2→RoleId,
    buildNightPlanFromV2→buildNightPlan, buildSchemasFromV2→buildSchemas。
    v2/ 内部引用同步更新（V2RoleId / isValidV2RoleId 等内部变量一并清理）。
  [verify] npx tsc --noEmit（可能需要临时调整 wrapper import）
  [risk] 低 — 纯符号重命名，逻辑零变化

commit P9-B: refactor(game-engine): move helpers + derivation into v2/ files
  [files]
    ~ packages/game-engine/src/models/roles/spec/v2/specs.ts          (吸收 6 个 helper)
    ~ packages/game-engine/src/models/roles/spec/v2/schemas.ts        (吸收 SCHEMAS 缓存 + SchemaId 别名 + 3 个 helper)
    + packages/game-engine/src/models/roles/spec/v2/nightSteps.ts     (从 spec/nightSteps.ts 搬入)
    ~ packages/game-engine/src/models/roles/spec/v2/index.ts          (新增 re-export)
  [内容]
    spec/specs.ts 的 getRoleSpec / getRoleDisplayAs / getRoleEmoji / isValidRoleId /
    getRoleStructuredDescription / getAllRoleIds → 移入 v2/specs.ts。
    spec/schemas.ts 的 SCHEMAS 缓存 + SchemaId + getSchema / isValidSchemaId /
    getAllSchemaIds → 移入 v2/schemas.ts。
    spec/nightSteps.ts 的 buildNightSteps + NIGHT_STEPS + 5 个 helper → 新建 v2/nightSteps.ts。
    v2/index.ts 挂载全部新导出。
  [verify] npx tsc --noEmit
  [risk] 低 — 逻辑搬迁，无语义变化

commit P9-C: refactor(game-engine): delete wrapper layer + update barrel
  [files]
    - packages/game-engine/src/models/roles/spec/specs.ts             (删除)
    - packages/game-engine/src/models/roles/spec/schemas.ts           (删除)
    - packages/game-engine/src/models/roles/spec/nightSteps.ts        (删除)
    - packages/game-engine/src/models/roles/spec/plan.ts              (删除)
    ~ packages/game-engine/src/models/roles/spec/index.ts             (改为 re-export from ./v2)
    ~ packages/game-engine/src/models/roles/spec/nightSteps.types.ts  (import 改 v2/)
    ~ packages/game-engine/src/models/roles/spec/plan.types.ts        (import 改 v2/)
    ~ packages/game-engine/src/models/roles/index.ts                  (import 路径更新)
  [内容]
    删除 4 个空壳 wrapper。spec/index.ts 改为：
    export * from './types' + './schema.types' + './nightSteps.types' + './plan.types' + './v2'
    type files 的 import 从 ./specs → ./v2/specs, ./schemas → ./v2/schemas。
    roles/index.ts 的 re-export 路径从 ./spec/specs → ./spec/v2/specs 等。
  [verify] npx tsc --noEmit + pnpm run test:all
  [risk] 中 — barrel 路径变更影响面广，需验证所有消费者

commit P9-D: refactor(game-engine): update all direct V2 consumer imports
  [files]
    ~ packages/game-engine/src/resolvers/genericResolver.ts
    ~ packages/game-engine/src/engine/handlers/confirmContext.ts
    ~ packages/game-engine/src/engine/handlers/revealPayload.ts
    ~ packages/game-engine/src/engine/handlers/stepTransitionHandler.ts
    ~ packages/game-engine/src/engine/handlers/gameControlHandler.ts
    ~ packages/game-engine/src/models/roles/spec/v2/__tests__/*.ts     (v2Specs / nightPlanSchemas)
    ~ packages/game-engine/src/models/roles/spec/__tests__/*.ts        (specs / structuredDescription)
    ~ packages/game-engine/src/resolvers/__tests__/genericResolver.test.ts
  [内容]
    所有直接引用 v2/ 的生产/测试文件：
    ROLE_SPECS_V2→ROLE_SPECS, RoleSpecV2→RoleSpec, buildNightPlanFromV2→buildNightPlan,
    buildSchemasFromV2→buildSchemas。
    error message 文本同步更新（"not found in ROLE_SPECS_V2" → "not found in ROLE_SPECS"）。
    通过 barrel 间接消费的 ~90% 文件无需改动。
  [verify] pnpm run quality
  [risk] 低 — 机械替换，逻辑零变化
```

#### P10: 拉平 v2/ → spec/ 顶层，删除 v2/ 目录

> **背景**：P9 完成后 `spec/` 顶层存在 4 个 @deprecated re-export stub（specs / schemas /
> nightSteps / plan），真正实现在 `spec/v2/` 下。目录嵌套 + 重复文件名造成混淆。
> P10 将 v2/ 内容拉平到 spec/ 顶层，删除 v2/ 整个目录。

```
commit P10: refactor(game-engine): flatten v2/ into spec/ top level

  [文件名映射]
    v2/specs.ts           → spec/specs.ts          (替换 stub)
    v2/schemas.ts         → spec/schemas.ts        (替换 stub)
    v2/nightSteps.ts      → spec/nightSteps.ts     (替换 stub)
    v2/nightPlan.ts       → spec/plan.ts           (替换 stub)
    v2/roleSpec.types.ts  → spec/roleSpec.types.ts (新文件)
    v2/ability.types.ts   → spec/ability.types.ts  (新文件)
    v2/index.ts           → 删除 (spec/index.ts 接管)
    v2/__tests__/*        → spec/__tests__/        (移动)

  [内容 — 纯机械重构]
    A: 替换 spec/ 顶层 stub 为 v2/ 真实内容，修复相对 import
       (../types → ./types, ./specs → ./specs 不变, ./nightPlan → ./plan)
    B: 移动 v2/__tests__/ 到 spec/__tests__/
    C: 重写 spec/index.ts barrel — 直接导出顶层文件
    D: 更新 nightSteps.types.ts / plan.types.ts import (去掉 ./v2/ 前缀)
    E: 更新 engine handlers / resolvers import (去掉 /v2/ 路径段)
    F: 更新 models/roles/index.ts (./spec/v2/roleSpec.types → ./spec/roleSpec.types)
    G: 更新外部消费者 @werewolf/game-engine/.../v2/ → 去掉 v2/
    H: 更新 contract test 文件路径引用
    I: 删除 v2/ 目录

  [verify] pnpm run quality
  [risk] 低 — 纯路径重构，零逻辑变化，影响 ~22 文件
```

#### P11: DeathCalculator spec 驱动（2 commits）

> **背景**：P6-1 因 PR 体量被推迟。当前 `buildRoleSeatMap` 中 7 个命名角色槽位
> （wolfQueen/dreamcatcher/seer/psychic/pureWhite/witch/guard）仍按 roleId 字符串
> 硬编码查找，`processReflection` 中 4 个 per-role 分支（seer/psychic/pureWhite/witch）
> 逐角色硬编码反伤来源。`deathCalcRole` 字段已在 specs.ts 中声明和赋值但无运行时消费者。
>
> **目标**：用 `deathCalcRole` 驱动 `buildRoleSeatMap`，用 `ReflectionSource[]` 替代
> `processReflection` 的 per-role 硬编码。新增 checkSource 角色时不再需要修改
> DeathCalculator 或 RoleSeatMap。

```
commit P11-A: refactor(game-engine): derive RoleSeatMap from deathCalcRole + reflectionSources

  [files]
    ~ packages/game-engine/src/engine/DeathCalculator.ts
    ~ packages/game-engine/src/engine/handlers/stepTransitionHandler.ts
    ~ packages/game-engine/src/engine/__tests__/DeathCalculator.test.ts

  [内容]

    === DeathCalculator.ts ===

    1. RoleSeatMap 接口重构：
       - wolfQueen → wolfQueenLinkSeat（语义化：链锁死亡来源）
       - dreamcatcher → dreamcatcherLinkSeat（语义化：链锁死亡来源）
       - guard → guardProtectorSeat（语义化：守护者座位，用于 nightmare 封锁判定）
       - witch → poisonSourceSeat（语义化：毒药来源座位，用于 nightmare 封锁判定）
       - 删除 seer / psychic / pureWhite 字段（反伤配对改由 reflectionSources 承载）
       - 新增 reflectionSources: readonly ReflectionSource[]

    2. 新增 ReflectionSource 接口：
       interface ReflectionSource {
         readonly sourceSeat: number;   // 查验/毒药来源座位
         readonly targetSeat: number;   // 被查验/被毒目标座位
       }

    3. DEFAULT_ROLE_SEAT_MAP 同步更新字段名。

    4. processWolfKill：guard → guardProtectorSeat，witch → poisonSourceSeat
    5. processWitchPoison：witch → poisonSourceSeat
    6. processWolfQueenLink：wolfQueen → wolfQueenLinkSeat
    7. processDreamcatcherEffect：dreamcatcher → dreamcatcherLinkSeat
    8. processReflection 重写：
       - 删除 4 个 per-role 分支（seer/psychic/pureWhite/witch）
       - 改为遍历 reflectionSources：
         for (const { sourceSeat, targetSeat } of reflectionSources) {
           if (reflectsDamageSeats.includes(targetSeat)) {
             deaths.add(sourceSeat);
           }
         }
       - nightmare 封锁的来源不进入 reflectionSources（在构建时排除）

    === stepTransitionHandler.ts ===

    9. buildRoleSeatMap 重写：
       - 单循环扫描 deathCalcRole：
         switch (spec.deathCalcRole) {
           case 'wolfQueenLink': result.wolfQueenLinkSeat = seat; break;
           case 'dreamcatcherLink': result.dreamcatcherLinkSeat = seat; break;
           case 'guardProtector': result.guardProtectorSeat = seat; break;
           case 'poisonSource': result.poisonSourceSeat = seat; break;
           // checkSource + reflectTarget 无需单独字段
         }
       - poisonImmuneSeats / reflectsDamageSeats 保持不变（已从 spec 驱动）

    10. 新增 buildReflectionSources() 纯函数：
        - 在 handleEndNight 中，buildNightActions 之后调用
        - 扫描 effectiveRoleSeatMap 中 deathCalcRole='checkSource' 的角色：
          从 nightSteps[0].stepId 找到 schemaId → findActionBySchemaId 取 targetSeat
          → 生成 { sourceSeat, targetSeat }
        - 扫描 deathCalcRole='poisonSource' 的角色：
          从 witchAction 提取 poisonTarget → 生成 { sourceSeat, targetSeat }
        - nightmare 封锁判定：若 sourceSeat === nightmareBlock → 排除（不生成条目）
        - 返回 ReflectionSource[]

    11. handleEndNight 调用顺序更新：
        buildRoleSeatMap → buildNightActions → buildReflectionSources
        → 将 reflectionSources 注入 roleSeatMap → calculateDeaths

    === DeathCalculator.test.ts ===

    12. NO_ROLES 常量更新字段名
    13. 48 个现有测试用 spread 更新（wolfQueen → wolfQueenLinkSeat 等）
    14. 反伤测试从 { seer: 8, seerCheck: target } 改为
        reflectionSources: [{ sourceSeat: 8, targetSeat: 7 }]
        — 语义更清晰，不再依赖 action 字段名约定

  [消除的硬编码]
    - buildRoleSeatMap: 7 个 roleId 字符串 → deathCalcRole 单循环
    - processReflection: 4 个 per-role 分支 → reflectionSources 遍历
    - processReflection: witch nightmare 重复判定 → 构建时排除

  [新增 checkSource 角色成本变化]
    P11 之前：RoleSeatMap 加字段 + buildRoleSeatMap 加 lookup + processReflection 加分支（3 处）
    P11 之后：specs.ts 加 deathCalcRole: 'checkSource'（1 处，自动扫描）

  [verify] pnpm run test:all（48 个 DeathCalculator 测试全绿）+ pnpm exec tsc --noEmit
  [risk] 高 — 死亡结算是最核心逻辑，但有 48 个测试守护行为等价性
```
