/** Worker-side execution for Secrethitler effects: game-completed growth settlement. */

import {
  SECRETHITLER_REASONS,
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
import { createSettleDueHandler } from '../../platform/gameModules/settleDue';
import type { WorkerEffectContext } from '../../platform/gameModules/workerModule';
import { secrethitlerStatsSettlement } from './publicUserStats';

const gameCompletedEffectSchema = z.strictObject({
  type: z.literal('secrethitler.game.completed'),
  payload: z.union([gameCompletionPayloadSchema, secrethitlerCompletionPayloadSchema]),
});

export const secrethitlerEffectSchema: z.ZodType<SecrethitlerEffect> = z.union([
  gameCompletedEffectSchema,
  z.strictObject({
    type: z.literal('secrethitler.settle.due'),
    payload: z.strictObject({
      gameSequence: z.int().nonnegative(),
      phase: z.enum(['voting', 'resultVoting', 'resultPolicy', 'resultVeto']),
      round: z.int().positive(),
      deadlineAt: z.int().nonnegative(),
    }),
  }),
]);

const handleSettleDue = createSettleDueHandler<
  SecrethitlerState,
  Extract<SecrethitlerEffect, { type: 'secrethitler.settle.due' }>['payload'],
  SecrethitlerInternalCommand
>({
  namespace: 'secrethitler:settle',
  label: 'Secret Hitler vote settlement',
  command: { type: 'secrethitler.phase.settleExpired' },
  supersededReasons: [SECRETHITLER_REASONS.phase, SECRETHITLER_REASONS.deadline],
  isCurrent: (state, payload) =>
    state.gameSequence === payload.gameSequence &&
    (state.phase.kind === 'voting' || state.phase.kind === 'publicResult') &&
    (state.phase.kind === 'voting'
      ? payload.phase === 'voting'
      : payload.phase ===
        (state.phase.previous.kind === 'voting'
          ? 'resultVoting'
          : state.phase.previous.kind === 'vetoResponse'
            ? 'resultVeto'
            : 'resultPolicy')) &&
    state.history.governments.length === payload.round &&
    state.phase.deadlineAt === payload.deadlineAt,
});

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
    case 'secrethitler.settle.due':
      await handleSettleDue(effect, context);
      return;
  }
}
