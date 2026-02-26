/**
 * Piper Resolvers (SERVER-ONLY, 纯函数)
 *
 * 职责：
 * - piperHypnotizeResolver: 校验吹笛者催眠行动（选择 1-2 名目标）+ 计算累积催眠结果。
 * - piperHypnotizedRevealResolver: groupConfirm 步骤的 no-op resolver（ack 由 handler 层处理）。
 * 提供多目标校验与 hypnotizedSeats 累积计算。
 * 不包含 IO（网络 / 音频 / Alert）。
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 */

import { SCHEMAS } from '../models/roles/spec/schemas';
import { validateConstraints } from './constraintValidator';
import type { ResolverContext, ResolverFn } from './types';

/**
 * Merge newly hypnotized seats into accumulated hypnotizedSeats (deduplicated).
 */
function mergeHypnotizedSeats(
  existing: readonly number[] | undefined,
  newTargets: readonly number[],
): readonly number[] {
  const set = new Set(existing ?? []);
  for (const t of newTargets) {
    set.add(t);
  }
  return [...set].sort((a, b) => a - b);
}

export const piperHypnotizeResolver: ResolverFn = (context: ResolverContext, input) => {
  const { actorSeat, players } = context;
  const targets = input.targets;
  const schema = SCHEMAS.piperHypnotize;

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

  // Cannot hypnotize already-hypnotized players
  const existingHypnotized = context.gameState.hypnotizedSeats ?? [];
  for (const target of targets) {
    if (existingHypnotized.includes(target)) {
      return { valid: false, rejectReason: `${target}号玩家已被催眠` };
    }
  }

  // Merge new targets into accumulated hypnotizedSeats
  const updatedHypnotizedSeats = mergeHypnotizedSeats(existingHypnotized, targets);

  return {
    valid: true,
    updates: { hypnotizedSeats: updatedHypnotizedSeats },
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
