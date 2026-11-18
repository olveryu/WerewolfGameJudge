import {
  parseSecrethitlerPublicStats,
  type SecrethitlerCompletionPayload,
  type SecrethitlerPublicStats,
} from '@game-judge/game-engine/games/secrethitler/public';
import { getTableName } from 'drizzle-orm';

import type { Env } from '../../env';
import { countGameStats, readCountGameStats } from '../../features/account/gameStats';
import { secrethitlerUserStats } from './dbSchema';

const table = getTableName(secrethitlerUserStats);

export const secrethitlerStatsSettlement = (facts: SecrethitlerCompletionPayload['stats']) =>
  countGameStats(facts, table, (fact) => ({
    games_played: fact.gamesPlayed,
    liberal_wins: fact.liberalWins,
    fascist_wins: fact.fascistWins,
  }));

export async function getSecrethitlerPublicUserStats(
  userId: string,
  bindings: Env,
): Promise<SecrethitlerPublicStats> {
  return parseSecrethitlerPublicStats({
    gameType: 'secrethitler',
    ...(await readCountGameStats(bindings.DB, userId, table, {
      gamesPlayed: 'games_played',
      liberalWins: 'liberal_wins',
      fascistWins: 'fascist_wins',
    })),
  });
}
