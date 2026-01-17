/**
 * Slacker Resolver (HOST-ONLY)
 *
 * Validates slacker choose idol action and computes result.
 */

import { SCHEMAS } from '../../../models/roles/spec/schemas';
import { validateConstraints } from './constraintValidator';
import type { ResolverFn } from './types';

export const slackerChooseIdolResolver: ResolverFn = (context, input) => {
  const { actorSeat, players, currentNightResults } = context;
  const target = input.target;

  // Validate target exists (slacker must choose someone)
  if (target === undefined || target === null) {
    return { valid: false, rejectReason: '必须选择榜样' };
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

  // Check blocked by nightmare
  if (currentNightResults.blockedSeat === actorSeat) {
    return { valid: true, result: {} };
  }

  return {
    valid: true,
    result: { idolTarget: target },
  };
};
