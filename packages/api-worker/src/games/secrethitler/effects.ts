/** Worker-side execution for Secrethitler effects: game-completed growth settlement. */

import {
  secrethitlerCompletionPayloadSchema,
  type SecrethitlerEffect,
  type SecrethitlerInternalCommand,
  type SecrethitlerState,
} from '@game-judge/game-engine/games/secrethitler/public';
import { z } from 'zod';

import {
  gameCompletionPayloadSchema,
  publishGameRewards,
} from '../../features/account/settleGameRewards';
import type { WorkerEffectContext } from '../../platform/gameModules/workerModule';
import { secrethitlerStatsSettlement } from './publicUserStats';

const gameCompletedEffectSchema = z.strictObject({
  type: z.literal('secrethitler.game.completed'),
  payload: z.union([gameCompletionPayloadSchema, secrethitlerCompletionPayloadSchema]),
});

export const secrethitlerEffectSchema: z.ZodType<SecrethitlerEffect> = z.union([
  gameCompletedEffectSchema,
]);

/**
 * Deliver one validated Secrethitler effect. Exactly-once for the
 * completion effect is enforced in three layers: the engine emits it
 * at most once per game (xpSettled), the effect outbox dedupes on the
 * business key, and settleGameRewards is idempotent on the settlement
 * id.
 */
export async function handleSecrethitlerEffect(
  effect: SecrethitlerEffect,
  context: WorkerEffectContext<SecrethitlerState, SecrethitlerInternalCommand>,
): Promise<void> {
  switch (effect.type) {
    case 'secrethitler.game.completed':
      await publishGameRewards(
        { ...effect.payload, kind: 'completion', gameType: 'secrethitler' },
        context,
        'stats' in effect.payload ? secrethitlerStatsSettlement(effect.payload.stats) : undefined,
      );
      return;
  }
}
