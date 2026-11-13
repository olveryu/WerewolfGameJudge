import { parseUndercoverPublicStats } from '@game-judge/game-engine/games/undercover/public';
import { getTableName } from 'drizzle-orm';

import type { Env } from '../../env';
import { readRoleGameStats, roleGameStats } from '../../features/account/gameStats';
import { undercoverUserStats } from './dbSchema';

const table = getTableName(undercoverUserStats);

export const undercoverStatsSettlement = <
  T extends { readonly userId: string; readonly role: string; readonly won: boolean },
>(
  facts: readonly T[],
) => roleGameStats(facts, table);

export async function getUndercoverPublicUserStats(userId: string, bindings: Env) {
  return parseUndercoverPublicStats({
    gameType: 'undercover',
    ...(await readRoleGameStats(bindings.DB, userId, table)),
  });
}
