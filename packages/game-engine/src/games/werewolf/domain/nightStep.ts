/**
 * The single derivation point for "which night step is current".
 *
 * GameState stores only the step's identity (`nightStep.stepId`); the
 * step's position in the night plan, its plan entry, and its action
 * schema are derived here from `buildNightPlan` — never stored, so they
 * can never disagree with the stored id. Every consumer (engine
 * progression, visibility, client derivation) reads through this
 * function instead of re-deriving from status + index.
 */

import { type ActionSchema, buildNightPlan, getSchema, type SchemaId } from './models';
import type { NightPlanStep } from './models/roles/spec/plan';
import type { GameState } from './protocol/types';

export interface CurrentNightStep {
  readonly stepId: SchemaId;
  /** Index of stepId within buildNightPlan(state) — derived, never stored. */
  readonly index: number;
  readonly step: NightPlanStep;
  readonly schema: ActionSchema;
}

/**
 * @pre state has passed the state boundary (normalize/parse), so an
 * inStep stepId is guaranteed to be a member of the state's plan.
 * @throws FAIL-FAST when stepId is not in the plan (corrupt state that
 * bypassed the boundary).
 */
export function resolveCurrentNightStep(state: GameState): CurrentNightStep | null {
  const nightStep = state.nightStep;
  if (nightStep?.kind !== 'inStep') return null;
  const plan = buildNightPlan(state.templateRoles, state.seerLabelMap);
  const index = plan.steps.findIndex((s) => s.stepId === nightStep.stepId);
  if (index < 0) {
    throw new Error(`[FAIL-FAST] night step ${nightStep.stepId} is not in the night plan`);
  }
  const step = plan.steps[index]!;
  return { stepId: step.stepId, index, step, schema: getSchema(step.stepId) };
}
