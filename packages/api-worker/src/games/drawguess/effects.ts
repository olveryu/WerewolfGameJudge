/** Worker-side execution for DrawGuess word-dealing, seen-word and scheduled settlement effects. */

import {
  DRAWGUESS_REASONS,
  type DrawGuessEffect,
  type DrawGuessInternalCommand,
  type DrawGuessState,
  expiringPhaseDeadlineAt,
  getDrawGuessParticipantUserIds,
} from '@game-judge/game-engine/games/drawguess/public';
import { z } from 'zod';

import {
  gameCompletionPayloadSchema,
  publishGameRewards,
} from '../../features/account/settleGameRewards';
import { dispatchEffectCommand } from '../../platform/gameModules/effectDispatch';
import { createSettleDueHandler } from '../../platform/gameModules/settleDue';
import type { WorkerEffectContext } from '../../platform/gameModules/workerModule';
import { dealDrawGuessWords, recordDrawGuessWordSeen } from './wordDeal';

const dealWordsEffectSchema = z.strictObject({
  type: z.literal('drawguess.words.deal'),
  payload: z.strictObject({
    turnIndex: z.int().nonnegative(),
  }),
});

const recordSeenWordEffectSchema = z.strictObject({
  type: z.literal('drawguess.word.recordSeen'),
  payload: z.strictObject({
    gameSequence: z.int().nonnegative(),
    turnIndex: z.int().nonnegative(),
    word: z.string().min(1),
    participantUserIds: z.array(z.string().min(1)).readonly(),
  }),
});

const gameCompletedEffectSchema = z.strictObject({
  type: z.literal('drawguess.game.completed'),
  payload: gameCompletionPayloadSchema,
});

const settleDueEffectSchema = z.strictObject({
  type: z.literal('drawguess.settle.due'),
  payload: z.strictObject({
    gameSequence: z.int().nonnegative(),
    phaseRevision: z.int().nonnegative(),
    turnIndex: z.int().nonnegative(),
    deadlineAt: z.int().nonnegative(),
  }),
});

export const drawGuessEffectSchema: z.ZodType<DrawGuessEffect> = z.union([
  dealWordsEffectSchema,
  recordSeenWordEffectSchema,
  gameCompletedEffectSchema,
  settleDueEffectSchema,
]);

type DrawGuessSettleDueEffect = Extract<DrawGuessEffect, { type: 'drawguess.settle.due' }>;

/**
 * A settle command rejected on the phase, stale-revision, or deadline
 * guard means the arming it targeted is already gone (a client
 * timeout or the host settled first, or the phase moved on): the
 * delivery is done, not failed. Actor reasons are never listed —
 * a system-channel actor rejection is a bug that must fail loudly.
 * `emptyChoices` is excluded: on a current delivery it is
 * unreachable (a wordSelect deadline is only written by dealWords,
 * which writes non-empty choices).
 */
const SUPERSEDED_SETTLE_REASONS: readonly string[] = [
  DRAWGUESS_REASONS.phase,
  DRAWGUESS_REASONS.stale,
  DRAWGUESS_REASONS.deadline,
];

/**
 * Scheduled phase settlement through the shared settle.due handler.
 * The staleness gate compares the payload's pinned arming field by
 * field (game sequence, phase revision, turn index, deadline): if
 * the room has moved on, the delivery is a no-op. The stale-revision
 * reason stays listed because a race window exists between the
 * isCurrent check and the dispatch.
 */
const handleDrawGuessSettleDueEffect = createSettleDueHandler<
  DrawGuessState,
  DrawGuessSettleDueEffect['payload'],
  DrawGuessInternalCommand
>({
  namespace: 'drawguess:settle',
  label: 'DrawGuess settle',
  command: { type: 'drawguess.phase.settleExpired' },
  supersededReasons: SUPERSEDED_SETTLE_REASONS,
  isCurrent: (state, payload) =>
    state.gameSequence === payload.gameSequence &&
    state.phaseRevision === payload.phaseRevision &&
    state.turnIndex === payload.turnIndex &&
    expiringPhaseDeadlineAt(state) === payload.deadlineAt,
});

const SUPERSEDED_DEAL_REASONS: readonly string[] = [
  DRAWGUESS_REASONS.stale,
  DRAWGUESS_REASONS.wordsDealt,
];

async function handleDrawGuessDealWordsEffect(
  effect: Extract<DrawGuessEffect, { type: 'drawguess.words.deal' }>,
  context: WorkerEffectContext<DrawGuessState, DrawGuessInternalCommand>,
): Promise<void> {
  const state = context.state;
  if (
    state.phase.kind !== 'wordSelect' ||
    state.turnIndex !== effect.payload.turnIndex ||
    state.phase.choices.length > 0
  ) {
    return;
  }
  const choices = await dealDrawGuessWords({
    db: context.bindings.DB,
    usedWords: state.usedWords,
    participantUserIds: getDrawGuessParticipantUserIds(state),
  });
  await dispatchEffectCommand(
    context,
    {
      type: 'drawguess.words.dealt',
      turnIndex: effect.payload.turnIndex,
      choices,
    },
    {
      namespace: 'drawguess:words-deal',
      supersededReasons: SUPERSEDED_DEAL_REASONS,
      label: 'DrawGuess words-deal',
    },
  );
}

/** Deliver one validated DrawGuess effect through the Worker runtime. */
export async function handleDrawGuessEffect(
  effect: DrawGuessEffect,
  context: WorkerEffectContext<DrawGuessState, DrawGuessInternalCommand>,
): Promise<void> {
  switch (effect.type) {
    case 'drawguess.words.deal':
      await handleDrawGuessDealWordsEffect(effect, context);
      return;
    case 'drawguess.word.recordSeen':
      await recordDrawGuessWordSeen({
        db: context.bindings.DB,
        word: effect.payload.word,
        participantUserIds: effect.payload.participantUserIds,
      });
      return;
    case 'drawguess.game.completed':
      await publishGameRewards(
        { ...effect.payload, kind: 'completion', gameType: 'drawguess' },
        context,
      );
      return;
    case 'drawguess.settle.due':
      await handleDrawGuessSettleDueEffect(effect, context);
      return;
  }
}
