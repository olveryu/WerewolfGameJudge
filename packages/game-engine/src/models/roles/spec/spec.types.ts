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
  /** Cannot be targeted by wolf kill (spiritKnight, wolfQueen) */
  readonly immuneToWolfKill?: boolean;

  /** Immune to witch poison (witcher, dancer, masquerade, spiritKnight, etc.) */
  readonly immuneToPoison?: boolean;

  /** Reflects damage from seer check / witch poison back to the source (spiritKnight) */
  readonly reflectsDamage?: boolean;
}

/**
 * Complete Role Specification
 *
 * IMPORTANT NOTES:
 *
 * 1. Seer Check Rule (team field):
 *    - Team.Wolf → seer sees "狼人"
 *    - Team.Good OR Team.Third → seer sees "好人"
 *    - The Third value is for UI display only; seer check is strictly binary.
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

  /** Emoji icon for UI display (e.g. '🐺', '🔮') */
  readonly emoji: string;

  /** English name (optional) */
  readonly englishName?: string;

  /** Role faction */
  readonly faction: Faction;

  /**
   * Team for seer check / camp display.
   *
   * SEER CHECK RULE (strictly binary):
   * - Team.Wolf → "狼人"
   * - Team.Good OR Team.Third → "好人"
   *
   * The Third value is kept for UI/display purposes only.
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

  /**
   * Display disguise: this role appears as another role to its holder.
   * Used by mirrorSeer (displays as 'seer') so the player doesn't know their true identity.
   * Only affects player-facing UI (role card, night progress). Host/ConfigScreen shows real role.
   */
  readonly displayAs?: string;
}
