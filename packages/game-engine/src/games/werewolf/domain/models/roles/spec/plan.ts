/**
 * Night Plan Builder — builds night action sequence from ROLE_SPECS
 *
 * NIGHT_STEP_ORDER defines the global step execution order; each role's nightSteps provides step details.
 * Exports buildNightPlan as a pure function: no service dependency, no side effects, no IO.
 */

import type { NightPlan, NightPlanStep } from './plan.types';
import { NightPlanBuildError } from './plan.types';
export type { NightPlan, NightPlanStep };
import type { NightStepDef } from './roleSpec.types';
import { getAllRoleIds, getRoleSpec, isValidRoleId, type RoleId } from './specs';
export { NIGHT_STEP_ORDER, type NightStepId } from './nightStepIds';
import { NIGHT_STEP_ORDER, type NightStepId } from './nightStepIds';

// =============================================================================
// Builder
// =============================================================================

/**
 * Build night plan from template roles.
 *
 * @param templateRoles - Array of role IDs in the template (must be canonical RoleIds)
 * @param seerLabelMap - Optional label numbers for seer-like roles (for display ordering)
 * @returns NightPlan with ordered steps
 * @throws NightPlanBuildError if any roleId is invalid (fail-fast)
 */
export function buildNightPlan(
  templateRoles: readonly string[],
  seerLabelMap?: Readonly<Record<string, number>>,
): NightPlan {
  const canonicalRoleIds: RoleId[] = [];
  const invalidRoleIds: string[] = [];
  for (const roleId of templateRoles) {
    if (isValidRoleId(roleId)) {
      canonicalRoleIds.push(roleId);
    } else {
      invalidRoleIds.push(roleId);
    }
  }
  if (invalidRoleIds.length > 0) {
    throw new NightPlanBuildError(
      `Invalid roleIds in template: ${invalidRoleIds.join(', ')}. All roleIds must be canonical.`,
      invalidRoleIds,
    );
  }

  const templateRoleSet = new Set(canonicalRoleIds);

  // Check if any wolf participates in vote (for wolfKill step inclusion)
  const hasWolfVotingParticipant = canonicalRoleIds.some((roleId) => {
    return getRoleSpec(roleId).recognition?.participatesInWolfVote === true;
  });

  // Collect step definitions from specs
  const stepMap = new Map<NightStepId, { roleId: RoleId; stepDef: NightStepDef }>();

  for (const roleId of getAllRoleIds()) {
    const spec = getRoleSpec(roleId);
    if (!spec.nightSteps) continue;

    // wolfKill special case: include wolf's steps only if any wolf votes
    if (roleId === 'wolf') {
      if (!hasWolfVotingParticipant) continue;
    } else if (!templateRoleSet.has(roleId)) {
      continue;
    }

    for (const stepDef of spec.nightSteps) {
      stepMap.set(stepDef.stepId, { roleId, stepDef });
    }
  }

  // Build steps ordered by NIGHT_STEP_ORDER
  let steps: NightPlanStep[] = [];
  for (const stepId of NIGHT_STEP_ORDER) {
    const entry = stepMap.get(stepId);
    if (!entry) continue;
    const { roleId, stepDef } = entry;
    steps.push({
      roleId,
      stepId,
      order: steps.length,
      displayName: getRoleSpec(roleId).displayName,
      audioKey: stepDef.audioKey ?? roleId,
    });
  }

  // Reorder seer-like steps by label number when seerLabelMap is provided
  if (seerLabelMap) {
    const seerIndices: number[] = [];
    const seerSteps: { step: NightPlanStep; label: number }[] = [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step) {
        throw new Error(`[nightPlan] Missing step at index ${i}`);
      }
      const label = seerLabelMap[step.roleId];
      if (label !== undefined) {
        seerIndices.push(i);
        seerSteps.push({ step, label });
      }
    }
    seerSteps.sort((a, b) => a.label - b.label);
    for (let i = 0; i < seerIndices.length; i++) {
      const targetIndex = seerIndices[i];
      const orderedStep = seerSteps[i];
      if (targetIndex === undefined || !orderedStep) {
        throw new Error('[nightPlan] Seer ordering index mismatch');
      }
      steps[targetIndex] = orderedStep.step;
    }
    // Recompute order
    steps = steps.map((s, i) => ({ ...s, order: i }));
  }

  return {
    steps,
    length: steps.length,
  };
}
