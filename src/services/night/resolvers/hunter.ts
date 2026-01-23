/**
 * Hunter Confirm Resolver (HOST-ONLY)
 *
 * Validates hunter confirm action.
 * Hunter just confirms their status (no target selection).
 *
 * RULE: If blocked by nightmare, non-skip (confirmed=true) actions are REJECTED.
 */

import { BLOCKED_UI_DEFAULTS } from '../../../models/roles/spec';
import type { ResolverFn } from './types';

export const hunterConfirmResolver: ResolverFn = (context, input) => {
  const { actorSeat, currentNightResults } = context;
  const confirmed = input.confirmed;

  // Skip (confirmed === false or undefined) is always allowed
  if (!confirmed) {
    return { valid: true, result: {} };
  }

  // Check blocked by nightmare - confirmed action is REJECTED
  if (currentNightResults.blockedSeat === actorSeat) {
    return { valid: false, rejectReason: BLOCKED_UI_DEFAULTS.message };
  }

  // Hunter confirm is valid
  return {
    valid: true,
    result: {},
  };
};
