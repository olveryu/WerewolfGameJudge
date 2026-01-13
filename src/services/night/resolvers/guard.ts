/**
 * Guard Resolver (HOST-ONLY)
 * 
 * Validates guard protect action and computes result.
 */

import type { ResolverFn } from './types';

export const guardProtectResolver: ResolverFn = (context, input) => {
  const { actorSeat, previousActions, currentNightResults } = context;
  const target = input.target;
  
  // Guard can skip (choose not to protect anyone)
  if (target === undefined || target === null) {
    return { valid: true, result: {} };
  }
  
  // Check blocked by nightmare
  if (currentNightResults.blockedSeat === actorSeat) {
    return { valid: true, result: {} };
  }
  
  // Cannot protect same player two nights in a row
  const lastGuardedTarget = previousActions?.get('guard');
  if (lastGuardedTarget === target) {
    return { valid: false, rejectReason: '不能连续两晚守护同一玩家' };
  }
  
  return {
    valid: true,
    updates: { guardedSeat: target },
    result: { guardedTarget: target },
  };
};
