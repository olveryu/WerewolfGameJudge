/**
 * Night Plan Types
 * 
 * Table-driven night action sequence.
 */

import type { RoleId } from './specs';
import type { SchemaId } from './schemas';

/** Single step in the night plan */
export interface NightPlanStep {
  /** Role performing this action */
  readonly roleId: RoleId;
  
  /** Schema for this action */
  readonly schemaId: SchemaId;
  
  /** Action order (for sorting) */
  readonly order: number;
  
  /** Display name for this step */
  readonly displayName: string;
  
  /** Audio key for this step */
  readonly audioKey: string;
  
  /**
   * Whether this role acts alone in this step (cannot see teammates).
   * 
   * CONTRACT:
   * - true: Acts solo, cannot see wolf teammates, but CAN see self (seat/role).
   * - false/undefined: Normal visibility based on wolfMeeting config.
   * 
   * Example: nightmare fear phase has actsSolo=true.
   */
  readonly actsSolo: boolean;
}

/** Complete night plan for a game */
export interface NightPlan {
  /** Ordered list of action steps */
  readonly steps: readonly NightPlanStep[];
  
  /** Number of steps */
  readonly length: number;
}

/** Error thrown when buildNightPlan encounters invalid input */
export class NightPlanBuildError extends Error {
  constructor(
    message: string,
    public readonly invalidRoleIds: string[],
  ) {
    super(message);
    this.name = 'NightPlanBuildError';
  }
}
