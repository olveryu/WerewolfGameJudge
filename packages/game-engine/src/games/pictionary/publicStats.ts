/** Public Pictionary statistics and completion contracts. */

import { z } from 'zod';

import {
  type GameCompletionPayloadV2,
  gameCompletionPayloadV2Schema,
  type GameCompletionStatsFact,
} from '../../platform/engine/completionEffect';
import { PICTIONARY_GAME_TYPE } from '../../platform/protocol/gameTypes';

const count = z.number().refine((value) => Number.isSafeInteger(value) && value >= 0);

export const pictionaryPublicStatsSchema = z.strictObject({
  gameType: z.literal(PICTIONARY_GAME_TYPE),
  gamesPlayed: count,
  textSubmissions: count,
  drawingSubmissions: count,
});

export interface PictionaryPublicStats {
  readonly gameType: typeof PICTIONARY_GAME_TYPE;
  readonly gamesPlayed: number;
  readonly textSubmissions: number;
  readonly drawingSubmissions: number;
}

export function parsePictionaryPublicStats(value: unknown): PictionaryPublicStats {
  return pictionaryPublicStatsSchema.parse(value);
}

export interface PictionaryCompletionStatsFact extends GameCompletionStatsFact {
  readonly gamesPlayed: 1;
  readonly textSubmissions: number;
  readonly drawingSubmissions: number;
}

const pictionaryCompletionFactSchema = z.strictObject({
  userId: z.string().min(1),
  gamesPlayed: z.literal(1),
  textSubmissions: count,
  drawingSubmissions: count,
});

export const pictionaryCompletionPayloadSchema = gameCompletionPayloadV2Schema(
  pictionaryCompletionFactSchema,
);

export type PictionaryCompletionPayload = GameCompletionPayloadV2<PictionaryCompletionStatsFact>;
