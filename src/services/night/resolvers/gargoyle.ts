/**
 * Gargoyle Resolver (HOST-ONLY)
 *
 * Validates gargoyle check action and computes result.
 * Returns exact role identity (like psychic).
 */

import { SCHEMAS } from '../../../models/roles/spec/schemas';
import { validateConstraints } from './constraintValidator';
import type { ResolverFn } from './types';

export const gargoyleCheckResolver: ResolverFn = (context, input) => {
  const { actorSeat, players, currentNightResults } = context;
  const target = input.target;

  // Validate target exists
  if (target === undefined || target === null) {
    return { valid: false, rejectReason: '必须选择查验对象' };
  }

  // Validate constraints from schema
  const schema = SCHEMAS.gargoyleCheck;
  const constraintResult = validateConstraints(schema.constraints, { actorSeat, target });
  if (!constraintResult.valid) {
    return { valid: false, rejectReason: constraintResult.rejectReason };
  }

  // Target must exist
  const targetRoleId = players.get(target);
  if (!targetRoleId) {
    return { valid: false, rejectReason: '目标玩家不存在' };
  }

  // Check blocked by nightmare
  if (currentNightResults.blockedSeat === actorSeat) {
    return { valid: true, result: {} };
  }

  // Return exact role identity
  return {
    valid: true,
    result: { identityResult: targetRoleId },
  };
};
