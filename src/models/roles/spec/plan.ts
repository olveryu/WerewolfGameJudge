/**
 * Night Plan Builder
 * 
 * Builds night action sequence from template roles.
 * Single source of truth for action order.
 *
 * NOTE (M2):
 * - This builder derives steps from `NIGHT_STEPS` (array order = authority).
 * - `NightPlanStep.order` is derived from the table index (consumer-facing field kept for backward compatibility).
 * - RoleSpec no longer carries night-1 ordering or schemaId. Treat `NIGHT_STEPS` as authoritative.
 */

import { ROLE_SPECS, type RoleId, isValidRoleId } from './specs';
import { NIGHT_STEPS } from './nightSteps';
import { NightPlanBuildError, type NightPlan, type NightPlanStep } from './plan.types';

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
export function buildNightPlan(templateRoles: readonly string[]): NightPlan {
  // Fail-fast: validate all roleIds first
  const invalidRoleIds = templateRoles.filter(id => !isValidRoleId(id));
  if (invalidRoleIds.length > 0) {
    throw new NightPlanBuildError(
      `Invalid roleIds in template: ${invalidRoleIds.join(', ')}. All roleIds must be canonical.`,
      invalidRoleIds,
    );
  }
  
  const templateRoleSet = new Set(templateRoles as RoleId[]);

  // M2: derive ordered steps from NIGHT_STEPS (array order = authority)
  // Dedupe is implicit because NIGHT_STEPS contains each night-1 action role exactly once.
  const steps: NightPlanStep[] = NIGHT_STEPS
    .filter(step => templateRoleSet.has(step.roleId))
    .map((step, idx) => {
      const spec = ROLE_SPECS[step.roleId];
      return {
        roleId: step.roleId,
        schemaId: step.schemaId,
        // Keep NightPlanStep shape stable for existing consumers/tests.
        // The numeric order is now derived from table sequence.
        order: idx,
        displayName: spec.displayName,
        audioKey: step.audioKey,
        actsSolo: step.visibility.actsSolo,
      };
    });
  
  return {
    steps,
    length: steps.length,
  };
}

/**
 * Get action order from night plan (for backward compatibility)
 */
export function getActionOrderFromPlan(plan: NightPlan): RoleId[] {
  return plan.steps.map(step => step.roleId);
}

// Re-export types
export * from './plan.types';
