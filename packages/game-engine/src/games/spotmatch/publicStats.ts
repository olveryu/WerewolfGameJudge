import { z } from 'zod';

import {
  type GameCompletionPayloadV2,
  gameCompletionPayloadV2Schema,
  type GameCompletionStatsFact,
} from '../../platform/engine/completionEffect';

/** Cumulative eligible terminal completions; gameplay-specific metrics require a design. */
export interface SpotmatchPublicStats {
  readonly gameType: 'spotmatch';
  readonly gamesPlayed: number;
  readonly wins: number;
  readonly correctCards: number;
  readonly mistakes: number;
}

/** Decode the exact public shape, rejecting missing and invalid counts. */
export function parseSpotmatchPublicStats(value: unknown): SpotmatchPublicStats {
  return z
    .strictObject({
      gameType: z.literal('spotmatch'),
      gamesPlayed: z.int().nonnegative(),
      wins: z.int().nonnegative(),
      correctCards: z.int().nonnegative(),
      mistakes: z.int().nonnegative(),
    })
    .refine((stats) => stats.wins <= stats.gamesPlayed, 'Wins cannot exceed completed games')
    .parse(value);
}

export interface SpotmatchCompletionStatsFact extends GameCompletionStatsFact {
  readonly gamesPlayed: 1;
  readonly wins: 0 | 1;
  readonly correctCards: number;
  readonly mistakes: number;
}

/** One fact per eligible human, in seat order; no inferred gameplay outcomes. */
export const spotmatchCompletionPayloadSchema = gameCompletionPayloadV2Schema(
  z.strictObject({
    userId: z.string().min(1),
    gamesPlayed: z.literal(1),
    wins: z.union([z.literal(0), z.literal(1)]),
    correctCards: z.int().positive(),
    mistakes: z.int().nonnegative(),
  }),
);

export type SpotmatchCompletionPayload = GameCompletionPayloadV2<SpotmatchCompletionStatsFact>;
