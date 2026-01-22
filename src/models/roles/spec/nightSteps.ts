/**
 * Night Steps Registry
 *
 * 夜晚步骤的单一真相。
 *
 * 数组顺序 = 权威顺序（无 order 字段）
 * step.id 即 schemaId（无需双字段）
 *
 * 策划维护：调顺序只需移动数组元素
 */

import type { StepSpec } from './nightSteps.types';

/**
 * NIGHT_STEPS - 夜晚步骤表
 *
 * 每个步骤代表一个角色在 Night-1 的行动。
 * 数组顺序即夜晚行动顺序。
 *
 * NOTE: 步骤可见性现由 schema.meeting 推导，不再在此定义。
 */
const NIGHT_STEPS_INTERNAL = [
  // === 特殊角色（最先行动）===
  {
    id: 'magicianSwap',
    roleId: 'magician',
    audioKey: 'magician',
  },
  {
    id: 'slackerChooseIdol',
    roleId: 'slacker',
    audioKey: 'slacker',
  },

  // === 守护/查验类（狼刀前）===
  {
    id: 'wolfRobotLearn',
    roleId: 'wolfRobot',
    audioKey: 'wolfRobot', // 必须与 RoleId 一致，AudioService 按 RoleId 查找音频
  },
  {
    id: 'dreamcatcherDream',
    roleId: 'dreamcatcher',
    audioKey: 'dreamcatcher',
  },
  {
    id: 'gargoyleCheck',
    roleId: 'gargoyle',
    audioKey: 'gargoyle',
  },
  {
    id: 'nightmareBlock',
    roleId: 'nightmare',
    audioKey: 'nightmare',
  },
  {
    id: 'guardProtect',
    roleId: 'guard',
    audioKey: 'guard',
  },

  // === 狼人会议阶段 ===
  {
    id: 'wolfKill',
    roleId: 'wolf',
    audioKey: 'wolf',
  },
  // 狼美人魅惑是个人行动（不是狼人会议），但在狼刀后执行
  {
    id: 'wolfQueenCharm',
    roleId: 'wolfQueen',
    audioKey: 'wolfQueen', // 必须与 RoleId 一致，AudioService 按 RoleId 查找音频
  },

  // === 女巫 ===
  {
    id: 'witchAction',
    roleId: 'witch',
    audioKey: 'witch',
  },

  // === 查验类 ===
  {
    id: 'seerCheck',
    roleId: 'seer',
    audioKey: 'seer',
  },
  {
    id: 'psychicCheck',
    roleId: 'psychic',
    audioKey: 'psychic',
  },

  // === 确认类 ===
  {
    id: 'hunterConfirm',
    roleId: 'hunter',
    audioKey: 'hunter',
  },
  {
    id: 'darkWolfKingConfirm',
    roleId: 'darkWolfKing',
    audioKey: 'darkWolfKing', // 必须与 RoleId 一致，AudioService 按 RoleId 查找音频
  },
] as const satisfies readonly StepSpec[];

/** Exported NIGHT_STEPS for external use */
export const NIGHT_STEPS: readonly StepSpec[] = NIGHT_STEPS_INTERNAL;

/** NightStepId 从 NIGHT_STEPS 自动推导，避免类型漂移 */
export type NightStepId = (typeof NIGHT_STEPS_INTERNAL)[number]['id'];

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
export function getAllStepIds(): NightStepId[] {
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
