/**
 * Night Plan Builder — re-export layer (to be removed in P9-C)
 */

import type { NightPlan } from './plan.types';
import { buildNightPlan as buildNightPlanCore } from './v2/nightPlan';

/**
 * Build night plan from template roles.
 *
 * @param templateRoles - Array of role IDs in the template (must be canonical RoleIds)
 * @returns NightPlan with ordered steps
 * @throws NightPlanBuildError if any roleId is invalid (fail-fast)
 *
 * IMPORTANT:
 * - Input must be canonical RoleIds (no aliases like 'celebrity')
 * - Roles with night1.hasAction=false are excluded
 * - Duplicate roles are deduplicated (e.g., multiple wolves → one wolf step)
 */
export function buildNightPlan(
  templateRoles: readonly string[],
  seerLabelMap?: Readonly<Record<string, number>>,
): NightPlan {
  return buildNightPlanCore(templateRoles, seerLabelMap);
}

// Re-export types
export * from './plan.types';
