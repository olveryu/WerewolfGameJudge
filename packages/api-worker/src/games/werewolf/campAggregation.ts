/** Bounded, replay-safe materialization of Werewolf records past the visibility boundary. */
import { z } from 'zod';

import { createLogger } from '../../platform/observability/logger';

const BATCH_SIZE = 32;
const MAX_BATCHES = 8;
const VISIBILITY_DELAY_MS = 2 * 60 * 60 * 1000;
const log = createLogger('werewolf-camp-aggregation');
const candidateSchema = z.strictObject({
  userId: z.string().min(1),
  settleKey: z.string().min(1),
  camp: z.enum(['wolf', 'god', 'villager', 'third']),
});
type Candidate = z.output<typeof candidateSchema>;

function aggregateStatements(
  db: D1Database,
  candidates: readonly Candidate[],
  cutoff: string,
): D1PreparedStatement[] {
  const placeholders = candidates.map(() => '(?, ?)').join(', ');
  const parameters = candidates.flatMap((candidate) => [candidate.userId, candidate.settleKey]);
  const candidateKeys = `WITH candidate_keys(user_id, settle_key) AS (VALUES ${placeholders})`;
  // Drive primary-key lookups from the bounded keys, not a scan of all due records.
  const source = `FROM candidate_keys AS candidate CROSS JOIN camp_settlements AS source
    WHERE source.user_id = candidate.user_id AND source.settle_key = candidate.settle_key
      AND source.is_aggregated = 0 AND datetime(source.settled_at) <= datetime(?)`;
  return [
    db
      .prepare(
        `
      ${candidateKeys}
      INSERT INTO werewolf_user_camp_stats
        (user_id, wolf_count, god_count, villager_count, third_count)
      SELECT source.user_id, SUM(source.camp = 'wolf'), SUM(source.camp = 'god'),
        SUM(source.camp = 'villager'), SUM(source.camp = 'third')
      ${source} GROUP BY source.user_id
      ON CONFLICT (user_id) DO UPDATE SET
        wolf_count = werewolf_user_camp_stats.wolf_count + excluded.wolf_count,
        god_count = werewolf_user_camp_stats.god_count + excluded.god_count,
        villager_count = werewolf_user_camp_stats.villager_count + excluded.villager_count,
        third_count = werewolf_user_camp_stats.third_count + excluded.third_count
    `,
      )
      .bind(...parameters, cutoff),
    db
      .prepare(
        `${candidateKeys}
        UPDATE camp_settlements SET is_aggregated = 1
        WHERE rowid IN (SELECT source.rowid ${source})`,
      )
      .bind(...parameters, cutoff),
  ];
}

/** Aggregate at most 256 records per invocation without changing public visibility. */
export async function aggregateWerewolfCampStats(db: D1Database, nowMs: number): Promise<void> {
  const cutoff = new Date(nowMs - VISIBILITY_DELAY_MS).toISOString();
  let candidateCount = 0;
  for (let batchIndex = 0; batchIndex < MAX_BATCHES; batchIndex += 1) {
    const result = await db
      .prepare(
        `
      SELECT user_id AS userId, settle_key AS settleKey, camp
      FROM camp_settlements
      WHERE is_aggregated = 0 AND datetime(settled_at) <= datetime(?)
      ORDER BY datetime(settled_at), user_id, settle_key LIMIT ?
    `,
      )
      .bind(cutoff, BATCH_SIZE)
      .all();
    const candidates = z.array(candidateSchema).parse(result.results);
    if (candidates.length === 0) break;
    await db.batch(aggregateStatements(db, candidates, cutoff));
    candidateCount += candidates.length;
    if (candidates.length < BATCH_SIZE) break;
  }
  const oldest = await db
    .prepare(
      `
    SELECT settled_at AS settledAt FROM camp_settlements
    WHERE is_aggregated = 0 AND datetime(settled_at) <= datetime(?)
    ORDER BY datetime(settled_at), user_id, settle_key LIMIT 1
  `,
    )
    .bind(cutoff)
    .first<{ settledAt: string }>();
  log.info('camp aggregation complete', {
    candidateCount,
    reachedBatchLimit: candidateCount === BATCH_SIZE * MAX_BATCHES,
    oldestDueAt: oldest?.settledAt ?? null,
  });
}
