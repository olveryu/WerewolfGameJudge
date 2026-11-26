import { z } from 'zod';

import {
  type GameCompletionPayloadV2,
  gameCompletionPayloadV2Schema,
  type GameCompletionStatsFact,
} from '../../platform/engine/completionEffect';

/** Cumulative eligible terminal completions and wins for one player. */
export interface DecryptoPublicStats {
  readonly gameType: 'decrypto';
  readonly gamesPlayed: number;
  readonly wins: number;
}

/** Decode the exact public shape, rejecting missing and invalid counts. */
export function parseDecryptoPublicStats(value: unknown): DecryptoPublicStats {
  return z
    .strictObject({
      gameType: z.literal('decrypto'),
      gamesPlayed: z.int().nonnegative(),
      wins: z.int().nonnegative(),
    })
    .parse(value);
}

export interface DecryptoCompletionStatsFact extends GameCompletionStatsFact {
  readonly gamesPlayed: 1;
  readonly wins: 0 | 1;
}

/** One fact per eligible human, in seat order; no inferred gameplay outcomes. */
export const decryptoCompletionPayloadSchema = gameCompletionPayloadV2Schema(
  z.strictObject({
    userId: z.string().min(1),
    gamesPlayed: z.literal(1),
    wins: z.union([z.literal(0), z.literal(1)]),
  }),
);

export type DecryptoCompletionPayload = GameCompletionPayloadV2<DecryptoCompletionStatsFact>;
