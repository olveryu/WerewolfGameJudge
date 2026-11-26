/** Worker-side execution for Decrypto word selection, reveal timers, and settlement. */

import {
  DECRYPTO_REASONS,
  decryptoCompletionPayloadSchema,
  type DecryptoEffect,
  type DecryptoInternalCommand,
  type DecryptoState,
} from '@game-judge/game-engine/games/decrypto/public';
import { z } from 'zod';

import {
  gameCompletionPayloadSchema,
  publishGameRewards,
} from '../../features/account/settleGameRewards';
import { dispatchEffectCommand } from '../../platform/gameModules/effectDispatch';
import type { WorkerEffectContext } from '../../platform/gameModules/workerModule';
import { decryptoStatsSettlement } from './publicUserStats';
import { getOrCreateDecryptoWordSelection } from './wordSelection';

const gameCompletedEffectSchema = z.strictObject({
  type: z.literal('decrypto.game.completed'),
  payload: z.union([gameCompletionPayloadSchema, decryptoCompletionPayloadSchema]),
});

export const decryptoEffectSchema: z.ZodType<DecryptoEffect> = z.discriminatedUnion('type', [
  gameCompletedEffectSchema,
  z.strictObject({
    type: z.literal('decrypto.words.select'),
    payload: z.strictObject({
      requestId: z.string().min(1),
      gameSequence: z.number().int().nonnegative(),
      participantUserIds: z.array(z.string().min(1)),
    }),
  }),
  z.strictObject({
    type: z.literal('decrypto.reveal.due'),
    payload: z.strictObject({
      gameSequence: z.number().int().nonnegative(),
      round: z.number().int().positive(),
      team: z.enum(['blue', 'purple']),
      revealIndex: z.number().int().nonnegative(),
      revealAt: z.number().int().nonnegative(),
    }),
  }),
]);

/**
 * Deliver one validated Decrypto effect. Exactly-once for the
 * completion effect is enforced in three layers: the engine emits it
 * at most once per game (xpSettled), the effect outbox dedupes on the
 * business key, and settleGameRewards is idempotent on the settlement
 * id.
 */
export async function handleDecryptoEffect(
  effect: DecryptoEffect,
  context: WorkerEffectContext<DecryptoState, DecryptoInternalCommand>,
): Promise<void> {
  switch (effect.type) {
    case 'decrypto.game.completed':
      await publishGameRewards(
        { ...effect.payload, kind: 'completion', gameType: 'decrypto' },
        context,
        'stats' in effect.payload ? decryptoStatsSettlement(effect.payload.stats) : undefined,
      );
      return;
    case 'decrypto.words.select': {
      if (
        context.state.phase.kind !== 'preparing' ||
        context.state.phase.requestId !== effect.payload.requestId ||
        context.state.gameSequence !== effect.payload.gameSequence
      )
        return;
      const keywords = await getOrCreateDecryptoWordSelection({
        db: context.bindings.DB,
        roomIdentity: context.roomIdentity,
        effect,
      });
      await dispatchEffectCommand(
        context,
        {
          type: 'decrypto.words.selected',
          requestId: effect.payload.requestId,
          keywords,
        },
        {
          namespace: 'decrypto:words-selected',
          supersededReasons: [DECRYPTO_REASONS.stale, DECRYPTO_REASONS.phase],
          label: 'Decrypto keyword selection',
        },
      );
      return;
    }
    case 'decrypto.reveal.due':
      await dispatchEffectCommand(
        context,
        { type: 'decrypto.reveal.advance', ...effect.payload },
        {
          namespace: 'decrypto:reveal',
          supersededReasons: [DECRYPTO_REASONS.phase, DECRYPTO_REASONS.revealEarly],
          label: 'Decrypto staged reveal',
        },
      );
      return;
  }
}
