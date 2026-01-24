/**
 * Seer Resolver (HOST-ONLY)
 *
 * Validates seer check action and computes result.
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 * NOTE: Uses resolveRoleForChecks for unified role resolution (magician swap + wolfRobot disguise).
 */

import { ROLE_SPECS } from '../../../models/roles/spec/specs';
import { getSeerCheckResultForTeam } from '../../../models/roles/spec/types';
import { SCHEMAS } from '../../../models/roles/spec/schemas';
import { validateConstraints } from './constraintValidator';
import type { ResolverFn } from './types';
import { resolveRoleForChecks } from './types';

export const seerCheckResolver: ResolverFn = (context, input) => {
  const { actorSeat, players } = context;
  const target = input.target;

  // Schema allows skip (canSkip: true)
  // If target is null/undefined, treat as skip
  if (target === undefined || target === null) {
    return {
      valid: true,
      result: {}, // No check result (skipped)
    };
  }

  // Block guard is handled at actionHandler layer (single-point guard)

  // Validate constraints from schema
  const schema = SCHEMAS.seerCheck;
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

  // Compute result: wolf team = '狼人', others = '好人'
  const targetSpec = ROLE_SPECS[effectiveRoleId];
  const checkResult = getSeerCheckResultForTeam(targetSpec.team);

  return {
    valid: true,
    result: { checkResult },
  };
};
