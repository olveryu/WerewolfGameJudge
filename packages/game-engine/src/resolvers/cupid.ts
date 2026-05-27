/**
 * Cupid Resolver (SERVER-ONLY, pure function)
 *
 * Validates lover selection and writes loverSeats.
 * Cupid acts after the deck card role, choosing two players as lovers (may include self).
 * No IO (network / audio / Alert).
 */

import { formatSeat } from '../utils/formatSeat';
import { validateConstraints } from './constraintValidator';
import type { ResolverFn } from './types';

/** Must choose exactly two players */
const REJECT_MUST_CHOOSE_TWO = '必须选择两名玩家成为情侣' as const;

/** Cannot choose duplicate players */
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
 * cupidLoversReveal — no-op resolver for the groupConfirm step.
 * This step is confirmed by all players (ack); actual confirmation logic is handled at the handler layer.
 */
export const cupidLoversRevealResolver: ResolverFn = () => {
  return { valid: true };
};
