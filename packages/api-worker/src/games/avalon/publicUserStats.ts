import { parseAvalonPublicStats } from '@game-judge/game-engine/games/avalon/public';
import { getTableName } from 'drizzle-orm';

import type { Env } from '../../env';
import { readRoleGameStats, roleGameStats } from '../../features/account/gameStats';
import { avalonUserStats } from './dbSchema';

const table = getTableName(avalonUserStats);

export const avalonStatsSettlement = <
  T extends { readonly userId: string; readonly role: string; readonly won: boolean },
>(
  facts: readonly T[],
) => roleGameStats(facts, table);

export async function getAvalonPublicUserStats(userId: string, bindings: Env) {
  return parseAvalonPublicStats({
    gameType: 'avalon',
    ...(await readRoleGameStats(bindings.DB, userId, table)),
  });
}
