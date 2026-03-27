/**
 * Night Steps Registry — re-export layer (to be removed in P9-C)
 */

import type { StepSpec } from './nightSteps.types';
import type { SchemaId } from './schemas';
import type { RoleId } from './specs';
import type { NightStepId } from './v2/nightPlan';
import { NIGHT_STEP_ORDER } from './v2/nightPlan';
import type { RoleSpec } from './v2/roleSpec.types';
import { ROLE_SPECS } from './v2/specs';

// =============================================================================
// Derive NIGHT_STEPS from V2 data
// =============================================================================

function buildNightSteps(): readonly StepSpec[] {
  const stepIndex = new Map<string, StepSpec>();

  // Index all nightSteps from all V2 role specs
  for (const [roleId, spec] of Object.entries(ROLE_SPECS)) {
    for (const ns of (spec as RoleSpec).nightSteps ?? []) {
      stepIndex.set(ns.stepId, {
        id: ns.stepId as SchemaId,
        roleId: roleId as RoleId,
        audioKey: ns.audioKey ?? roleId,
        ...(ns.audioEndKey ? { audioEndKey: ns.audioEndKey } : {}),
      });
    }
  }

  // Return in NIGHT_STEP_ORDER sequence
  const result: StepSpec[] = [];
  for (const stepId of NIGHT_STEP_ORDER) {
    const spec = stepIndex.get(stepId);
    if (spec) result.push(spec);
  }
  return result;
}

/** Exported NIGHT_STEPS — derived from V2 at module init */
export const NIGHT_STEPS: readonly StepSpec[] = buildNightSteps();

// === Helper functions ===

/** 通过 stepId 获取 StepSpec */
export function getStepSpec(stepId: string): StepSpec | undefined {
  return NIGHT_STEPS.find((s) => s.id === stepId);
}

/** 强类型版本：调用方传错 stepId 会在编译期报错 */
export function getStepSpecStrict(stepId: NightStepId): StepSpec {
  const step = getStepSpec(stepId);
  if (!step) {
    // should be unreachable: NightStepId is derived from NIGHT_STEPS
    throw new Error(`[nightSteps] Unknown stepId: ${stepId}`);
  }
  return step;
}

/** 获取所有 stepId（按顺序） */
export function getAllStepIds(): SchemaId[] {
  return NIGHT_STEPS.map((s) => s.id);
}

/** 通过 roleId 获取该角色的步骤 */
export function getStepsByRole(roleId: string): StepSpec[] {
  return NIGHT_STEPS.filter((s) => s.roleId === roleId);
}

/** 强类型版本：调用方传错 roleId 会在编译期报错 */
export function getStepsByRoleStrict(roleId: StepSpec['roleId']): StepSpec[] {
  return getStepsByRole(roleId);
}
