/**
 * Cupid Resolver (SERVER-ONLY, 纯函数)
 *
 * 职责：校验情侣选择 + 写入 loverSeats。
 * cupid 在底牌角色之后行动，选择两名玩家成为情侣（可含自己）。
 * 不包含 IO（网络 / 音频 / Alert）。
 */

import { formatSeat } from '../utils/formatSeat';
import { validateConstraints } from './constraintValidator';
import type { ResolverFn } from './types';

/** 必须选择两名玩家 */
const REJECT_MUST_CHOOSE_TWO = '必须选择两名玩家成为情侣' as const;

/** 不能选择重复的玩家 */
const REJECT_DUPLICATE = '不能选择重复的玩家' as const;

export const cupidChooseLoversResolver: ResolverFn = (context, input) => {
  const { actorSeat, players } = context;
  const targets = input.targets;

  // Must choose exactly 2 targets
  if (!targets || targets.length !== 2) {
    return { valid: false, rejectReason: REJECT_MUST_CHOOSE_TWO };
  }

  // Check for duplicates
  if (targets[0] === targets[1]) {
    return { valid: false, rejectReason: REJECT_DUPLICATE };
  }

  // Validate each target
  for (const target of targets) {
    // No constraints (cupid can choose self), but validate target exists
    const constraintResult = validateConstraints([], { actorSeat, target });
    if (!constraintResult.valid) {
      return { valid: false, rejectReason: constraintResult.rejectReason };
    }

    if (!players.has(target)) {
      return { valid: false, rejectReason: `${formatSeat(target)}玩家不存在` };
    }
  }

  const sortedTargets = [...targets].sort((a, b) => a - b) as [number, number];

  return {
    valid: true,
    updates: {
      loverSeats: sortedTargets,
    },
    result: {},
  };
};

/**
 * cupidLoversReveal — groupConfirm 步骤的 no-op resolver。
 * 此步骤由所有玩家确认（ack），实际确认逻辑由 handler 层处理。
 */
export const cupidLoversRevealResolver: ResolverFn = () => {
  return { valid: true };
};
