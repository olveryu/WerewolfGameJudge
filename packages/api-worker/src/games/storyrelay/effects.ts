/** Worker-side execution for Story Relay effects: game-completed growth settlement and scheduled deadline settlement. */

import {
  STORY_RELAY_REASONS,
  type StoryRelayEffect,
  type StoryRelayInternalCommand,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';

import { publishGameRewards } from '../../features/account/settleGameRewards';
import { createSettleDueHandler } from '../../platform/gameModules/settleDue';
import type { WorkerEffectContext } from '../../platform/gameModules/workerModule';

type StoryRelaySettleDueEffect = Extract<StoryRelayEffect, { type: 'storyrelay.settle.due' }>;

/**
 * A settle command rejected on the phase or deadline guard means the
 * arming it targeted is already gone (a client timeout or the host
 * settled first, or the phase moved on): the delivery is done, not
 * failed. Actor reasons are deliberately excluded: on the system
 * channel an actor rejection is a bug and must fail fast.
 */
const SUPERSEDED_SETTLE_REASONS: readonly string[] = [
  STORY_RELAY_REASONS.phase,
  STORY_RELAY_REASONS.deadline,
];

/**
 * Scheduled deadline settlement through the shared settle.due
 * handler. The staleness gate compares the payload's pinned arming
 * field by field (round, phase revision, step, deadline): if the
 * room has moved on (already settled, next step, new round), the
 * delivery is a no-op.
 */
const handleStoryRelaySettleDueEffect = createSettleDueHandler<
  StoryRelayState,
  StoryRelaySettleDueEffect['payload'],
  StoryRelayInternalCommand
>({
  namespace: 'storyrelay:settle',
  label: 'Story Relay settle',
  command: { type: 'storyrelay.phase.settleExpired' },
  supersededReasons: SUPERSEDED_SETTLE_REASONS,
  isCurrent: (state, payload) =>
    state.roundId === payload.roundId &&
    state.phaseRevision === payload.phaseRevision &&
    state.stepIndex === payload.stepIndex &&
    state.deadlineAt === payload.deadlineAt,
});

/** Deliver one validated Story Relay effect. */
export async function handleStoryRelayEffect(
  effect: StoryRelayEffect,
  context: WorkerEffectContext<StoryRelayState, StoryRelayInternalCommand>,
): Promise<void> {
  switch (effect.type) {
    case 'storyrelay.game.completed':
      await publishGameRewards(
        { ...effect.payload, kind: 'completion', gameType: 'storyrelay' },
        context,
      );
      return;
    case 'storyrelay.settle.due':
      await handleStoryRelaySettleDueEffect(effect, context);
      return;
  }
}
