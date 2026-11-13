/** Public Story Relay statistics and completion contracts. */

import { z } from 'zod';

import {
  type GameCompletionPayloadV2,
  gameCompletionPayloadV2Schema,
  type GameCompletionStatsFact,
} from '../../platform/engine/completionEffect';
import { STORY_RELAY_GAME_TYPE } from './state/types';

const count = z.number().refine((value) => Number.isSafeInteger(value) && value >= 0);

export const storyRelayPublicStatsSchema = z.strictObject({
  gameType: z.literal(STORY_RELAY_GAME_TYPE),
  gamesPlayed: count,
  paragraphsSubmitted: count,
});

export interface StoryRelayPublicStats {
  readonly gameType: typeof STORY_RELAY_GAME_TYPE;
  readonly gamesPlayed: number;
  readonly paragraphsSubmitted: number;
}

export function parseStoryRelayPublicStats(value: unknown): StoryRelayPublicStats {
  return storyRelayPublicStatsSchema.parse(value);
}

export interface StoryRelayCompletionStatsFact extends GameCompletionStatsFact {
  readonly gamesPlayed: 1;
  readonly paragraphsSubmitted: number;
}

const storyRelayCompletionFactSchema = z.strictObject({
  userId: z.string().min(1),
  gamesPlayed: z.literal(1),
  paragraphsSubmitted: count,
});

export const storyRelayCompletionPayloadSchema = gameCompletionPayloadV2Schema(
  storyRelayCompletionFactSchema,
);

export type StoryRelayCompletionPayload = GameCompletionPayloadV2<StoryRelayCompletionStatsFact>;
