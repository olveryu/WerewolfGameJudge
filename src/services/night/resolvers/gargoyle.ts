/**
 * Gargoyle Resolver (HOST-ONLY)
 *
 * Validates gargoyle check action and computes result.
 * Returns exact role identity (like psychic).
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 * NOTE: Uses resolveRoleForChecks for unified role resolution (magician swap + wolfRobot disguise).
 */

import { SCHEMAS } from '../../../models/roles/spec/schemas';
import { validateConstraints } from './constraintValidator';
import type { ResolverFn } from './types';
import { resolveRoleForChecks } from './types';

export const gargoyleCheckResolver: ResolverFn = (context, input) => {
  const { actorSeat, players } = context;
  const target = input.target;

  // Schema allows skip (canSkip: true)
  if (target === undefined || target === null) {
    return { valid: true, result: {} };
  }

  // Block guard is handled at actionHandler layer (single-point guard)

  // Validate constraints from schema
  const schema = SCHEMAS.gargoyleCheck;
  const constraintResult = validateConstraints(schema.constraints, { actorSeat, target });
  if (!constraintResult.valid) {
    return { valid: false, rejectReason: constraintResult.rejectReason };
  }

  // Target must exist (check original role)
  const originalRoleId = players.get(target);
  if (!originalRoleId) {
    return { valid: false, rejectReason: '目标玩家不存在' };
  }

  // Get effective role using unified resolution (magician swap + wolfRobot disguise)
  const effectiveRoleId = resolveRoleForChecks(context, target);
  if (!effectiveRoleId) {
    return { valid: false, rejectReason: '目标玩家不存在' };
  }

  // Return exact role identity (after swap and disguise)
  return {
    valid: true,
    result: { identityResult: effectiveRoleId },
  };
};
