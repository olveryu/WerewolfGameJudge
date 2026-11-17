/** Worker-side execution for Spotmatch effects: game-completed growth settlement. */

import {
  spotmatchCompletionPayloadSchema,
  type SpotmatchEffect,
  type SpotmatchInternalCommand,
  type SpotmatchState,
} from '@game-judge/game-engine/games/spotmatch/public';
import { z } from 'zod';

import {
  gameCompletionPayloadSchema,
  publishGameRewards,
} from '../../features/account/settleGameRewards';
import type { WorkerEffectContext } from '../../platform/gameModules/workerModule';
import { spotmatchStatsSettlement } from './publicUserStats';

const gameCompletedEffectSchema = z.strictObject({
  type: z.literal('spotmatch.game.completed'),
  payload: z.union([gameCompletionPayloadSchema, spotmatchCompletionPayloadSchema]),
});

export const spotmatchEffectSchema: z.ZodType<SpotmatchEffect> = z.union([
  gameCompletedEffectSchema,
]);

/**
 * Deliver one validated Spotmatch effect. Exactly-once for the
 * completion effect is enforced in three layers: the engine emits it
 * at most once per game (xpSettled), the effect outbox dedupes on the
 * business key, and settleGameRewards is idempotent on the settlement
 * id.
 */
export async function handleSpotmatchEffect(
  effect: SpotmatchEffect,
  context: WorkerEffectContext<SpotmatchState, SpotmatchInternalCommand>,
): Promise<void> {
  switch (effect.type) {
    case 'spotmatch.game.completed':
      await publishGameRewards(
        { ...effect.payload, kind: 'completion', gameType: 'spotmatch' },
        context,
        'stats' in effect.payload ? spotmatchStatsSettlement(effect.payload.stats) : undefined,
      );
      return;
  }
}
