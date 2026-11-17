import {
  parseSpotmatchPublicStats,
  type SpotmatchCompletionPayload,
  type SpotmatchPublicStats,
} from '@game-judge/game-engine/games/spotmatch/public';
import { getTableName } from 'drizzle-orm';

import type { Env } from '../../env';
import { countGameStats, readCountGameStats } from '../../features/account/gameStats';
import { spotmatchUserStats } from './dbSchema';

const table = getTableName(spotmatchUserStats);

export const spotmatchStatsSettlement = (facts: SpotmatchCompletionPayload['stats']) =>
  countGameStats(facts, table, (fact) => ({
    games_played: fact.gamesPlayed,
    wins: fact.wins,
    correct_cards: fact.correctCards,
    mistakes: fact.mistakes,
  }));

export async function getSpotmatchPublicUserStats(
  userId: string,
  bindings: Env,
): Promise<SpotmatchPublicStats> {
  return parseSpotmatchPublicStats({
    gameType: 'spotmatch',
    ...(await readCountGameStats(bindings.DB, userId, table, {
      gamesPlayed: 'games_played',
      wins: 'wins',
      correctCards: 'correct_cards',
      mistakes: 'mistakes',
    })),
  });
}
