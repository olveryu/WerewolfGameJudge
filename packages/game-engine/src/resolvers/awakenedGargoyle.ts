/**
 * Awakened Gargoyle Resolvers (SERVER-ONLY, 纯函数)
 *
 * 职责：
 * - awakenedGargoyleConvertResolver: 校验觉醒石像鬼转化行动（选择狼人阵营相邻的一名非狼非己玩家）。
 * - awakenedGargoyleConvertRevealResolver: groupConfirm 步骤的 no-op resolver（ack 由 handler 层处理）。
 * 不包含 IO（网络 / 音频 / Alert）。
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 */

import { SCHEMAS } from '../models';
import type { ChooseSeatSchema } from '../models/roles/spec/schema.types';
import { validateConstraints } from './constraintValidator';
import type { ResolverContext, ResolverFn } from './types';

export const awakenedGargoyleConvertResolver: ResolverFn = (context: ResolverContext, input) => {
  const { actorSeat, players, currentNightResults } = context;
  const target = input.target;
  const schema: ChooseSeatSchema = SCHEMAS.awakenedGargoyleConvert as ChooseSeatSchema;

  // canSkip: false — 强制发动，不允许跳过
  if (target === undefined || target === null) {
    return { valid: false, rejectReason: '觉醒石像鬼必须选择转化目标' };
  }

  // Validate constraints: NotSelf + AdjacentToWolfFaction
  const totalSeats = players.size;
  const constraintResult = validateConstraints(schema.constraints, {
    actorSeat,
    target,
    players,
    swappedSeats: currentNightResults.swappedSeats,
    totalSeats,
  });
  if (!constraintResult.valid) {
    return { valid: false, rejectReason: constraintResult.rejectReason };
  }

  // Target must exist
  if (!players.has(target)) {
    return { valid: false, rejectReason: '目标玩家不存在' };
  }

  return {
    valid: true,
    updates: { convertedSeat: target },
    result: { convertTarget: target },
  };
};

/**
 * awakenedGargoyleConvertReveal — groupConfirm 步骤的 no-op resolver。
 *
 * 此步骤由所有玩家确认（ack），实际确认逻辑由 handler 层处理。
 * Resolver 仅做最小校验，确保 contract test 覆盖完整。
 */
export const awakenedGargoyleConvertRevealResolver: ResolverFn = (_context, input) => {
  // groupConfirm step: player confirms they've seen conversion status
  if (input.confirmed) {
    return { valid: true };
  }
  // No confirmation = valid no-op (step is managed by handler)
  return { valid: true };
};
