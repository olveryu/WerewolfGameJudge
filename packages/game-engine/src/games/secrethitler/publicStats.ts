import { z } from 'zod';

import {
  type GameCompletionPayloadV2,
  gameCompletionPayloadV2Schema,
  type GameCompletionStatsFact,
} from '../../platform/engine/completionEffect';

/** Cumulative completed games and opening-faction wins for eligible humans. */
export interface SecrethitlerPublicStats {
  readonly gameType: 'secrethitler';
  readonly gamesPlayed: number;
  readonly liberalWins: number;
  readonly fascistWins: number;
}

/** Decode the exact public shape, rejecting missing and invalid counts. */
export function parseSecrethitlerPublicStats(value: unknown): SecrethitlerPublicStats {
  return z
    .strictObject({
      gameType: z.literal('secrethitler'),
      gamesPlayed: z.int().nonnegative(),
      liberalWins: z.int().nonnegative(),
      fascistWins: z.int().nonnegative(),
    })
    .refine(
      ({ gamesPlayed, liberalWins, fascistWins }) =>
        liberalWins <= gamesPlayed &&
        fascistWins <= gamesPlayed &&
        liberalWins + fascistWins <= gamesPlayed,
      'faction wins cannot exceed games played',
    )
    .parse(value);
}

export interface SecrethitlerCompletionStatsFact extends GameCompletionStatsFact {
  readonly gamesPlayed: 1;
  readonly liberalWins: 0 | 1;
  readonly fascistWins: 0 | 1;
}

/** One fact per eligible human, in seat order, reflecting their opening faction. */
export const secrethitlerCompletionPayloadSchema = gameCompletionPayloadV2Schema(
  z
    .strictObject({
      userId: z.string().min(1),
      gamesPlayed: z.literal(1),
      liberalWins: z.union([z.literal(0), z.literal(1)]),
      fascistWins: z.union([z.literal(0), z.literal(1)]),
    })
    .refine(({ liberalWins, fascistWins }) => liberalWins + fascistWins <= 1),
);

export type SecrethitlerCompletionPayload =
  GameCompletionPayloadV2<SecrethitlerCompletionStatsFact>;
