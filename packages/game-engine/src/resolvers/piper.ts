/**
 * Piper Resolvers (SERVER-ONLY, 纯函数)
 *
 * 职责：
 * - piperHypnotizeResolver: 校验吹笛者催眠行动（选择 1-2 名目标）+ 写入 hypnotizedSeats。
 * - piperHypnotizedRevealResolver: groupConfirm 步骤的 no-op resolver（ack 由 handler 层处理）。
 * 提供多目标校验。
 * 不包含 IO（网络 / 音频 / Alert）。
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 */

import { SCHEMAS } from '../models';
import type { MultiChooseSeatSchema } from '../models/roles/spec/schema.types';
import { validateConstraints } from './constraintValidator';
import type { ResolverContext, ResolverFn } from './types';

export const piperHypnotizeResolver: ResolverFn = (context: ResolverContext, input) => {
  const { actorSeat, players } = context;
  const targets = input.targets;
  const schema: MultiChooseSeatSchema = SCHEMAS.piperHypnotize as MultiChooseSeatSchema;

  // Piper can skip (canSkip: true)
  if (!targets || targets.length === 0) {
    return { valid: true, result: {} };
  }

  // Validate target count
  if (targets.length < schema.minTargets || targets.length > schema.maxTargets) {
    return {
      valid: false,
      rejectReason: `必须选择${schema.minTargets}-${schema.maxTargets}名玩家`,
    };
  }

  // Check for duplicate targets
  if (new Set(targets).size !== targets.length) {
    return { valid: false, rejectReason: '不能选择重复的玩家' };
  }

  // Validate each target against constraints
  for (const target of targets) {
    const constraintResult = validateConstraints(schema.constraints, { actorSeat, target });
    if (!constraintResult.valid) {
      return { valid: false, rejectReason: constraintResult.rejectReason };
    }

    // Target must exist
    if (!players.has(target)) {
      return { valid: false, rejectReason: `${target}号玩家不存在` };
    }
  }

  return {
    valid: true,
    updates: { hypnotizedSeats: [...targets].sort((a, b) => a - b) },
    result: { hypnotizedTargets: targets },
  };
};

/**
 * piperHypnotizedReveal — groupConfirm 步骤的 no-op resolver。
 *
 * 此步骤由所有玩家确认（ack），实际确认逻辑由 handler 层处理。
 * Resolver 仅做最小校验，确保 contract test 覆盖完整。
 */
export const piperHypnotizedRevealResolver: ResolverFn = (_context, input) => {
  // groupConfirm step: player confirms they've seen hypnotized status
  if (input.confirmed) {
    return { valid: true };
  }
  // No confirmation = valid no-op (step is managed by handler)
  return { valid: true };
};
