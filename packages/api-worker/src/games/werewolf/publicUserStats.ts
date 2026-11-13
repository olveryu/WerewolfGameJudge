/** Werewolf-owned public statistics query. */

import type {
  WerewolfCampStats,
  WerewolfPublicStats,
} from '@game-judge/game-engine/games/werewolf/public';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { createDb } from '../../db';
import type { Env } from '../../env';
import { campSettlements, werewolfUserCampStats } from './dbSchema';

const VISIBILITY_DELAY_MS = 2 * 60 * 60 * 1000;
const rowSchema = z.strictObject({
  camp: z.enum(['wolf', 'god', 'villager', 'third']).nullable(),
  count: z.number().int().nonnegative().nullable(),
  nextVisibilityAt: z.number().int().nonnegative().nullable(),
});

/** Read the aggregate and due tail in one snapshot, independent of cron progress. */
export async function getWerewolfPublicUserStats(
  userId: string,
  bindings: Env,
  nowMs = Date.now(),
): Promise<WerewolfPublicStats> {
  const cutoff = new Date(nowMs - VISIBILITY_DELAY_MS).toISOString();
  const rawRows = await createDb(bindings.DB).all(sql`
    WITH visible AS (
      SELECT 'wolf' AS camp, ${werewolfUserCampStats.wolfCount} AS count
        FROM ${werewolfUserCampStats} WHERE ${werewolfUserCampStats.userId} = ${userId}
      UNION ALL SELECT 'god', ${werewolfUserCampStats.godCount}
        FROM ${werewolfUserCampStats} WHERE ${werewolfUserCampStats.userId} = ${userId}
      UNION ALL SELECT 'villager', ${werewolfUserCampStats.villagerCount}
        FROM ${werewolfUserCampStats} WHERE ${werewolfUserCampStats.userId} = ${userId}
      UNION ALL SELECT 'third', ${werewolfUserCampStats.thirdCount}
        FROM ${werewolfUserCampStats} WHERE ${werewolfUserCampStats.userId} = ${userId}
      UNION ALL
      SELECT ${campSettlements.camp}, count(*)
        FROM ${campSettlements}
        WHERE ${campSettlements.userId} = ${userId}
          AND ${campSettlements.isAggregated} = 0
          AND datetime(${campSettlements.settledAt}) <= datetime(${cutoff})
        GROUP BY ${campSettlements.camp}
    )
    SELECT camp, SUM(count) AS count, NULL AS nextVisibilityAt FROM visible GROUP BY camp
    UNION ALL
    SELECT NULL, NULL, (
      SELECT unixepoch(${campSettlements.settledAt}, '+2 hours') * 1000
      FROM ${campSettlements}
      WHERE ${campSettlements.userId} = ${userId}
        AND ${campSettlements.isAggregated} = 0
        AND datetime(${campSettlements.settledAt}) > datetime(${cutoff})
      ORDER BY datetime(${campSettlements.settledAt}) LIMIT 1
    )
  `);
  const rows = z.array(rowSchema).parse(rawRows);

  const counts: Record<keyof WerewolfCampStats['counts'], number> = {
    wolf: 0,
    god: 0,
    villager: 0,
    third: 0,
  };
  let nextVisibilityAt: number | null = null;
  for (const row of rows) {
    if (row.camp === null) {
      nextVisibilityAt = row.nextVisibilityAt;
    } else {
      if (row.count === null) throw new Error('Werewolf camp count missing');
      counts[row.camp] = row.count;
    }
  }

  const total = counts.wolf + counts.god + counts.villager + counts.third;
  return { gameType: 'werewolf', campStats: { total, counts }, nextVisibilityAt };
}
