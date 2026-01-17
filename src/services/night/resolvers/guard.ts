/**
 * Guard Resolver (HOST-ONLY)
 *
 * Validates guard protect action and computes result.
 */

import type { ResolverFn } from './types';

export const guardProtectResolver: ResolverFn = (context, input) => {
  const { actorSeat, currentNightResults } = context;
  const target = input.target;

  // Guard can skip (choose not to protect anyone)
  if (target === undefined || target === null) {
    return { valid: true, result: {} };
  }

  // Check blocked by nightmare
  if (currentNightResults.blockedSeat === actorSeat) {
    return { valid: true, result: {} };
  }

  // Night-1-only scope: no cross-night restriction.

  return {
    valid: true,
    updates: { guardedSeat: target },
    result: { guardedTarget: target },
  };
};
