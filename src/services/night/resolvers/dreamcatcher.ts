/**
 * Dreamcatcher Resolver (HOST-ONLY)
 *
 * Validates dreamcatcher action and computes result.
 *
 * RULE: If blocked by nightmare, non-skip actions are REJECTED (not just no-op).
 */

import { SCHEMAS, BLOCKED_UI_DEFAULTS } from '../../../models/roles/spec/schemas';
import { validateConstraints } from './constraintValidator';
import type { ResolverFn } from './types';

export const dreamcatcherDreamResolver: ResolverFn = (context, input) => {
  const { actorSeat, currentNightResults } = context;
  const target = input.target;

  // Schema allows skip (canSkip: true)
  if (target === undefined || target === null) {
    return { valid: true, result: {} };
  }

  // Check blocked by nightmare - non-skip actions are REJECTED
  if (currentNightResults.blockedSeat === actorSeat) {
    return { valid: false, rejectReason: BLOCKED_UI_DEFAULTS.message };
  }

  // Validate constraints from schema
  const schema = SCHEMAS.dreamcatcherDream;
  const constraintResult = validateConstraints(schema.constraints, { actorSeat, target });
  if (!constraintResult.valid) {
    return { valid: false, rejectReason: constraintResult.rejectReason };
  }

  // Night-1-only scope: no cross-night restriction.

  return {
    valid: true,
    updates: { dreamingSeat: target },
    result: { dreamTarget: target },
  };
};
