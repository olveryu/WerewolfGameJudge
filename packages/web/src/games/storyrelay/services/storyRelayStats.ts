import {
  parseStoryRelayPublicStats,
  type StoryRelayPublicStats,
} from '@game-judge/game-engine/games/storyrelay/public';

import { publicGameStatsOptions } from '@/games/model/publicGameStats';

export const storyRelayPublicStatsOptions = (userId: string) =>
  publicGameStatsOptions('storyrelay', userId, parseStoryRelayPublicStats);

export type { StoryRelayPublicStats };
