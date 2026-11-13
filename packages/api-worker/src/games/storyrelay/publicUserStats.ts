import {
  parseStoryRelayPublicStats,
  type storyRelayCompletionPayloadSchema,
} from '@game-judge/game-engine/games/storyrelay/public';
import { getTableName } from 'drizzle-orm';
import type { z } from 'zod';

import type { Env } from '../../env';
import { countGameStats, readCountGameStats } from '../../features/account/gameStats';
import { storyRelayUserStats } from './dbSchema';

type Fact = z.infer<typeof storyRelayCompletionPayloadSchema>['stats'][number];
const table = getTableName(storyRelayUserStats);
const columns = {
  gamesPlayed: 'games_played',
  paragraphsSubmitted: 'paragraphs_submitted',
} as const;

export function storyRelayStatsSettlement(facts: readonly Fact[]) {
  return countGameStats(facts, table, (fact) => ({
    games_played: fact.gamesPlayed,
    paragraphs_submitted: fact.paragraphsSubmitted,
  }));
}

export async function getStoryRelayPublicUserStats(userId: string, bindings: Env) {
  return parseStoryRelayPublicStats({
    gameType: 'storyrelay',
    ...(await readCountGameStats(bindings.DB, userId, table, columns)),
  });
}
