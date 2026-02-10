/**
 * Seer Resolver (HOST-ONLY, 纯函数)
 *
 * 职责：校验预言家查验行动 + 返回目标阵营（好人/狼人）
 *
 * ✅ 允许：查验校验 + 使用 resolveRoleForChecks 统一角色解析（magician swap + wolfRobot disguise）
 * ❌ 禁止：IO（网络 / 音频 / Alert）
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 */

import { ROLE_SPECS } from '@/models/roles';
import { SCHEMAS } from '@/models/roles/spec/schemas';
import { getSeerCheckResultForTeam } from '@/models/roles/spec/types';

import { validateConstraints } from './constraintValidator';
import type { ResolverFn } from './types';
import { resolveRoleForChecks } from './types';

export const seerCheckResolver: ResolverFn = (context, input) => {
  const { actorSeat, players } = context;
  const target = input.target;

  // Schema allows skip (canSkip: true)
  // If target is null/undefined, treat as skip
  if (target === undefined || target === null) {
    return {
      valid: true,
      result: {}, // No check result (skipped)
    };
  }

  // Block guard is handled at actionHandler layer (single-point guard)

  // Validate constraints from schema
  const schema = SCHEMAS.seerCheck;
  const constraintResult = validateConstraints(schema.constraints, { actorSeat, target });
  if (!constraintResult.valid) {
    return { valid: false, rejectReason: constraintResult.rejectReason };
  }

  // Target must exist (check original role)
  const originalRoleId = players.get(target);
  if (!originalRoleId) {
    return { valid: false, rejectReason: '目标玩家不存在' };
  }

  // Get effective role using unified resolution (magician swap + wolfRobot disguise)
  const effectiveRoleId = resolveRoleForChecks(context, target);
  if (!effectiveRoleId) {
    return { valid: false, rejectReason: '目标玩家不存在' };
  }

  // Compute result: wolf team = '狼人', others = '好人'
  const targetSpec = ROLE_SPECS[effectiveRoleId];
  const checkResult = getSeerCheckResultForTeam(targetSpec.team);

  return {
    valid: true,
    result: { checkResult },
  };
};
