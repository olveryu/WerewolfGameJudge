/**
 * Night Plan Builder - 夜晚行动序列构建器
 *
 * Builds night action sequence from template roles.
 * Single source of truth for action order.
 *
 * NOTE:
 * - This builder derives steps from `NIGHT_STEPS` (array order = authority).
 * - `NightPlanStep.order` is derived from the table index.
 * - RoleSpec no longer carries night-1 ordering or schemaId. Treat `NIGHT_STEPS` as authoritative.
 *
 * ✅ 允许：buildNightPlan 纯函数、fail-fast 校验
 * ❌ 禁止：import service / 副作用 / IO
 */

import { NIGHT_STEPS } from './nightSteps';
import { type NightPlan, NightPlanBuildError, type NightPlanStep } from './plan.types';
import { isValidRoleId, ROLE_SPECS, type RoleId } from './specs';

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
  const invalidRoleIds = templateRoles.filter((id) => !isValidRoleId(id));
  if (invalidRoleIds.length > 0) {
    throw new NightPlanBuildError(
      `Invalid roleIds in template: ${invalidRoleIds.join(', ')}. All roleIds must be canonical.`,
      invalidRoleIds,
    );
  }

  const templateRoleSet = new Set(templateRoles as RoleId[]);

  // Check if any wolf in template participates in wolf vote
  // This is needed because wolfKill step has roleId='wolf', but templates may only have
  // skill wolves (darkWolfKing, nightmare, wolfQueen, etc.) without basic 'wolf'.
  const hasWolfVotingParticipant = templateRoles.some((roleId) => {
    const spec = ROLE_SPECS[roleId as RoleId];
    // Use 'in' operator to check for optional property existence
    if (spec && 'wolfMeeting' in spec && spec.wolfMeeting) {
      return spec.wolfMeeting.participatesInWolfVote === true;
    }
    return false;
  });

  // M2: derive ordered steps from NIGHT_STEPS (array order = authority)
  // Dedupe is implicit because NIGHT_STEPS contains each night-1 action role exactly once.
  // Special case: wolfKill step is included if ANY wolf participates in vote, not just 'wolf' role.
  const steps: NightPlanStep[] = NIGHT_STEPS.filter((step) => {
    // Special case: wolfKill step should be included if any wolf participates in voting
    if (step.id === 'wolfKill') {
      return hasWolfVotingParticipant;
    }
    return templateRoleSet.has(step.roleId);
  }).map((step, idx) => {
    const spec = ROLE_SPECS[step.roleId];
    return {
      roleId: step.roleId,
      stepId: step.id, // step.id is the stepId (= schemaId)
      // Keep NightPlanStep shape stable for existing consumers/tests.
      // The numeric order is now derived from table sequence.
      order: idx,
      displayName: spec.displayName,
      audioKey: step.audioKey,
    };
  });

  return {
    steps,
    length: steps.length,
  };
}

// Re-export types
export * from './plan.types';
