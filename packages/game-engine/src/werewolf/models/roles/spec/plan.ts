/**
 * Night Plan Builder — builds night action sequence from ROLE_SPECS
 *
 * NIGHT_STEP_ORDER defines the global step execution order; each role's nightSteps provides step details.
 * Exports buildNightPlan as a pure function: no service dependency, no side effects, no IO.
 */

import type { NightPlan, NightPlanStep } from './plan.types';
import { NightPlanBuildError } from './plan.types';
export type { NightPlan, NightPlanStep };
export { NightPlanBuildError };
import type { NightStepDef, RoleSpec } from './roleSpec.types';
import { isValidRoleId, ROLE_SPECS, type RoleId } from './specs';

// =============================================================================
// NIGHT_STEP_ORDER — global step execution order (single source of truth)
// =============================================================================

/**
 * Global step execution order.
 *
 * Array position = authority. Replaces V1's NIGHT_STEPS array ordering.
 * Each entry is a stepId matching a NightStepDef.stepId in ROLE_SPECS_V2.
 */
const NIGHT_STEP_ORDER_INTERNAL = [
  // === Deck card roles (act first, pick deck card identity) ===
  'thiefChoose',
  'treasureMasterChoose',

  // === Cupid (after deck cards, before other special roles) ===
  'cupidChooseLovers',
  'cupidLoversReveal',

  // === Special roles (act first) ===
  'magicianSwap',
  'slackerChooseIdol',
  'wildChildChooseIdol',
  'shadowChooseMimic',
  'avengerConfirm',

  // === Eclipse Wolf Queen shelter (before all good faction actions) ===
  'eclipseWolfQueenShelter',

  // === Protect/check (before kill) ===
  'nightmareBlock',
  'dreamcatcherDream',
  'guardProtect',
  'silenceElderSilence',
  'votebanElderBan',
  'crowCurse',

  // === Wolf meeting phase ===
  'wolfKill',
  'wolfQueenCharm',
  'hiddenWolfReveal',

  // === Witch / Poisoner ===
  'witchAction',
  'poisonerPoison',

  // === Confirm types ===
  'hunterConfirm',
  'darkWolfKingConfirm',

  // === Last four roles (Wolf Robot -> Seer -> Gargoyle -> Psychic) ===
  'wolfRobotLearn',
  'seerCheck',
  'mirrorSeerCheck',
  'drunkSeerCheck',
  'wolfWitchCheck',
  'gargoyleCheck',
  'pureWhiteCheck',
  'psychicCheck',

  // === Awakened Gargoyle conversion (after check types) ===
  'awakenedGargoyleConvert',

  // === Piper (hypnotize -> all-confirm) ===
  'piperHypnotize',
  'piperHypnotizedReveal',

  // === Awakened Gargoyle conversion reveal (last) ===
  'awakenedGargoyleConvertReveal',
] as const;

/** Public readonly array for external consumers. */
export const NIGHT_STEP_ORDER: readonly NightStepId[] = [...NIGHT_STEP_ORDER_INTERNAL];

/** Literal union of all step IDs (= SchemaId). Derived from NIGHT_STEP_ORDER. */
export type NightStepId = (typeof NIGHT_STEP_ORDER_INTERNAL)[number];

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
  // Fail-fast: validate all roleIds
  const invalidRoleIds = templateRoles.filter((id) => !isValidRoleId(id));
  if (invalidRoleIds.length > 0) {
    throw new NightPlanBuildError(
      `Invalid roleIds in template: ${invalidRoleIds.join(', ')}. All roleIds must be canonical.`,
      invalidRoleIds,
    );
  }

  const templateRoleSet = new Set(templateRoles);

  // Check if any wolf participates in vote (for wolfKill step inclusion)
  const hasWolfVotingParticipant = templateRoles.some((roleId) => {
    const spec: RoleSpec = ROLE_SPECS[roleId as RoleId];
    return spec.recognition?.participatesInWolfVote === true;
  });

  // Collect step definitions from specs
  const stepMap = new Map<string, { roleId: string; stepDef: NightStepDef }>();

  for (const roleId of Object.keys(ROLE_SPECS) as RoleId[]) {
    const spec: RoleSpec = ROLE_SPECS[roleId];
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
  let steps: NightPlanStep[] = NIGHT_STEP_ORDER.filter((stepId) => stepMap.has(stepId)).map(
    (stepId, idx) => {
      const { roleId, stepDef } = stepMap.get(stepId)!;
      const spec: RoleSpec = ROLE_SPECS[roleId as RoleId];
      return {
        roleId: roleId as RoleId,
        stepId: stepId,
        order: idx,
        displayName: spec.displayName,
        audioKey: stepDef.audioKey ?? roleId,
      };
    },
  );

  // Reorder seer-like steps by label number when seerLabelMap is provided
  if (seerLabelMap) {
    const seerIndices: number[] = [];
    const seerSteps: NightPlanStep[] = [];
    for (let i = 0; i < steps.length; i++) {
      if (seerLabelMap[steps[i]!.roleId] != null) {
        seerIndices.push(i);
        seerSteps.push(steps[i]!);
      }
    }
    seerSteps.sort((a, b) => seerLabelMap[a.roleId]! - seerLabelMap[b.roleId]!);
    for (let i = 0; i < seerIndices.length; i++) {
      steps[seerIndices[i]!] = seerSteps[i]!;
    }
    // Recompute order
    steps = steps.map((s, i) => ({ ...s, order: i }));
  }

  return {
    steps,
    length: steps.length,
  };
}
