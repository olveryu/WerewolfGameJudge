/**
 * Wolf Queen Resolver (HOST-ONLY)
 *
 * Validates wolf queen charm action and computes result.
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 */

import { SCHEMAS } from '../../../models/roles/spec/schemas';
import { validateConstraints } from './constraintValidator';
import type { ResolverFn } from './types';

export const wolfQueenCharmResolver: ResolverFn = (context, input) => {
  const { actorSeat, players } = context;
  const target = input.target;

  // Wolf queen can skip (choose not to charm anyone)
  if (target === undefined || target === null) {
    return { valid: true, result: {} };
  }

  // Block guard is handled at actionHandler layer (single-point guard)

  // Validate constraints from schema
  const schema = SCHEMAS.wolfQueenCharm;
  const constraintResult = validateConstraints(schema.constraints, { actorSeat, target });
  if (!constraintResult.valid) {
    return { valid: false, rejectReason: constraintResult.rejectReason };
  }

  // Target must exist
  if (!players.has(target)) {
    return { valid: false, rejectReason: '目标玩家不存在' };
  }

  return {
    valid: true,
    result: { charmTarget: target },
  };
};
