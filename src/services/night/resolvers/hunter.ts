/**
 * Hunter Confirm Resolver (HOST-ONLY)
 * 
 * Validates hunter confirm action.
 * Hunter just confirms their status (no target selection).
 */

import type { ResolverFn } from './types';

export const hunterConfirmResolver: ResolverFn = (_context, input) => {
  // Hunter confirm is always valid - just acknowledging status
  return {
    valid: true,
    result: {},
  };
};
