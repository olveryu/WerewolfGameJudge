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
import { createSettleDueHandler } from '../../platform/gameModules/settleDue';
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
const SUPERSEDED_SETTLE_REASONS: readonly string[] = [
  AVALON_REASONS.phase,
  AVALON_REASONS.deadline,
];

/**
 * Scheduled countdown settlement through the shared settle.due
 * handler. The staleness gate compares the payload's pinned arming
 * field by field (game sequence, phase, round, deadline): if the
 * room has moved on (already settled, new proposal, new game), the
 * delivery is a no-op.
 */
const handleAvalonSettleDueEffect = createSettleDueHandler<
  AvalonState,
  AvalonSettleDueEffect['payload'],
  AvalonInternalCommand
>({
  namespace: 'avalon:settle',
  label: 'Avalon settle',
  command: { type: 'avalon.phase.settleExpired' },
  supersededReasons: SUPERSEDED_SETTLE_REASONS,
  isCurrent: (state, payload) => {
    const phase = state.phase;
    return (
      state.gameSequence === payload.gameSequence &&
      (phase.kind === 'vote' || phase.kind === 'quest') &&
      phase.kind === payload.phase &&
      phase.round === payload.round &&
      phase.deadlineAt === payload.deadlineAt
    );
  },
});

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
