/**
 * Dark Wolf King Confirm Resolver (HOST-ONLY)
 *
 * Validates dark wolf king confirm action.
 * Dark wolf king just confirms their status (no target selection).
 */

import type { ResolverFn } from './types';

export const darkWolfKingConfirmResolver: ResolverFn = (_context, _input) => {
  // Dark wolf king confirm is always valid - just acknowledging status
  return {
    valid: true,
    result: {},
  };
};
