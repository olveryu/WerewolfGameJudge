/**
 * Magician Resolver (HOST-ONLY)
 *
 * Validates magician swap action and computes result.
 *
 * RULE: If blocked by nightmare, non-skip actions are REJECTED (not just no-op).
 */

import { BLOCKED_UI_DEFAULTS } from '../../../models/roles/spec';
import type { ResolverFn } from './types';

export const magicianSwapResolver: ResolverFn = (context, input) => {
  const { actorSeat, players, currentNightResults } = context;
  const targets = input.targets;

  // Magician can skip
  if (!targets || targets.length === 0) {
    return { valid: true, result: {} };
  }

  // Check blocked by nightmare - non-skip actions are REJECTED
  if (currentNightResults.blockedSeat === actorSeat) {
    return { valid: false, rejectReason: BLOCKED_UI_DEFAULTS.message };
  }

  // Must select exactly 2 targets
  if (targets.length !== 2) {
    return { valid: false, rejectReason: '必须选择两名交换对象' };
  }

  const [target1, target2] = targets;

  // Cannot swap with non-existent players
  if (!players.has(target1) || !players.has(target2)) {
    return { valid: false, rejectReason: '目标玩家不存在' };
  }

  // Cannot swap same player
  if (target1 === target2) {
    return { valid: false, rejectReason: '不能选择同一个玩家' };
  }

  return {
    valid: true,
    updates: { swappedSeats: [target1, target2] },
    result: { swapTargets: [target1, target2] },
  };
};
