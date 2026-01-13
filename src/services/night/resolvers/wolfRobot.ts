/**
 * Wolf Robot Resolver (HOST-ONLY)
 * 
 * Validates wolf robot learn action and computes result.
 * Returns exact role identity.
 */

import type { ResolverFn } from './types';

export const wolfRobotLearnResolver: ResolverFn = (context, input) => {
  const { actorSeat, players, currentNightResults } = context;
  const target = input.target;
  
  // Validate target exists
  if (target === undefined || target === null) {
    return { valid: false, rejectReason: '必须选择学习对象' };
  }
  
  // Cannot learn self
  if (target === actorSeat) {
    return { valid: false, rejectReason: '不能学习自己' };
  }
  
  // Target must exist
  const targetRoleId = players.get(target);
  if (!targetRoleId) {
    return { valid: false, rejectReason: '目标玩家不存在' };
  }
  
  // Check blocked by nightmare
  if (currentNightResults.blockedSeat === actorSeat) {
    return { valid: true, result: {} };
  }
  
  // Return learned role identity
  return {
    valid: true,
    result: { 
      learnTarget: target,
      identityResult: targetRoleId,
    },
  };
};
