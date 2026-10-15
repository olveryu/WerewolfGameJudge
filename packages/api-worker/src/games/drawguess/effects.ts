/** Worker-side execution for DrawGuess word-dealing effects. */

import {
  DRAWGUESS_REASONS,
  type DrawGuessEffect,
  type DrawGuessInternalCommand,
  type DrawGuessState,
} from '@game-judge/game-engine/games/drawguess/public';
import { z } from 'zod';

import {
  gameCompletionPayloadSchema,
  publishGameRewards,
} from '../../features/account/settleGameRewards';
import { dispatchEffectCommand } from '../../platform/gameModules/effectDispatch';
import type { WorkerEffectContext } from '../../platform/gameModules/workerModule';
import { dealDrawGuessWords } from './wordDeal';

const dealWordsEffectSchema = z.strictObject({
  type: z.literal('drawguess.words.deal'),
  payload: z.strictObject({
    turnIndex: z.int().nonnegative(),
  }),
});

const gameCompletedEffectSchema = z.strictObject({
  type: z.literal('drawguess.game.completed'),
  payload: gameCompletionPayloadSchema,
});

export const drawGuessEffectSchema: z.ZodType<DrawGuessEffect> = z.union([
  dealWordsEffectSchema,
  gameCompletedEffectSchema,
]);

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
    case 'drawguess.game.completed':
      await publishGameRewards(
        { ...effect.payload, kind: 'completion', gameType: 'drawguess' },
        context,
      );
      return;
  }
}
