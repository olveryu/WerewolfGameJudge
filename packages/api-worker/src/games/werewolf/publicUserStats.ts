/** Werewolf-owned public statistics query. */

import type {
  WerewolfCampStats,
  WerewolfPublicStats,
} from '@game-judge/game-engine/games/werewolf/public';
import { and, eq, sql } from 'drizzle-orm';

import { createDb } from '../../db';
import type { Env } from '../../env';
import { campSettlements } from './dbSchema';

/** Hours a finished game stays hidden from public camp statistics. */
const PUBLIC_VISIBILITY_DELAY_HOURS = 2;

export async function getWerewolfPublicUserStats(
  userId: string,
  bindings: Env,
): Promise<WerewolfPublicStats> {
  const rows = await createDb(bindings.DB)
    .select({ camp: campSettlements.camp, count: sql<number>`count(*)` })
    .from(campSettlements)
    .where(
      and(
        eq(campSettlements.userId, userId),
        sql`datetime(${campSettlements.settledAt}) <= datetime('now', ${`-${PUBLIC_VISIBILITY_DELAY_HOURS} hours`})`,
      ),
    )
    .groupBy(campSettlements.camp);

  const counts: Record<keyof WerewolfCampStats['counts'], number> = {
    wolf: 0,
    god: 0,
    villager: 0,
    third: 0,
  };
  for (const row of rows) {
    switch (row.camp) {
      case 'wolf':
      case 'god':
      case 'villager':
      case 'third':
        counts[row.camp] = row.count;
        break;
      default:
        throw new Error(`Invalid persisted Werewolf camp: ${row.camp}`);
    }
  }

  const total = counts.wolf + counts.god + counts.villager + counts.third;
  return { gameType: 'werewolf', campStats: { total, counts } };
}
