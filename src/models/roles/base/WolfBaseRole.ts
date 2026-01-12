/**
 * Wolf Base Role
 * 
 * Abstract base class for all wolf roles.
 * Provides common wolf properties like seeing other wolves and participating in votes.
 */

import { BaseRole, Faction } from './BaseRole';

export abstract class WolfBaseRole extends BaseRole {
  readonly faction = Faction.Wolf;
  
  /**
   * Whether this wolf participates in the nightly kill vote.
   * Most wolves do, but some (like Gargoyle, WolfRobot) don't.
   * Override to false for wolves that don't vote.
   */
  readonly participatesInWolfVote: boolean = true;
  
  /**
   * Whether this wolf can see other wolves' identities.
   * Most wolves can, but WolfRobot cannot.
   * Override to false for wolves that can't see others.
   */
  readonly canSeeWolves: boolean = true;
  
  /**
   * Check if this role is a wolf - always true for WolfBaseRole
   */
  get isWolf(): boolean {
    return true;
  }
}
