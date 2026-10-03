/** Worker-side execution for DrawGuess word-dealing effects. */

import {
  DRAWGUESS_REASONS,
  type DrawGuessEffect,
  type DrawGuessInternalCommand,
  type DrawGuessState,
} from '@game-judge/game-engine/games/drawguess/public';
import { z } from 'zod';

import { createEffectCommandId } from '../../platform/gameModules/effectCommandId';
import type { WorkerEffectContext } from '../../platform/gameModules/workerModule';
import { publishGameRewards } from '../../features/account/settleGameRewards';
import { dealDrawGuessWords } from './wordDeal';

const dealWordsEffectSchema = z.strictObject({
  type: z.literal('drawguess.words.deal'),
  payload: z.strictObject({
    turnIndex: z.int().nonnegative(),
  }),
});

const gameCompletedEffectSchema = z.strictObject({
  type: z.literal('drawguess.game.completed'),
  payload: z.strictObject({
    roundId: z.string().min(1),
    completedAt: z.number().int().nonnegative(),
    participantUserIds: z.array(z.string().min(1)),
  }),
});

export const drawGuessEffectSchema: z.ZodType<DrawGuessEffect> = z.union([
  dealWordsEffectSchema,
  gameCompletedEffectSchema,
]);

function isSupersededDealRejection(reason: string): boolean {
  return reason === DRAWGUESS_REASONS.stale || reason === DRAWGUESS_REASONS.wordsDealt;
}

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
  });
  const commandId = await createEffectCommandId('drawguess:words-deal', context.effectId);
  const result = await context.dispatchInternal(commandId, {
    type: 'drawguess.words.dealt',
    turnIndex: effect.payload.turnIndex,
    choices,
  });
  if (result.commandId !== commandId) {
    throw new Error(
      `[FAIL-FAST] DrawGuess words-deal receipt ${result.commandId} does not match ${commandId}`,
    );
  }
  if (result.kind === 'rejected') {
    if (isSupersededDealRejection(result.reason)) return;
    throw new Error(`DrawGuess words-deal command ${commandId} was rejected: ${result.reason}`);
  }
  if (result.outcome.kind !== 'success') {
    throw new Error(`DrawGuess words-deal command ${commandId} failed: ${result.outcome.reason}`);
  }
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
    case 'drawguess.game.completed':
      await publishGameRewards(
        { ...effect.payload, kind: 'completion', gameType: 'drawguess' },
        context,
      );
      return;
  }
}
