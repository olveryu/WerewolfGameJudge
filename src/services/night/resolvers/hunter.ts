/**
 * Hunter Confirm Resolver (HOST-ONLY)
 *
 * Validates hunter confirm action.
 * Hunter just confirms their status (no target selection).
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 * This resolver only validates the confirm action itself.
 */

import type { ResolverFn } from './types';

export const hunterConfirmResolver: ResolverFn = () => {
  // Hunter confirm is always valid
  // Block guard (blocked → reject confirmed=true; not blocked → reject skip) is at handler layer
  return {
    valid: true,
    result: {},
  };
};
