import {
  parsePictionaryPublicStats,
  type pictionaryCompletionPayloadSchema,
} from '@game-judge/game-engine/games/pictionary/public';
import { getTableName } from 'drizzle-orm';
import type { z } from 'zod';

import type { Env } from '../../env';
import { countGameStats, readCountGameStats } from '../../features/account/gameStats';
import { pictionaryUserStats } from './dbSchema';

type Fact = z.infer<typeof pictionaryCompletionPayloadSchema>['stats'][number];
const table = getTableName(pictionaryUserStats);
const columns = {
  gamesPlayed: 'games_played',
  textSubmissions: 'text_submissions',
  drawingSubmissions: 'drawing_submissions',
} as const;

export function pictionaryStatsSettlement(facts: readonly Fact[]) {
  return countGameStats(facts, table, (fact) => ({
    games_played: fact.gamesPlayed,
    text_submissions: fact.textSubmissions,
    drawing_submissions: fact.drawingSubmissions,
  }));
}

export async function getPictionaryPublicUserStats(userId: string, bindings: Env) {
  return parsePictionaryPublicStats({
    gameType: 'pictionary',
    ...(await readCountGameStats(bindings.DB, userId, table, columns)),
  });
}
