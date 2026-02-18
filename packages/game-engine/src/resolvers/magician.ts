/**
 * Magician Resolver (HOST-ONLY, 纯函数)
 *
 * 职责：校验魔术师交换行动 + 计算交换结果，
 * 提供交换目标校验与结果计算（含跳过交换）。不包含 IO（网络 / 音频 / Alert）。
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
