/**
 * Role Spec Types
 * 
 * Declarative role definitions.
 * Pure data - no functions, no side effects.
 */

import type { Faction, Team } from './types';
import type { SchemaId } from './schemas';

/** Night-1 action configuration */
export interface Night1Config {
  /** Whether this role has a night-1 action */
  readonly hasAction: boolean;
  
  /** 
   * Action order for night-1 (lower = earlier).
   * Only meaningful if hasAction=true.
   * Use undefined if no action.
   */
  readonly order?: number;
  
  /** Schema ID for night-1 action (if hasAction=true) */
  readonly schemaId?: SchemaId;
  
  /**
   * Whether this role acts alone (cannot see teammates) in this step.
   * 
   * CONTRACT:
   * - actsSolo = true: Cannot see wolf teammates, but CAN still see self (seat/role).
   * - Used for nightmare's fear phase - acts alone before wolf meeting.
   * - Default: false (can see teammates if wolfMeeting.canSeeWolves=true)
   * 
   * UI behavior: visibility = {selfSeat} + other non-teammate info
   */
  readonly actsSolo?: boolean;
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
  /**
   * @deprecated Input validation MUST come from `SCHEMAS[*].constraints`.
  * NOTE(remove by 2026-03-01): delete this field after all legacy call-sites are removed.
   */
  readonly canSaveSelf?: boolean;
  
  /** Nightmare: blocks player skill for the night */
  readonly blocksSkill?: boolean;
  
  /** SpiritKnight: immune to night damage, reflects damage */
  readonly immuneToNightDamage?: boolean;
  readonly reflectsDamage?: boolean;
}

/** UX configuration for audio/display */
export interface RoleUxConfig {
  /** Audio file key (without extension) */
  readonly audioKey: string;
  
  /** Action message shown to player */
  readonly actionMessage?: string;
  
  /** Action button text */
  readonly actionConfirmMessage?: string;
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
  
  /** UX configuration */
  readonly ux: RoleUxConfig;
}
