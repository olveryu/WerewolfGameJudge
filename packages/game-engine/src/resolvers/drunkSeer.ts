/**
 * DrunkSeer Resolver (HOST-ONLY, 纯函数)
 *
 * 职责：校验酒鬼预言家查验行动 + 返回随机化后的目标阵营。
 * 查验结果随机：50% 概率正确，50% 概率反转。
 * 使用 resolveRoleForChecks 统一角色解析（magician swap + wolfRobot disguise）。
 * 不包含 IO（网络 / 音频 / Alert）。
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 */

import { ROLE_SPECS } from '../models/roles';
import { SCHEMAS } from '../models/roles/spec/schemas';
import { getSeerCheckResultForTeam } from '../models/roles/spec/types';
import { validateConstraints } from './constraintValidator';
import type { ResolverFn } from './types';
import { resolveRoleForChecks } from './types';

/**
 * Invert seer check result: '好人' → '狼人', '狼人' → '好人'
 */
function invertCheckResult(result: '好人' | '狼人'): '好人' | '狼人' {
  return result === '好人' ? '狼人' : '好人';
}

export const drunkSeerCheckResolver: ResolverFn = (context, input) => {
  const { actorSeat, players } = context;
  const target = input.target;

  // Schema allows skip (canSkip: true)
  if (target === undefined || target === null) {
    return {
      valid: true,
      result: {},
    };
  }

  // Validate constraints from schema
  const schema = SCHEMAS.drunkSeerCheck;
  const constraintResult = validateConstraints(schema.constraints, { actorSeat, target });
  if (!constraintResult.valid) {
    return { valid: false, rejectReason: constraintResult.rejectReason };
  }

  // Target must exist
  const originalRoleId = players.get(target);
  if (!originalRoleId) {
    return { valid: false, rejectReason: '目标玩家不存在' };
  }

  // Get effective role using unified resolution (magician swap + wolfRobot disguise)
  const effectiveRoleId = resolveRoleForChecks(context, target);
  if (!effectiveRoleId) {
    return { valid: false, rejectReason: '目标玩家不存在' };
  }

  // Compute result: RANDOM — 50% correct, 50% inverted
  const targetSpec = ROLE_SPECS[effectiveRoleId];
  const normalResult = getSeerCheckResultForTeam(targetSpec.team);
  const isCorrect = Math.random() >= 0.5;
  const checkResult = isCorrect ? normalResult : invertCheckResult(normalResult);

  return {
    valid: true,
    result: { checkResult },
  };
};
