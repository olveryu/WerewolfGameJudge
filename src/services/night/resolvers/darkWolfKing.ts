/**
 * Dark Wolf King Confirm Resolver (HOST-ONLY)
 *
 * Validates dark wolf king confirm action.
 * Dark wolf king just confirms their status (no target selection).
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 * This resolver only validates the confirm action itself.
 */

import type { ResolverFn } from './types';

export const darkWolfKingConfirmResolver: ResolverFn = () => {
  // Dark wolf king confirm is always valid
  // Block guard (blocked → reject confirmed=true; not blocked → reject skip) is at handler layer
  return {
    valid: true,
    result: {},
  };
};
