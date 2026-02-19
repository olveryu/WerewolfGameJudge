/**
 * Role Spec Types - 声明式角色定义类型
 *
 * Declarative role definitions.
 * Pure data - no functions, no side effects.
 * 导出 RoleSpec / Night1Config / WolfMeetingConfig 等类型定义，不依赖 service、不含副作用或函数实现。
 */

import type { Faction, Team } from './types';

/** Night-1 action configuration */
export interface Night1Config {
  /** Whether this role has a night-1 action */
  readonly hasAction: boolean;
}

/** Wolf meeting configuration (for wolf kill phase) */
export interface WolfMeetingConfig {
  /** Whether this wolf can see other wolves' identities during wolf kill phase */
  readonly canSeeWolves: boolean;

  /** Whether this wolf participates in the kill vote */
  readonly participatesInWolfVote: boolean;
}

/** Role-specific flags */
export interface RoleFlags {
  /** Nightmare: blocks player skill for the night */
  readonly blocksSkill?: boolean;

  /** SpiritKnight: immune to night damage, reflects damage */
  readonly immuneToNightDamage?: boolean;
  readonly reflectsDamage?: boolean;

  /** Cannot be targeted by wolf kill (spiritKnight, wolfQueen) */
  readonly immuneToWolfKill?: boolean;
}

/**
 * Complete Role Specification
 *
 * IMPORTANT NOTES:
 *
 * 1. Seer Check Rule (team field):
 *    - team='wolf' → seer sees "狼人"
 *    - team='good' OR team='third' → seer sees "好人"
 *    - The 'third' value is for UI display only; seer check is strictly binary.
 *
 * 2. actsSolo (nightmare fear phase):
 *    - actsSolo=true means no wolf teammate visibility, but player CAN see self.
 */
export interface RoleSpec {
  /** Unique role identifier (canonical) */
  readonly id: string;

  /** Display name in Chinese */
  readonly displayName: string;

  /** Single-character short name for notepad UI (unique across all roles) */
  readonly shortName: string;

  /** English name (optional) */
  readonly englishName?: string;

  /** Role faction */
  readonly faction: Faction;

  /**
   * Team for seer check / camp display.
   *
   * SEER CHECK RULE (strictly binary):
   * - team='wolf' → "狼人"
   * - team='good' OR team='third' → "好人"
   *
   * The 'third' value is kept for UI/display purposes only.
   */
  readonly team: Team;

  /** Role description */
  readonly description: string;

  /** Night-1 action configuration */
  readonly night1: Night1Config;

  /** Wolf meeting configuration (only for wolf faction, applies to wolf kill phase) */
  readonly wolfMeeting?: WolfMeetingConfig;

  /** Role-specific flags */
  readonly flags?: RoleFlags;
}
