/**
 * Dreamcatcher Resolver (HOST-ONLY)
 *
 * Validates dreamcatcher action and computes result.
 */

import { SCHEMAS } from '../../../models/roles/spec/schemas';
import { validateConstraints } from './constraintValidator';
import type { ResolverFn } from './types';

export const dreamcatcherDreamResolver: ResolverFn = (context, input) => {
  const { actorSeat, currentNightResults } = context;
  const target = input.target;

  // Validate target exists (dreamcatcher must choose someone)
  if (target === undefined || target === null) {
    return { valid: false, rejectReason: '必须选择摄梦对象' };
  }

  // Validate constraints from schema
  const schema = SCHEMAS.dreamcatcherDream;
  const constraintResult = validateConstraints(schema.constraints, { actorSeat, target });
  if (!constraintResult.valid) {
    return { valid: false, rejectReason: constraintResult.rejectReason };
  }

  // Check blocked by nightmare
  if (currentNightResults.blockedSeat === actorSeat) {
    return { valid: true, result: {} };
  }

  // Night-1-only scope: no cross-night restriction.

  return {
    valid: true,
    updates: { dreamingSeat: target },
    result: { dreamTarget: target },
  };
};
