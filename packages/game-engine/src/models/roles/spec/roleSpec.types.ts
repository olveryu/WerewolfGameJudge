/**
 * V2 Role Specification — core types for role definitions
 *
 * The single source of truth for everything a role IS and DOES.
 * Handler code only fills gaps that cannot be expressed declaratively (customResolver).
 * Pure type definitions; no business logic, side effects, or platform dependencies.
 */

import type {
  Ability,
  ActionKind,
  CompoundSubStepDef,
  Immunity,
  MeetingConfig,
  NightStepUi,
  RecognitionConfig,
  Resource,
} from './ability.types';
import type { Faction, Team } from './types';

/**
 * UI ability category tags — used for encyclopedia page filtering and role card display.
 *
 * Display-only categories; not used in runtime game logic.
 */
export type RoleAbilityTag =
  | 'check' // 查验 — 可查验其他玩家身份或阵营
  | 'protect' // 保护 — 可主动防护或救治其他玩家
  | 'kill' // 杀伤 — 可直接导致玩家出局
  | 'control' // 控制 — 可限制、干扰其他玩家行动或操纵游戏状态
  | 'link' // 连带 — 出局或行动引发对其他玩家的连锁效果
  | 'immune' // 免疫 — 对特定伤害类型天然免疫
  | 'transform' // 变身 — 可改变自身或他人的阵营、身份
  | 'survive' // 免死 — 可触发保命机制避免出局
  | 'follow' // 跟随 — 依附其他玩家阵营共同胜负
  | 'confirm' // 确认 — 夜间确认信息（无目标选择）
  | 'none'; // 无能力 — 无特殊技能，纯推理投票

/**
 * Internal grouping tags — used for runtime handler logic grouping (e.g. seer-family checks).
 *
 * Not used for UI display filtering.
 */
export type RoleGroupTag = 'seerFamily'; // 预言家系 — 预言家及其变体

/**
 * Structured role description for card UI rendering.
 *
 * Each field maps to a visual section on the role card.
 * Only non-null fields are rendered. When a role has a single field,
 * the card uses a simplified centered layout (Mode A);
 * with 2+ fields, it uses a structured layout with labeled sections (Mode B).
 */
export interface RoleDescription {
  /** Active skill — ability the player actively uses (each night/day) */
  readonly skill?: string;
  /** Passive trait — always active, requires no action */
  readonly passive?: string;
  /** Triggered effect — activates on elimination, check, or specific events */
  readonly trigger?: string;
  /** Restriction — what the role cannot do */
  readonly restriction?: string;
  /** Special rules — interactions with other roles and edge cases */
  readonly special?: string;
  /** Win condition — non-standard victory condition (optional) */
  readonly winCondition?: string;
}

/**
 * Complete Role Specification v2
 *
 * The single source of truth for everything a role IS and DOES.
 * Handler code only fills gaps that cannot be expressed declaratively.
 */
export interface RoleSpec {
  // --- Identity ---
  readonly id: string;
  readonly displayName: string;
  readonly shortName: string;
  readonly emoji: string;
  readonly englishName?: string;

  // --- Classification ---
  readonly faction: Faction;
  readonly team: Team;
  /** UI ability category tags for encyclopedia filtering */
  readonly tags?: readonly RoleAbilityTag[];
  /** Internal grouping tags for handler runtime logic (e.g. seerFamily detection) */
  readonly groups?: readonly RoleGroupTag[];

  // --- Abilities ---
  readonly abilities: readonly Ability[];

  // --- Immunities ---
  readonly immunities?: readonly Immunity[];

  // --- Recognition (wolf meeting) ---
  readonly recognition?: RecognitionConfig;

  // --- Resources ---
  readonly resources?: readonly Resource[];

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
  /** Display name for this step's schema (e.g. '查验', '守护') */
  readonly displayName: string;
  /** Audio key for this step (defaults to role ID) */
  readonly audioKey?: string;
  /** End audio key (defaults to audioKey) */
  readonly audioEndKey?: string;
  /** Action kind */
  readonly actionKind: ActionKind;
  /** UI metadata */
  readonly ui: NightStepUi;
  /** Meeting config (wolfVote only) */
  readonly meeting?: MeetingConfig;
  /** Compound sub-steps (witch only — save/poison inline steps) */
  readonly compoundSteps?: readonly CompoundSubStepDef[];
}

/**
 * Death calculation role — declares what role-specific death rules apply.
 *
 * Used by DeathCalculator to replace hardcoded RoleSeatMap field checks.
 */
export type DeathCalcRole =
  | 'wolfQueenLink'
  | 'dreamcatcherLink'
  | 'checkSource'
  | 'poisonSource'
  | 'guardProtector'
  | 'reflectTarget'
  | 'bondedLink'
  | 'coupleLink'
  | 'checkDeathTarget';
