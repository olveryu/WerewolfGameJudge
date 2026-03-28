/**
 * V2 Ability System — 能力/效果/免疫/互认/资源类型定义
 *
 * 角色行为的原子构件。每种 AbilityEffect 对应 genericResolver 中的一个 effect processor。
 * 类型设计为纯 JSON-serializable（无函数、无 class），可存 DB / 跨 Edge Function 传输。
 * 不含业务逻辑、副作用、平台依赖。
 *
 * 复用 V1 的 Faction / Team / TargetConstraint 枚举，不重复定义。
 */

import type { ConfirmStatusUi } from './schema.types';
import { TargetConstraint } from './schema.types';

// Re-export TargetConstraint so V2 consumers can import from v2/
export { TargetConstraint };

// ---------------------------------------------------------------------------
// Target Rules
// ---------------------------------------------------------------------------

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
 * 把行动结果写入 CurrentNightResults 的特定字段。
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

/** Charm effect — 魅惑目标（wolfQueen） */
export interface CharmEffect {
  readonly kind: 'charm';
}

/** Swap effect — 交换两个目标的号码牌（magician） */
export interface SwapEffect {
  readonly kind: 'swap';
}

/**
 * Learn effect — 学习目标角色的身份和技能（wolfRobot）
 */
export interface LearnEffect {
  readonly kind: 'learn';
  /** Role IDs that trigger a gate when learned */
  readonly gateTriggersOnRoles?: readonly string[];
}

/** ChooseIdol effect — 选择榜样（slacker / wildChild） */
export interface ChooseIdolEffect {
  readonly kind: 'chooseIdol';
}

/**
 * Mimic effect — 模仿目标（shadow）
 */
export interface MimicEffect {
  readonly kind: 'mimic';
  /** When mimicking this roleId, triggers faction binding (shadow → avenger) */
  readonly pairedRole?: string;
}

/** Hypnotize effect — 催眠多目标（piper） */
export interface HypnotizeEffect {
  readonly kind: 'hypnotize';
}

/** Convert effect — 转化目标阵营（awakenedGargoyle） */
export interface ConvertEffect {
  readonly kind: 'convert';
}

/** GroupReveal effect — 全员确认信息（piperHypnotizedReveal / awakenedGargoyleConvertReveal） */
export interface GroupRevealEffect {
  readonly kind: 'groupReveal';
}

/** ChooseCard effect — 从底牌中选择一张身份牌（treasureMaster） */
export interface ChooseCardEffect {
  readonly kind: 'chooseCard';
}

/**
 * Confirm effect — 确认类（查看状态）
 * hunter / darkWolfKing / avenger confirm
 */
export interface ConfirmEffect {
  readonly kind: 'confirm';
  readonly confirmType: 'shoot' | 'faction';
}

/** All possible effects (discriminated by `kind`) */
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
  | ConfirmEffect
  | ChooseCardEffect;

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
  | 'groupConfirm'
  | 'chooseCard';

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
  | 'shoot'
  | 'linkDeath'
  | 'linkDreamDeath'
  | 'flipCard'
  | 'selfDestruct'
  | 'reflectDamage'
  | 'stab';

export type Ability = ActiveAbility | PassiveAbility | TriggeredAbility;

// ---------------------------------------------------------------------------
// Immunities
// ---------------------------------------------------------------------------

export type ImmunityKind = 'wolfAttack' | 'poison' | 'nightDamage' | 'seerCheck';

export interface Immunity {
  readonly kind: ImmunityKind;
  /** Conditional immunity (e.g., dancer immune only when in dance pool) */
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
  /** Acts solo during nightmare phase (cannot see wolf teammates) */
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
// Night Step UI
// ---------------------------------------------------------------------------

/**
 * UI metadata for a night step's action.
 *
 * Mirrors V1 SchemaUi fields relevant to night actions.
 * Separated from behavior to keep spec JSON-serializable.
 */
export interface NightStepUi {
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
}

// ---------------------------------------------------------------------------
// Meeting Config
// ---------------------------------------------------------------------------

export interface MeetingConfig {
  readonly canSeeEachOther: boolean;
  readonly resolution: 'majority' | 'firstVote';
  readonly allowEmptyVote: boolean;
}

// ---------------------------------------------------------------------------
// Compound Sub-Step (for witch-style compound actions)
// ---------------------------------------------------------------------------

/**
 * Sub-step definition within a compound night action (e.g. witch save/poison).
 *
 * Mirrors V1's InlineSubStepSchema. Only used by compound actionKind steps.
 */
export interface CompoundSubStepDef {
  readonly key: string;
  readonly displayName: string;
  readonly kind: 'chooseSeat' | 'confirmTarget';
  readonly constraints: readonly TargetConstraint[];
  readonly canSkip: boolean;
  readonly ui?: NightStepUi;
}
