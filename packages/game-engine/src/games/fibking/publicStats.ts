/** Public FibKing statistics and completion contracts. */

import { z } from 'zod';

import {
  type GameCompletionPayloadV2,
  gameCompletionPayloadV2Schema,
  type GameCompletionStatsFact,
} from '../../platform/engine/completionEffect';
import { FIBKING_GAME_TYPE } from '../../platform/protocol/gameTypes';

const count = z.number().refine((value) => Number.isSafeInteger(value) && value >= 0);

const countFields = {
  gamesPlayed: count,
  guesserRounds: count,
  honestRounds: count,
  fibberRounds: count,
  honestFoundRounds: count,
  honestRevealedRounds: count,
  fibberRevealedCount: count,
};

function hasValidFibCounts(stats: {
  readonly guesserRounds: number;
  readonly honestRounds: number;
  readonly fibberRounds: number;
  readonly honestFoundRounds: number;
  readonly honestRevealedRounds: number;
  readonly fibberRevealedCount: number;
}): boolean {
  return (
    stats.honestFoundRounds <= stats.guesserRounds &&
    stats.honestRevealedRounds <= stats.honestRounds &&
    stats.fibberRevealedCount <= stats.fibberRounds
  );
}

export const fibPublicStatsSchema = z
  .strictObject({
    gameType: z.literal(FIBKING_GAME_TYPE),
    ...countFields,
  })
  .superRefine((stats, context) => {
    if (!hasValidFibCounts(stats)) {
      context.addIssue({ code: 'custom', message: 'FibKing role counts are inconsistent' });
    }
  });

export interface FibPublicStats {
  readonly gameType: typeof FIBKING_GAME_TYPE;
  readonly gamesPlayed: number;
  readonly guesserRounds: number;
  readonly honestRounds: number;
  readonly fibberRounds: number;
  readonly honestFoundRounds: number;
  readonly honestRevealedRounds: number;
  readonly fibberRevealedCount: number;
}

export function parseFibPublicStats(value: unknown): FibPublicStats {
  return fibPublicStatsSchema.parse(value);
}

export interface FibCompletionStatsFact extends GameCompletionStatsFact {
  readonly gamesPlayed: 1;
  readonly guesserRounds: number;
  readonly honestRounds: number;
  readonly fibberRounds: number;
  readonly honestFoundRounds: number;
  readonly honestRevealedRounds: number;
  readonly fibberRevealedCount: number;
}

const fibCompletionFactSchema = z
  .strictObject({
    userId: z.string().min(1),
    ...countFields,
    gamesPlayed: z.literal(1),
  })
  .superRefine((stats, context) => {
    if (!hasValidFibCounts(stats)) {
      context.addIssue({ code: 'custom', message: 'FibKing role counts are inconsistent' });
    }
  });

export const fibkingCompletionPayloadSchema =
  gameCompletionPayloadV2Schema(fibCompletionFactSchema);

export type FibCompletionPayload = GameCompletionPayloadV2<FibCompletionStatsFact>;
