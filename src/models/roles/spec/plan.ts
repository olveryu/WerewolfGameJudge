/**
 * Night Plan Builder
 * 
 * Builds night action sequence from template roles.
 * Single source of truth for action order.
 */

import { ROLE_SPECS, type RoleId, isValidRoleId } from './specs';
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
 * - Steps are sorted by night1.order
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
  
  const steps: NightPlanStep[] = [];
  
  // Deduplicate roles (e.g., multiple wolves)
  const seenRoles = new Set<RoleId>();
  
  for (const roleId of templateRoles as RoleId[]) {
    // Skip if already processed
    if (seenRoles.has(roleId)) {
      continue;
    }
    seenRoles.add(roleId);
    
    const spec = ROLE_SPECS[roleId];
    
    // Skip roles without night-1 action
    if (!spec.night1.hasAction) {
      continue;
    }
    
    // Must have schemaId if hasAction=true (this is a type-level guarantee from RoleSpec)
    if (!spec.night1.schemaId) {
      throw new NightPlanBuildError(
        `Role ${roleId} has night1.hasAction=true but no schemaId`,
        [roleId],
      );
    }
    
    steps.push({
      roleId,
      schemaId: spec.night1.schemaId,
      order: spec.night1.order ?? 999,
      displayName: spec.displayName,
      audioKey: spec.ux.audioKey,
      actsSolo: 'actsSolo' in spec.night1 ? (spec.night1.actsSolo ?? false) : false,
    });
  }
  
  // Sort by order
  steps.sort((a, b) => a.order - b.order);
  
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
