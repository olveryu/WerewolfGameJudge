/**
 * Night Steps Registry — night steps table
 *
 * Dynamically derives the NIGHT_STEPS array and query functions from ROLE_SPECS + NIGHT_STEP_ORDER.
 * Review and player projections use the registry to map roles to their night steps.
 * No service dependencies, no side effects; audioKey is not duplicated in the specs.
 */

import type { StepSpec } from './nightSteps.types';
import type { NightStepId } from './plan';
import { NIGHT_STEP_ORDER } from './plan';
import { getAllRoleIds, getRoleSpec } from './specs';

// =============================================================================
// Derive NIGHT_STEPS from ROLE_SPECS
// =============================================================================

function buildNightSteps(): readonly StepSpec[] {
  const stepIndex = new Map<NightStepId, StepSpec>();

  for (const roleId of getAllRoleIds()) {
    const spec = getRoleSpec(roleId);
    for (const ns of spec.nightSteps ?? []) {
      if (stepIndex.has(ns.stepId)) {
        throw new Error(`[nightSteps] Duplicate night step: ${ns.stepId}`);
      }
      stepIndex.set(ns.stepId, {
        id: ns.stepId,
        roleId,
        audioKey: ns.audioKey ?? roleId,
        ...(ns.audioEndKey ? { audioEndKey: ns.audioEndKey } : {}),
      });
    }
  }

  // Return in NIGHT_STEP_ORDER sequence
  const result: StepSpec[] = [];
  for (const stepId of NIGHT_STEP_ORDER) {
    const spec = stepIndex.get(stepId);
    if (!spec) {
      throw new Error(`[nightSteps] Missing role specification for night step: ${stepId}`);
    }
    result.push(spec);
  }
  return result;
}

/** NIGHT_STEPS — derived from ROLE_SPECS at module init */
export const NIGHT_STEPS: readonly StepSpec[] = buildNightSteps();

// =============================================================================
// Helper Functions
// =============================================================================

/** Get StepSpec by stepId */
export function getStepSpec(stepId: string): StepSpec | undefined {
  return NIGHT_STEPS.find((s) => s.id === stepId);
}
