/**
 * Wolf Queen Resolver (HOST-ONLY)
 * 
 * Validates wolf queen charm action and computes result.
 */

import type { ResolverFn } from './types';

export const wolfQueenCharmResolver: ResolverFn = (context, input) => {
  const { actorSeat, players, currentNightResults } = context;
  const target = input.target;
  
  // Wolf queen can skip (choose not to charm anyone)
  if (target === undefined || target === null) {
    return { valid: true, result: {} };
  }
  
  // Check blocked by nightmare
  if (currentNightResults.blockedSeat === actorSeat) {
    return { valid: true, result: {} };
  }
  
  // Cannot charm self
  if (target === actorSeat) {
    return { valid: false, rejectReason: '不能魅惑自己' };
  }
  
  // Target must exist
  if (!players.has(target)) {
    return { valid: false, rejectReason: '目标玩家不存在' };
  }
  
  return {
    valid: true,
    result: { charmTarget: target },
  };
};
