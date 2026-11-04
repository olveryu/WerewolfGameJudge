/**
 * Worker-side execution for Pictionary effects: the game-completed
 * growth settlement effect and the scheduled stage-deadline
 * settlement effect.
 */

import {
  type PictionaryEffect,
  type PictionaryInternalCommand,
  type PictionaryState,
  REASON_PICTIONARY_PHASE_INVALID,
  REASON_PICTIONARY_PHASE_NOT_EXPIRED,
} from '@game-judge/game-engine/games/pictionary/public';

import { publishGameRewards } from '../../features/account/settleGameRewards';
import { createSettleDueHandler } from '../../platform/gameModules/settleDue';
import type { WorkerEffectContext } from '../../platform/gameModules/workerModule';

type PictionarySettleDueEffect = Extract<PictionaryEffect, { type: 'pictionary.settle.due' }>;

/**
 * A settle command rejected on the phase or deadline guard means the
 * arming it targeted is already gone (a client timeout or the host
 * settled first, or the phase moved on): the delivery is done, not
 * failed. Actor reasons are deliberately excluded: on the system
 * channel an actor rejection is a bug and must fail fast.
 */
const SUPERSEDED_SETTLE_REASONS: readonly string[] = [
  REASON_PICTIONARY_PHASE_INVALID,
  REASON_PICTIONARY_PHASE_NOT_EXPIRED,
];

/**
 * Scheduled stage-deadline settlement through the shared settle.due
 * handler. The staleness gate compares the payload's pinned arming
 * field by field (round, phase revision, step, deadline): if the
 * room has moved on, the delivery is a no-op.
 */
const handlePictionarySettleDueEffect = createSettleDueHandler<
  PictionaryState,
  PictionarySettleDueEffect['payload'],
  PictionaryInternalCommand
>({
  namespace: 'pictionary:settle',
  label: 'Pictionary settle',
  command: { type: 'pictionary.phase.settleExpired' },
  supersededReasons: SUPERSEDED_SETTLE_REASONS,
  isCurrent: (state, payload) =>
    state.roundId === payload.roundId &&
    state.phaseRevision === payload.phaseRevision &&
    state.stepIndex === payload.stepIndex &&
    state.deadlineAt === payload.deadlineAt,
});

/** Deliver one validated Pictionary effect. */
export async function handlePictionaryEffect(
  effect: PictionaryEffect,
  context: WorkerEffectContext<PictionaryState, PictionaryInternalCommand>,
): Promise<void> {
  switch (effect.type) {
    case 'pictionary.game.completed':
      await publishGameRewards(
        { ...effect.payload, kind: 'completion', gameType: 'pictionary' },
        context,
      );
      return;
    case 'pictionary.settle.due':
      await handlePictionarySettleDueEffect(effect, context);
      return;
  }
}
