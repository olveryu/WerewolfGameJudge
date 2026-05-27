/**
 * Magician Resolver (SERVER-ONLY, pure function)
 *
 * Validates the magician's swap action and computes swap result.
 * Provides swap target validation and result calculation (including skip). No IO (network / audio / Alert).
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 */

import type { ResolverFn } from './types';

export const magicianSwapResolver: ResolverFn = (context, input) => {
  const { players } = context;
  const targets = input.targets;

  // Magician can skip
  if (!targets || targets.length === 0) {
    return { valid: true, result: {} };
  }

  // Block guard is handled at actionHandler layer (single-point guard)

  // Must select exactly 2 targets
  if (targets.length !== 2) {
    return { valid: false, rejectReason: '必须选择两名交换对象' };
  }

  const target1 = targets[0]!;
  const target2 = targets[1]!;

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
