/**
 * V2 Night Plan Builder — 从 ROLE_SPECS_V2 构建夜晚行动序列
 *
 * 替代 V1 的 buildNightPlan（依赖 NIGHT_STEPS 数组）。
 * NIGHT_STEP_ORDER 定义全局步骤执行顺序，各角色的 nightSteps 提供步骤详情。
 * 导出 buildNightPlanFromV2 纯函数，不依赖 service、不含副作用或 IO。
 */

import type { NightPlan, NightPlanStep } from '../plan.types';
import { NightPlanBuildError } from '../plan.types';
import type { RoleId } from '../specs';
import type { NightStepDef, RoleSpecV2 } from './roleSpec.types';
import { ROLE_SPECS_V2 } from './specs';

// =============================================================================
// NIGHT_STEP_ORDER — 全局步骤执行顺序（单一真相）
// =============================================================================

/**
 * Global step execution order.
 *
 * Array position = authority. Replaces V1's NIGHT_STEPS array ordering.
 * Each entry is a stepId matching a NightStepDef.stepId in ROLE_SPECS_V2.
 */
const NIGHT_STEP_ORDER_INTERNAL = [
  // === 特殊角色（最先行动）===
  'magicianSwap',
  'slackerChooseIdol',
  'wildChildChooseIdol',
  'shadowChooseMimic',
  'avengerConfirm',

  // === 守护/查验类（袭击前）===
  'nightmareBlock',
  'dreamcatcherDream',
  'guardProtect',
  'silenceElderSilence',
  'votebanElderBan',

  // === 狼人会议阶段 ===
  'wolfKill',
  'wolfQueenCharm',

  // === 女巫 ===
  'witchAction',

  // === 确认类 ===
  'hunterConfirm',
  'darkWolfKingConfirm',

  // === 最后四个角色（机械狼 → 预言家 → 石像鬼 → 通灵师）===
  'wolfRobotLearn',
  'seerCheck',
  'mirrorSeerCheck',
  'drunkSeerCheck',
  'wolfWitchCheck',
  'gargoyleCheck',
  'pureWhiteCheck',
  'psychicCheck',

  // === 觉醒石像鬼转化（查验类之后）===
  'awakenedGargoyleConvert',

  // === 吹笛者（催眠 → 全员确认）===
  'piperHypnotize',
  'piperHypnotizedReveal',

  // === 觉醒石像鬼转化揭示（最后）===
  'awakenedGargoyleConvertReveal',
] as const;

/** Public readonly array for external consumers. */
export const NIGHT_STEP_ORDER: readonly string[] = NIGHT_STEP_ORDER_INTERNAL;

/** Literal union of all step IDs (= SchemaId). Derived from NIGHT_STEP_ORDER. */
export type NightStepId = (typeof NIGHT_STEP_ORDER_INTERNAL)[number];

// =============================================================================
// Builder
// =============================================================================

type V2RoleId = keyof typeof ROLE_SPECS_V2;

function isValidV2RoleId(id: string): id is V2RoleId {
  return id in ROLE_SPECS_V2;
}

/**
 * Build night plan from template roles using V2 spec data.
 *
 * @param templateRoles - Array of role IDs in the template (must be canonical RoleIds)
 * @param seerLabelMap - Optional label numbers for seer-like roles (for display ordering)
 * @returns NightPlan with ordered steps
 * @throws NightPlanBuildError if any roleId is invalid (fail-fast)
 */
export function buildNightPlanFromV2(
  templateRoles: readonly string[],
  seerLabelMap?: Readonly<Record<string, number>>,
): NightPlan {
  // Fail-fast: validate all roleIds
  const invalidRoleIds = templateRoles.filter((id) => !isValidV2RoleId(id));
  if (invalidRoleIds.length > 0) {
    throw new NightPlanBuildError(
      `Invalid roleIds in template: ${invalidRoleIds.join(', ')}. All roleIds must be canonical.`,
      invalidRoleIds,
    );
  }

  const templateRoleSet = new Set(templateRoles);

  // Check if any wolf participates in vote (for wolfKill step inclusion)
  const hasWolfVotingParticipant = templateRoles.some((roleId) => {
    const spec: RoleSpecV2 = ROLE_SPECS_V2[roleId as V2RoleId];
    return spec.recognition?.participatesInWolfVote === true;
  });

  // Collect step definitions from V2 specs
  const stepMap = new Map<string, { roleId: string; stepDef: NightStepDef }>();

  for (const roleId of Object.keys(ROLE_SPECS_V2) as V2RoleId[]) {
    const spec: RoleSpecV2 = ROLE_SPECS_V2[roleId];
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
      const spec: RoleSpecV2 = ROLE_SPECS_V2[roleId as V2RoleId];
      return {
        roleId: roleId as RoleId,
        stepId: stepId as NightStepId,
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
      if (seerLabelMap[steps[i].roleId] != null) {
        seerIndices.push(i);
        seerSteps.push(steps[i]);
      }
    }
    seerSteps.sort((a, b) => seerLabelMap[a.roleId]! - seerLabelMap[b.roleId]!);
    for (let i = 0; i < seerIndices.length; i++) {
      steps[seerIndices[i]] = seerSteps[i];
    }
    // Recompute order
    steps = steps.map((s, i) => ({ ...s, order: i }));
  }

  return {
    steps,
    length: steps.length,
  };
}
