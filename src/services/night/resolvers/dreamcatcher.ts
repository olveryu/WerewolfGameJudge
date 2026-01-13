/**
 * Dreamcatcher Resolver (HOST-ONLY)
 * 
 * Validates dreamcatcher action and computes result.
 */

import type { ResolverFn } from './types';

export const dreamcatcherDreamResolver: ResolverFn = (context, input) => {
  const { actorSeat, previousActions, currentNightResults } = context;
  const target = input.target;
  
  // Validate target exists (dreamcatcher must choose someone)
  if (target === undefined || target === null) {
    return { valid: false, rejectReason: '必须选择摄梦对象' };
  }
  
  // Cannot dream self
  if (target === actorSeat) {
    return { valid: false, rejectReason: '不能摄梦自己' };
  }
  
  // Check blocked by nightmare
  if (currentNightResults.blockedSeat === actorSeat) {
    return { valid: true, result: {} };
  }
  
  // Cannot dream same player two nights in a row
  const lastDreamTarget = previousActions?.get('dreamcatcher');
  if (lastDreamTarget === target) {
    return { valid: false, rejectReason: '不能连续两晚摄梦同一玩家' };
  }
  
  return {
    valid: true,
    updates: { dreamingSeat: target },
    result: { dreamTarget: target },
  };
};
