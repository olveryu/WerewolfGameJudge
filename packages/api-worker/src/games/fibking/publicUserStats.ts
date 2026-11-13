import {
  type fibkingCompletionPayloadSchema,
  parseFibPublicStats,
} from '@game-judge/game-engine/games/fibking/public';
import { getTableName } from 'drizzle-orm';
import type { z } from 'zod';

import type { Env } from '../../env';
import { countGameStats, readCountGameStats } from '../../features/account/gameStats';
import { fibkingUserStats } from './dbSchema';

type Fact = z.infer<typeof fibkingCompletionPayloadSchema>['stats'][number];
const table = getTableName(fibkingUserStats);
const columns = {
  gamesPlayed: 'games_played',
  guesserRounds: 'guesser_rounds',
  honestRounds: 'honest_rounds',
  fibberRounds: 'fibber_rounds',
  honestFoundRounds: 'honest_found_rounds',
  honestRevealedRounds: 'honest_revealed_rounds',
  fibberRevealedCount: 'fibber_revealed_count',
} as const;

export function fibStatsSettlement(facts: readonly Fact[]) {
  return countGameStats(facts, table, (fact) => ({
    games_played: fact.gamesPlayed,
    guesser_rounds: fact.guesserRounds,
    honest_rounds: fact.honestRounds,
    fibber_rounds: fact.fibberRounds,
    honest_found_rounds: fact.honestFoundRounds,
    honest_revealed_rounds: fact.honestRevealedRounds,
    fibber_revealed_count: fact.fibberRevealedCount,
  }));
}

export async function getFibPublicUserStats(userId: string, bindings: Env) {
  return parseFibPublicStats({
    gameType: 'fibking',
    ...(await readCountGameStats(bindings.DB, userId, table, columns)),
  });
}
