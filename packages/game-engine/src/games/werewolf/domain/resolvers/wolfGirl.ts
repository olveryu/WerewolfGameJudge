/**
 * Wolf Girl Resolvers (SERVER-ONLY, pure functions)
 *
 * Responsibilities:
 * - wolfGirlConfessRevealResolver: no-op resolver for the groupConfirm step (ack handled at the handler layer).
 * No IO (network / audio / Alert).
 *
 * NOTE: wolfGirlConfess (writeSlot) uses the generic resolver; only the
 * groupConfirm reveal step needs a resolver entry here, mirroring the
 * awakenedGargoyle / seedWolf / piper reveal resolvers.
 * Nightmare block guard is handled at actionHandler layer (single-point guard).
 */

import type { ResolverFn } from './types';

/**
 * wolfGirlConfessReveal — no-op resolver for the groupConfirm step.
 *
 * This step is acknowledged by all players; the actual ack logic lives at the handler layer.
 * The resolver performs only minimal validation to keep contract test coverage complete.
 */
export const wolfGirlConfessRevealResolver: ResolverFn = (_context, input) => {
  // groupConfirm step: player confirms they've seen confession status
  if (input.confirmed) {
    return { valid: true };
  }
  // No confirmation = valid no-op (step is managed by handler)
  return { valid: true };
};
