import {
  type DecryptoCompletionPayload,
  type DecryptoPublicStats,
  parseDecryptoPublicStats,
} from '@game-judge/game-engine/games/decrypto/public';
import { getTableName } from 'drizzle-orm';

import type { Env } from '../../env';
import { countGameStats, readCountGameStats } from '../../features/account/gameStats';
import { decryptoUserStats } from './dbSchema';

const table = getTableName(decryptoUserStats);

export const decryptoStatsSettlement = (facts: DecryptoCompletionPayload['stats']) =>
  countGameStats(facts, table, (fact) => ({
    games_played: fact.gamesPlayed,
    wins: fact.wins,
  }));

export async function getDecryptoPublicUserStats(
  userId: string,
  bindings: Env,
): Promise<DecryptoPublicStats> {
  return parseDecryptoPublicStats({
    gameType: 'decrypto',
    ...(await readCountGameStats(bindings.DB, userId, table, {
      gamesPlayed: 'games_played',
      wins: 'wins',
    })),
  });
}
