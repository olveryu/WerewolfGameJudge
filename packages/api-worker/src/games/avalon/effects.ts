/** Worker-side execution for Avalon effects: game-completed growth settlement and scheduled countdown settlement. */

import {
  AVALON_REASONS,
  type AvalonEffect,
  type AvalonInternalCommand,
  type AvalonState,
} from '@game-judge/game-engine/games/avalon/public';
import { z } from 'zod';

import {
  gameCompletionPayloadSchema,
  publishGameRewards,
} from '../../features/account/settleGameRewards';
import { createEffectCommandId } from '../../platform/gameModules/effectCommandId';
import type { WorkerEffectContext } from '../../platform/gameModules/workerModule';

const gameCompletedEffectSchema = z.strictObject({
  type: z.literal('avalon.game.completed'),
  payload: gameCompletionPayloadSchema,
});

const settleDueEffectSchema = z.strictObject({
  type: z.literal('avalon.settle.due'),
  payload: z.strictObject({
    gameSequence: z.int().nonnegative(),
    phase: z.enum(['vote', 'quest']),
    round: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    deadlineAt: z.int().nonnegative(),
  }),
});

export const avalonEffectSchema: z.ZodType<AvalonEffect> = z.union([
  gameCompletedEffectSchema,
  settleDueEffectSchema,
]);

type AvalonSettleDueEffect = Extract<AvalonEffect, { type: 'avalon.settle.due' }>;

/**
 * A settle command rejected on the phase or deadline guard means the
 * arming it targeted is already gone (a client timeout or the host
 * settled first, or the phase moved on): the delivery is done, not
 * failed.
 */
function isSupersededSettleRejection(reason: string): boolean {
  return reason === AVALON_REASONS.phase || reason === AVALON_REASONS.deadline;
}

async function handleAvalonSettleDueEffect(
  effect: AvalonSettleDueEffect,
  context: WorkerEffectContext<AvalonState, AvalonInternalCommand>,
): Promise<void> {
  const state = context.state;
  const phase = state.phase;
  // Staleness gate: the payload pins one exact arming. If the room has
  // moved on (already settled, new proposal, new game), this delivery
  // is a no-op — never settle whatever phase happens to be current.
  if (
    state.gameSequence !== effect.payload.gameSequence ||
    (phase.kind !== 'vote' && phase.kind !== 'quest') ||
    phase.kind !== effect.payload.phase ||
    phase.round !== effect.payload.round ||
    phase.deadlineAt !== effect.payload.deadlineAt
  ) {
    return;
  }
  const commandId = await createEffectCommandId('avalon:settle', context.effectId);
  const result = await context.dispatchInternal(commandId, {
    type:
      effect.payload.phase === 'vote' ? 'avalon.vote.settleExpired' : 'avalon.quest.settleExpired',
  });
  if (result.commandId !== commandId) {
    throw new Error(
      `[FAIL-FAST] Avalon settle receipt ${result.commandId} does not match ${commandId}`,
    );
  }
  if (result.kind === 'rejected') {
    if (isSupersededSettleRejection(result.reason)) return;
    throw new Error(`Avalon settle command ${commandId} was rejected: ${result.reason}`);
  }
  if (result.outcome.kind !== 'success') {
    throw new Error(`Avalon settle command ${commandId} failed: ${result.outcome.reason}`);
  }
}

/**
 * Deliver one validated Avalon effect. Exactly-once for the completion
 * effect is enforced in three layers: the engine emits it at most once
 * per game (xpSettled), the effect outbox dedupes on the business key,
 * and settleGameRewards is idempotent on the settlement id. The settle
 * effect is exactly-once by construction: the engine arms it once per
 * countdown, the outbox dedupes on the arming identity, and delivery
 * no-ops unless the pinned arming is still current.
 */
export async function handleAvalonEffect(
  effect: AvalonEffect,
  context: WorkerEffectContext<AvalonState, AvalonInternalCommand>,
): Promise<void> {
  switch (effect.type) {
    case 'avalon.game.completed':
      await publishGameRewards(
        { ...effect.payload, kind: 'completion', gameType: 'avalon' },
        context,
      );
      return;
    case 'avalon.settle.due':
      await handleAvalonSettleDueEffect(effect, context);
      return;
  }
}
