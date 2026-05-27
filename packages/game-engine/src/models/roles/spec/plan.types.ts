/**
 * Night Plan Types - night action sequence type definitions
 *
 * Table-driven night action sequence.
 * Exports NightPlan / NightPlanStep / NightPlanBuildError type definitions; no service dependencies, no side effects.
 */

import type { SchemaId } from './schemas';
import type { RoleId } from './specs';

/** Single step in the night plan */
export interface NightPlanStep {
  /** Role performing this action */
  readonly roleId: RoleId;

  /**
   * Step ID (= Schema ID for this action).
   *
   * Single source of truth: derived from NIGHT_STEPS[].id
   */
  readonly stepId: SchemaId;

  /**
   * Step order inside THIS plan.
   *
   * NOTE (M2+): This is no longer a global/stable role order value.
   * It is derived from the final plan sequence (0..n-1) after filtering by the template.
   *
   * Do NOT assume values like 15 means "seer". If you need stable identity, use roleId/stepId.
   */
  readonly order: number;

  /** Display name for this step */
  readonly displayName: string;

  /** Audio key for this step */
  readonly audioKey: string;
}

/** Complete night plan for a game */
export interface NightPlan {
  /** Ordered list of action steps */
  readonly steps: readonly NightPlanStep[];

  /** Number of steps */
  readonly length: number;
}

/**
 * NightPlanBuildError — thrown by buildNightPlan when it receives invalid input.
 *
 * When thrown: template contains an unregistered roleId or invalid configuration.
 * How to catch: `instanceof NightPlanBuildError` — read .invalidRoleIds to surface the problematic roles.
 */
export class NightPlanBuildError extends Error {
  constructor(
    message: string,
    public readonly invalidRoleIds: string[],
  ) {
    super(message);
    this.name = 'NightPlanBuildError';
  }
}
