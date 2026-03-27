/**
 * V2 Role Specification — 角色定义核心类型
 *
 * The single source of truth for everything a role IS and DOES.
 * Handler code only fills gaps that cannot be expressed declaratively (customResolver).
 * 纯类型定义，不含业务逻辑、副作用、平台依赖。
 *
 * 复用 V1 的 Faction / Team / RoleDescription 类型。
 */

import type { RoleDescription } from '../spec.types';
import type { Faction, Team } from '../types';
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

// Re-export for convenience
export type { RoleDescription };

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
  | 'reflectTarget';
