/**
 * Dreamcatcher Resolver (HOST-ONLY)
 *
 * Validates dreamcatcher action and computes result.
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 */

import { SCHEMAS } from '../../../models/roles/spec/schemas';
import { validateConstraints } from './constraintValidator';
import type { ResolverFn } from './types';

export const dreamcatcherDreamResolver: ResolverFn = (context, input) => {
  const { actorSeat } = context;
  const target = input.target;

  // Schema allows skip (canSkip: true)
  if (target === undefined || target === null) {
    return { valid: true, result: {} };
  }

  // Block guard is handled at actionHandler layer (single-point guard)

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
