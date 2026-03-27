/**
 * Night Steps Registry — 夜晚步骤表
 *
 * 从 ROLE_SPECS + NIGHT_STEP_ORDER 动态派生 NIGHT_STEPS 数组和查询函数。
 * 保留 StepSpec 接口，供 stepTransitionHandler / actionGuards / gameControlHandler 消费。
 * 不依赖 service、不含副作用，audioKey 不在 specs 中双写。
 */

import type { StepSpec } from './nightSteps.types';
import type { NightStepId } from './plan';
import { NIGHT_STEP_ORDER } from './plan';
import type { RoleSpec } from './roleSpec.types';
import type { SchemaId } from './schemas';
import { ROLE_SPECS, type RoleId } from './specs';

// =============================================================================
// Derive NIGHT_STEPS from ROLE_SPECS
// =============================================================================

function buildNightSteps(): readonly StepSpec[] {
  const stepIndex = new Map<string, StepSpec>();

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

/** NIGHT_STEPS — derived from ROLE_SPECS at module init */
export const NIGHT_STEPS: readonly StepSpec[] = buildNightSteps();

// =============================================================================
// Helper Functions
// =============================================================================

/** 通过 stepId 获取 StepSpec */
export function getStepSpec(stepId: string): StepSpec | undefined {
  return NIGHT_STEPS.find((s) => s.id === stepId);
}

/** 强类型版本：调用方传错 stepId 会在编译期报错 */
export function getStepSpecStrict(stepId: NightStepId): StepSpec {
  const step = getStepSpec(stepId);
  if (!step) {
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
