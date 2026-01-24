/**
 * Psychic Resolver (HOST-ONLY)
 *
 * Validates psychic check action and computes result.
 * Returns exact role identity (not just faction).
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 */

import { SCHEMAS } from '../../../models/roles/spec/schemas';
import { validateConstraints } from './constraintValidator';
import type { ResolverFn } from './types';
import { getRoleAfterSwap } from './types';

export const psychicCheckResolver: ResolverFn = (context, input) => {
  const { actorSeat, players, currentNightResults } = context;
  const target = input.target;

  // Allow skip (schema.canSkip: true)
  if (target === undefined || target === null) {
    return { valid: true, result: {} };
  }

  // Block guard is handled at actionHandler layer (single-point guard)

  // Validate constraints from schema
  const schema = SCHEMAS.psychicCheck;
  const constraintResult = validateConstraints(schema.constraints, { actorSeat, target });
  if (!constraintResult.valid) {
    return { valid: false, rejectReason: constraintResult.rejectReason };
  }

  // Target must exist (check original role)
  const originalRoleId = players.get(target);
  if (!originalRoleId) {
    return { valid: false, rejectReason: '目标玩家不存在' };
  }

  // Get effective role after magician swap (if any)
  const effectiveRoleId = getRoleAfterSwap(target, players, currentNightResults.swappedSeats);
  if (!effectiveRoleId) {
    return { valid: false, rejectReason: '目标玩家不存在' };
  }

  // Return exact role identity (after swap)
  return {
    valid: true,
    result: { identityResult: effectiveRoleId },
  };
};
