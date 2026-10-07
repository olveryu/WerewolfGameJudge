/** Worker-side execution for the Avalon game-completed growth settlement effect. */

import type { AvalonEffect, AvalonState } from '@game-judge/game-engine/games/avalon/public';
import { z } from 'zod';

import {
  gameCompletionPayloadSchema,
  publishGameRewards,
} from '../../features/account/settleGameRewards';
import type { WorkerEffectContext } from '../../platform/gameModules/workerModule';

export const avalonEffectSchema: z.ZodType<AvalonEffect> = z.strictObject({
  type: z.literal('avalon.game.completed'),
  payload: gameCompletionPayloadSchema,
});

/**
 * Deliver the terminal Avalon settlement effect. Exactly-once is enforced in
 * three layers: the engine emits the effect at most once per game (xpSettled),
 * the effect outbox dedupes on the business key, and settleGameRewards is
 * idempotent on the settlement id.
 */
export async function handleAvalonEffect(
  effect: AvalonEffect,
  context: WorkerEffectContext<AvalonState, never>,
): Promise<void> {
  await publishGameRewards({ ...effect.payload, kind: 'completion', gameType: 'avalon' }, context);
}
