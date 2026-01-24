/**
 * Guard Resolver (HOST-ONLY)
 *
 * Validates guard protect action and computes result.
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 */

import type { ResolverFn } from './types';

export const guardProtectResolver: ResolverFn = (context, input) => {
  const target = input.target;

  // Guard can skip (choose not to protect anyone)
  if (target === undefined || target === null) {
    return { valid: true, result: {} };
  }

  // Block guard is handled at actionHandler layer (single-point guard)

  // Night-1-only scope: no cross-night restriction.

  return {
    valid: true,
    updates: { guardedSeat: target },
    result: { guardedTarget: target },
  };
};
