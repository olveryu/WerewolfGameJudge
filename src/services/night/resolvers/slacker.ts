/**
 * Slacker Resolver (HOST-ONLY)
 *
 * Validates slacker choose idol action and computes result.
 *
 * RULE:
 * - Slacker's schema has canSkip=false, so normally slacker must choose a target.
 * - If blocked by nightmare, skip is allowed (handler layer permits target=null when blocked).
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 */

import { SCHEMAS } from '../../../models/roles/spec/schemas';
import { validateConstraints } from './constraintValidator';
import type { ResolverFn } from './types';

export const slackerChooseIdolResolver: ResolverFn = (context, input) => {
  const { actorSeat, players, currentNightResults } = context;
  const target = input.target;

  // Slacker normally must choose someone (canSkip=false)
  // But if blocked, skip is allowed (handler layer allows target=null when blocked)
  if (target === undefined || target === null) {
    // If blocked, skip is allowed (forced by nightmare block)
    if (currentNightResults.blockedSeat === actorSeat) {
      return { valid: true, result: {} };
    }
    return { valid: false, rejectReason: '必须选择榜样' };
  }

  // Block guard for non-skip is handled at actionHandler layer

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
