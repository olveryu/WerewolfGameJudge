/**
 * Awakened Gargoyle Resolvers (SERVER-ONLY, pure functions)
 *
 * Responsibilities:
 * - awakenedGargoyleConvertResolver: validates Awakened Gargoyle conversion action (picks a non-wolf, non-self player adjacent to the wolf faction).
 * - awakenedGargoyleConvertRevealResolver: no-op resolver for the groupConfirm step (ack handled at the handler layer).
 * No IO (network / audio / Alert).
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 */

import { SCHEMAS } from '../models';
import type { ChooseSeatSchema } from '../models/roles/spec/schema.types';
import { validateConstraints } from './constraintValidator';
import type { ResolverContext, ResolverFn } from './types';

export const awakenedGargoyleConvertResolver: ResolverFn = (context: ResolverContext, input) => {
  const { actorSeat, players, currentNightResults } = context;
  const target = input.target;
  const schema: ChooseSeatSchema = SCHEMAS.awakenedGargoyleConvert as ChooseSeatSchema;

  // canSkip: false — mandatory action, no skip allowed
  if (target === undefined || target === null) {
    return { valid: false, rejectReason: '觉醒石像鬼必须选择转化目标' };
  }

  // Validate constraints: NotSelf + AdjacentToWolfFaction
  const totalSeats = players.size;
  const constraintResult = validateConstraints(schema.constraints, {
    actorSeat,
    target,
    players,
    swappedSeats: currentNightResults.swappedSeats,
    totalSeats,
  });
  if (!constraintResult.valid) {
    return { valid: false, rejectReason: constraintResult.rejectReason };
  }

  // Target must exist
  if (!players.has(target)) {
    return { valid: false, rejectReason: '目标玩家不存在' };
  }

  return {
    valid: true,
    updates: { convertedSeat: target },
    result: { convertTarget: target },
  };
};

/**
 * awakenedGargoyleConvertReveal — no-op resolver for the groupConfirm step.
 *
 * This step is acknowledged by all players; the actual ack logic lives at the handler layer.
 * The resolver performs only minimal validation to keep contract test coverage complete.
 */
export const awakenedGargoyleConvertRevealResolver: ResolverFn = (_context, input) => {
  // groupConfirm step: player confirms they've seen conversion status
  if (input.confirmed) {
    return { valid: true };
  }
  // No confirmation = valid no-op (step is managed by handler)
  return { valid: true };
};
