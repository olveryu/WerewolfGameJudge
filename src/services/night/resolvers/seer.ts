/**
 * Seer Resolver (HOST-ONLY)
 *
 * Validates seer check action and computes result.
 *
 * RULE: If blocked by nightmare, non-skip actions are REJECTED (not just no-op).
 */

import { ROLE_SPECS } from '../../../models/roles/spec/specs';
import { getSeerCheckResultForTeam } from '../../../models/roles/spec/types';
import { SCHEMAS, BLOCKED_UI_DEFAULTS } from '../../../models/roles/spec/schemas';
import { validateConstraints } from './constraintValidator';
import type { ResolverFn } from './types';
import { getRoleAfterSwap } from './types';

export const seerCheckResolver: ResolverFn = (context, input) => {
  const { actorSeat, players, currentNightResults } = context;
  const target = input.target;

  // Schema allows skip (canSkip: true)
  // If target is null/undefined, treat as skip
  if (target === undefined || target === null) {
    return {
      valid: true,
      result: {}, // No check result (skipped)
    };
  }

  // Check blocked by nightmare - non-skip actions are REJECTED
  if (currentNightResults.blockedSeat === actorSeat) {
    return { valid: false, rejectReason: BLOCKED_UI_DEFAULTS.message };
  }

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

  // Get effective role after magician swap (if any)
  const effectiveRoleId = getRoleAfterSwap(target, players, currentNightResults.swappedSeats);
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
