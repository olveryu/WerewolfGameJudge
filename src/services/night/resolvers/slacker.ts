/**
 * Slacker Resolver (HOST-ONLY)
 * 
 * Validates slacker choose idol action and computes result.
 */

import type { ResolverFn } from './types';

export const slackerChooseIdolResolver: ResolverFn = (context, input) => {
  const { actorSeat, players, currentNightResults } = context;
  const target = input.target;
  
  // Validate target exists (slacker must choose someone)
  if (target === undefined || target === null) {
    return { valid: false, rejectReason: '必须选择榜样' };
  }
  
  // Cannot choose self
  if (target === actorSeat) {
    return { valid: false, rejectReason: '不能选择自己作为榜样' };
  }
  
  // Target must exist
  if (!players.has(target)) {
    return { valid: false, rejectReason: '目标玩家不存在' };
  }
  
  // Check blocked by nightmare
  if (currentNightResults.blockedSeat === actorSeat) {
    return { valid: true, result: {} };
  }
  
  return {
    valid: true,
    result: { idolTarget: target },
  };
};
