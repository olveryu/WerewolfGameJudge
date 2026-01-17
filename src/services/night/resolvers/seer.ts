/**
 * Seer Resolver (HOST-ONLY)
 *
 * Validates seer check action and computes result.
 */

import { ROLE_SPECS } from '../../../models/roles/spec/specs';
import { getSeerCheckResultForTeam } from '../../../models/roles/spec/types';
import { SCHEMAS } from '../../../models/roles/spec/schemas';
import { validateConstraints } from './constraintValidator';
import type { ResolverFn } from './types';

export const seerCheckResolver: ResolverFn = (context, input) => {
  const { actorSeat, players, currentNightResults } = context;
  const target = input.target;

  // Validate target exists
  if (target === undefined || target === null) {
    return { valid: false, rejectReason: '必须选择查验对象' };
  }

  // Validate constraints from schema
  const schema = SCHEMAS.seerCheck;
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
    return {
      valid: true,
      result: {}, // No result due to block
    };
  }

  // Compute result: wolf team = '狼人', others = '好人'
  const targetSpec = ROLE_SPECS[targetRoleId];
  const checkResult = getSeerCheckResultForTeam(targetSpec.team);

  return {
    valid: true,
    result: { checkResult },
  };
};
