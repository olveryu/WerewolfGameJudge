/**
 * Slacker Resolver (HOST-ONLY)
 *
 * Validates slacker choose idol action and computes result.
 *
 * RULE: If blocked by nightmare, non-skip actions are REJECTED (not just no-op).
 * NOTE: Slacker's schema has canSkip=false, so blocked slacker cannot skip either.
 *       But the blocked check is still rejection (consistent with other roles).
 */

import { SCHEMAS, BLOCKED_UI_DEFAULTS } from '../../../models/roles/spec/schemas';
import { validateConstraints } from './constraintValidator';
import type { ResolverFn } from './types';

export const slackerChooseIdolResolver: ResolverFn = (context, input) => {
  const { actorSeat, players, currentNightResults } = context;
  const target = input.target;

  // Slacker must choose someone (canSkip=false)
  // But if blocked, skip is the only valid action
  if (target === undefined || target === null) {
    // If blocked, skip is allowed (forced)
    if (currentNightResults.blockedSeat === actorSeat) {
      return { valid: true, result: {} };
    }
    return { valid: false, rejectReason: '必须选择榜样' };
  }

  // Check blocked by nightmare - non-skip actions are REJECTED
  if (currentNightResults.blockedSeat === actorSeat) {
    return { valid: false, rejectReason: BLOCKED_UI_DEFAULTS.message };
  }

  // Validate constraints from schema
  const schema = SCHEMAS.slackerChooseIdol;
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
    result: { idolTarget: target },
  };
};
