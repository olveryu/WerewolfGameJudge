/**
 * Piper Resolvers (SERVER-ONLY, pure functions)
 *
 * Responsibilities:
 * - piperHypnotizeResolver: validate Piper hypnotize action (1-2 targets) + write hypnotizedSeats.
 * - piperHypnotizedRevealResolver: no-op resolver for the groupConfirm step (ack handled at handler layer).
 * Provides multi-target validation.
 * No IO (no network / audio / Alert).
 *
 * NOTE: Nightmare block guard is handled at actionHandler layer (single-point guard).
 */

import { SCHEMAS } from '../models';
import type { MultiChooseSeatSchema } from '../models/roles/spec/schema.types';
import { formatSeat } from '../utils/formatSeat';
import { validateConstraints } from './constraintValidator';
import type { ResolverContext, ResolverFn } from './types';

export const piperHypnotizeResolver: ResolverFn = (context: ResolverContext, input) => {
  const { actorSeat, players } = context;
  const targets = input.targets;
  const schema: MultiChooseSeatSchema = SCHEMAS.piperHypnotize as MultiChooseSeatSchema;

  // Piper can skip (canSkip: true)
  if (!targets || targets.length === 0) {
    return { valid: true, result: {} };
  }

  // Validate target count
  if (targets.length < schema.minTargets || targets.length > schema.maxTargets) {
    return {
      valid: false,
      rejectReason: `必须选择${schema.minTargets}-${schema.maxTargets}名玩家`,
    };
  }

  // Check for duplicate targets
  if (new Set(targets).size !== targets.length) {
    return { valid: false, rejectReason: '不能选择重复的玩家' };
  }

  // Validate each target against constraints
  for (const target of targets) {
    const constraintResult = validateConstraints(schema.constraints, { actorSeat, target });
    if (!constraintResult.valid) {
      return { valid: false, rejectReason: constraintResult.rejectReason };
    }

    // Target must exist
    if (!players.has(target)) {
      return { valid: false, rejectReason: `${formatSeat(target)}玩家不存在` };
    }
  }

  return {
    valid: true,
    updates: { hypnotizedSeats: [...targets].sort((a, b) => a - b) },
    result: { hypnotizedTargets: targets },
  };
};

/**
 * piperHypnotizedReveal — no-op resolver for the groupConfirm step.
 *
 * This step is confirmed (ack) by all players; the actual confirmation logic lives in the handler layer.
 * The resolver does minimal validation to keep contract test coverage complete.
 */
export const piperHypnotizedRevealResolver: ResolverFn = (_context, input) => {
  // groupConfirm step: player confirms they've seen hypnotized status
  if (input.confirmed) {
    return { valid: true };
  }
  // No confirmation = valid no-op (step is managed by handler)
  return { valid: true };
};
