/** Public DrawGuess statistics and completion contracts. */

import { z } from 'zod';

import {
  type GameCompletionPayloadV2,
  gameCompletionPayloadV2Schema,
  type GameCompletionStatsFact,
} from '../../platform/engine/completionEffect';
import { DRAWGUESS_GAME_TYPE } from './state/types';

const count = z.number().refine((value) => Number.isSafeInteger(value) && value >= 0);

const countFields = {
  gamesPlayed: count,
  guessAttempts: count,
  guessRounds: count,
  guessedRounds: count,
  guessTimeMs: count,
  guessTimedRounds: count,
  drawingRounds: count,
  guessedDrawingRounds: count,
  totalScore: count,
  flowersReceived: count,
  eggsReceived: count,
  tomatoesReceived: count,
};

function hasValidDrawGuessCounts(stats: {
  readonly guessRounds: number;
  readonly guessedRounds: number;
  readonly guessTimedRounds: number;
  readonly drawingRounds: number;
  readonly guessedDrawingRounds: number;
}): boolean {
  return (
    stats.guessedRounds <= stats.guessRounds &&
    stats.guessTimedRounds <= stats.guessedRounds &&
    stats.guessedDrawingRounds <= stats.drawingRounds
  );
}

export const drawGuessPublicStatsSchema = z
  .strictObject({
    gameType: z.literal(DRAWGUESS_GAME_TYPE),
    ...countFields,
  })
  .superRefine((stats, context) => {
    if (!hasValidDrawGuessCounts(stats)) {
      context.addIssue({ code: 'custom', message: 'DrawGuess round counts are inconsistent' });
    }
  });

export interface DrawGuessPublicStats {
  readonly gameType: typeof DRAWGUESS_GAME_TYPE;
  readonly gamesPlayed: number;
  readonly guessAttempts: number;
  readonly guessRounds: number;
  readonly guessedRounds: number;
  readonly guessTimeMs: number;
  readonly guessTimedRounds: number;
  readonly drawingRounds: number;
  readonly guessedDrawingRounds: number;
  readonly totalScore: number;
  readonly flowersReceived: number;
  readonly eggsReceived: number;
  readonly tomatoesReceived: number;
}

export function parseDrawGuessPublicStats(value: unknown): DrawGuessPublicStats {
  return drawGuessPublicStatsSchema.parse(value);
}

export interface DrawGuessCompletionStatsFact extends GameCompletionStatsFact {
  readonly gamesPlayed: 1;
  readonly guessAttempts: number;
  readonly guessRounds: number;
  readonly guessedRounds: number;
  readonly guessTimeMs: number;
  readonly guessTimedRounds: number;
  readonly drawingRounds: number;
  readonly guessedDrawingRounds: number;
  readonly totalScore: number;
  readonly flowersReceived: number;
  readonly eggsReceived: number;
  readonly tomatoesReceived: number;
}

const drawGuessCompletionFactSchema = z
  .strictObject({
    userId: z.string().min(1),
    ...countFields,
    gamesPlayed: z.literal(1),
  })
  .superRefine((stats, context) => {
    if (!hasValidDrawGuessCounts(stats)) {
      context.addIssue({ code: 'custom', message: 'DrawGuess round counts are inconsistent' });
    }
  });

export const drawGuessCompletionPayloadSchema = gameCompletionPayloadV2Schema(
  drawGuessCompletionFactSchema,
);

export type DrawGuessCompletionPayload = GameCompletionPayloadV2<DrawGuessCompletionStatsFact>;
