/**
 * PureWhite Resolver (HOST-ONLY, 纯函数)
 *
 * 职责：校验纯白之女查验行动 + 返回精确角色身份（不只是阵营），
 * 提供查验校验并使用 resolveRoleForChecks 统一角色解析（magician swap + wolfRobot disguise）。
 * 不包含 IO（网络 / 音频 / Alert）。
 * Night-1 scope: 仅查验身份，"从第二夜起查验出局"不在当前 scope。
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 */

import { SCHEMAS } from '../models/roles/spec/schemas';
import { validateConstraints } from './constraintValidator';
import type { ResolverFn } from './types';
import { resolveRoleForChecks } from './types';

export const pureWhiteCheckResolver: ResolverFn = (context, input) => {
  const { actorSeat, players } = context;
  const target = input.target;

  // Allow skip (schema.canSkip: true)
  if (target === undefined || target === null) {
    return { valid: true, result: {} };
  }

  // Block guard is handled at actionHandler layer (single-point guard)

  // Validate constraints from schema
  const schema = SCHEMAS.pureWhiteCheck;
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

  // Return exact role identity (after swap and disguise)
  return {
    valid: true,
    result: { identityResult: effectiveRoleId },
  };
};
