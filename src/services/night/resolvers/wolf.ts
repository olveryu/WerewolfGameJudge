/**
 * Wolf Kill Resolver (HOST-ONLY)
 *
 * Validates wolf kill action and computes result.
 */

import type { ResolverFn } from './types';

export const wolfKillResolver: ResolverFn = (context, input) => {
  const { players, currentNightResults } = context;
  const target = input.target;

  // Check if wolf kill is disabled (nightmare blocked a wolf)
  if (currentNightResults.wolfKillDisabled) {
    return {
      valid: true,
      result: {}, // No kill this night
    };
  }

  // 空刀 (empty knife): schema allows this via allowEmptyVote: true
  if (target === undefined || target === null) {
    return {
      valid: true,
      result: {}, // No kill target
    };
  }

  // Target must exist
  const targetRoleId = players.get(target);
  if (!targetRoleId) {
    return { valid: false, rejectReason: '目标玩家不存在' };
  }

  // Neutral judge: wolves can target ANY seat (including self / wolf teammates / spiritKnight).
  // Death calculation (including spiritKnight immunity) is handled in DeathCalculator.

  return {
    valid: true,
    updates: { wolfKillTarget: target },
    result: { wolfKillTarget: target },
  };
};
