/** Delayed camp aggregates preserve visibility, replay safety, and bounded historical reads. */
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { createRowCountingDb } from '../../../../test/rowCountingDb';
import { aggregateWerewolfCampStats } from '../campAggregation';
import { getWerewolfPublicUserStats } from '../publicUserStats';

const NOW = Date.parse('2026-11-12T14:00:00.000Z');
const USER_ID = 'camp-aggregation-user';

async function insertCamp(
  key: string,
  camp: string,
  settledAt: string,
  isAggregated = 0,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO camp_settlements (user_id, settle_key, camp, settled_at, is_aggregated)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(USER_ID, key, camp, settledAt, isAggregated)
    .run();
}

async function seedHistory(count: number, pendingTime: string): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      `
      WITH RECURSIVE numbers(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM numbers WHERE n < ?)
      INSERT INTO camp_settlements (user_id, settle_key, camp, settled_at, is_aggregated)
      SELECT ?, 'history:' || n, 'wolf', '2025-01-01 00:00:00', 1 FROM numbers
    `,
    ).bind(count, USER_ID),
    env.DB.prepare('INSERT INTO werewolf_user_camp_stats (user_id, wolf_count) VALUES (?, ?)').bind(
      USER_ID,
      count,
    ),
    env.DB.prepare(
      `
      WITH RECURSIVE numbers(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM numbers WHERE n < ?)
      INSERT INTO camp_settlements (user_id, settle_key, camp, settled_at)
      SELECT ?, 'pending:' || n, 'god', ? FROM numbers
    `,
    ).bind(count, USER_ID, pendingTime),
  ]);
}

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(USER_ID).run();
  await env.DB.prepare(
    "INSERT INTO users (id, display_name, is_anonymous) VALUES (?, 'Camp aggregate', 0)",
  )
    .bind(USER_ID)
    .run();
});

describe('Werewolf camp aggregation', () => {
  it('counts due records before cron and preserves mixed timestamp formats at the exact boundary', async () => {
    await insertCamp('iso', 'wolf', '2026-11-12T11:59:59.000Z');
    await insertCamp('sqlite', 'god', '2026-11-12 11:59:59');
    await insertCamp('boundary', 'villager', '2026-11-12T12:00:00.000Z');
    await insertCamp('future', 'third', '2026-11-12T12:00:01.000Z');
    const before = await getWerewolfPublicUserStats(USER_ID, env, NOW);
    expect(before.campStats).toEqual({
      total: 3,
      counts: { wolf: 1, god: 1, villager: 1, third: 0 },
    });
    expect(before.nextVisibilityAt).toBe(NOW + 1000);

    await aggregateWerewolfCampStats(env.DB, NOW);
    expect(await getWerewolfPublicUserStats(USER_ID, env, NOW)).toEqual(before);
    expect((await getWerewolfPublicUserStats(USER_ID, env, NOW + 1000)).campStats.total).toBe(4);
    expect(
      (await getWerewolfPublicUserStats(USER_ID, env, NOW + 1000)).nextVisibilityAt,
    ).toBeNull();
  });

  it('keeps concurrent reads and repeated or concurrent aggregation from double counting', async () => {
    await insertCamp('one', 'wolf', '2026-11-12T11:00:00.000Z');
    const results = await Promise.all([
      aggregateWerewolfCampStats(env.DB, NOW),
      aggregateWerewolfCampStats(env.DB, NOW),
      getWerewolfPublicUserStats(USER_ID, env, NOW),
    ]);
    expect(results[2]?.campStats.total).toBe(1);
    await aggregateWerewolfCampStats(env.DB, NOW);
    expect((await getWerewolfPublicUserStats(USER_ID, env, NOW)).campStats.total).toBe(1);
    expect(
      await env.DB.prepare('SELECT wolf_count FROM werewolf_user_camp_stats WHERE user_id = ?')
        .bind(USER_ID)
        .first(),
    ).toEqual({ wolf_count: 1 });
    expect(
      await env.DB.prepare('SELECT is_aggregated FROM camp_settlements WHERE user_id = ?')
        .bind(USER_ID)
        .first(),
    ).toEqual({ is_aggregated: 1 });
  });

  it('rolls back the aggregate if marking the source records fails', async () => {
    await insertCamp('rollback', 'third', '2026-11-12T11:00:00.000Z');
    await env.DB.prepare(
      `CREATE TRIGGER reject_camp_mark BEFORE UPDATE OF is_aggregated
      ON camp_settlements WHEN NEW.is_aggregated = 1
      BEGIN SELECT RAISE(ABORT, 'camp mark failed'); END;`,
    ).run();
    try {
      await expect(aggregateWerewolfCampStats(env.DB, NOW)).rejects.toThrow('camp mark failed');
      expect(
        await env.DB.prepare('SELECT user_id FROM werewolf_user_camp_stats WHERE user_id = ?')
          .bind(USER_ID)
          .first(),
      ).toBeNull();
      expect(
        await env.DB.prepare('SELECT is_aggregated FROM camp_settlements WHERE user_id = ?')
          .bind(USER_ID)
          .first(),
      ).toEqual({ is_aggregated: 0 });
      expect((await getWerewolfPublicUserStats(USER_ID, env, NOW)).campStats.total).toBe(1);
    } finally {
      await env.DB.exec('DROP TRIGGER reject_camp_mark');
    }
  });

  it.each([100, 10_000])(
    'does not scan %i historical or unexpired records on profile reads',
    async (size) => {
      await seedHistory(size, '2026-11-12T13:00:00.000Z');
      await insertCamp('tail', 'third', '2026-11-12T11:00:00.000Z');
      const counted = createRowCountingDb(env.DB);
      const result = await getWerewolfPublicUserStats(USER_ID, { ...env, DB: counted.db }, NOW);
      expect(result.campStats.total).toBe(size + 1);
      expect(counted.counts.rowsRead).toBeLessThanOrEqual(40);
      expect(counted.counts.rowsWritten).toBe(0);
      counted.reset();
      await aggregateWerewolfCampStats(counted.db, NOW);
      expect(counted.counts.rowsRead).toBeLessThanOrEqual(80);
      expect(counted.counts.rowsWritten).toBeLessThanOrEqual(12);
    },
  );

  it.each([1000, 10_000])(
    'bounds a %i-record backlog without truncating visibility',
    async (size) => {
      await seedHistory(size, '2026-11-12T11:00:00.000Z');
      const counted = createRowCountingDb(env.DB);
      await aggregateWerewolfCampStats(counted.db, NOW);
      expect(counted.counts.rowsRead).toBeLessThanOrEqual(4096);
      expect(counted.counts.rowsWritten).toBeLessThanOrEqual(1100);
      expect(
        await env.DB.prepare(
          'SELECT COUNT(*) AS count FROM camp_settlements WHERE user_id = ? AND is_aggregated = 0',
        )
          .bind(USER_ID)
          .first(),
      ).toEqual({ count: size - 256 });
      expect((await getWerewolfPublicUserStats(USER_ID, env, NOW)).campStats).toEqual({
        total: size * 2,
        counts: { wolf: size, god: size, villager: 0, third: 0 },
      });
    },
  );

  it('uses the intended partial indexes for due user reads and global maintenance', async () => {
    const userPlan = await env.DB.prepare(
      `
      EXPLAIN QUERY PLAN SELECT camp, COUNT(*) FROM camp_settlements
      WHERE user_id = ? AND is_aggregated = 0 AND datetime(settled_at) <= datetime(?)
      GROUP BY camp
    `,
    )
      .bind(USER_ID, '2026-11-12 12:00:00')
      .all<{ detail: string }>();
    const globalPlan = await env.DB.prepare(
      `
      EXPLAIN QUERY PLAN SELECT user_id, settle_key FROM camp_settlements
      WHERE is_aggregated = 0 AND datetime(settled_at) <= datetime(?)
      ORDER BY datetime(settled_at), user_id, settle_key LIMIT 32
    `,
    )
      .bind('2026-11-12 12:00:00')
      .all<{ detail: string }>();
    expect(userPlan.results.some((row) => row.detail.includes('idx_camp_pending_user'))).toBe(true);
    expect(globalPlan.results.some((row) => row.detail.includes('idx_camp_pending_due'))).toBe(
      true,
    );
  });

  it('deletes aggregates and source receipts together with the account', async () => {
    await insertCamp('delete', 'wolf', '2026-11-12T11:00:00.000Z');
    await aggregateWerewolfCampStats(env.DB, NOW);
    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(USER_ID).run();
    expect(
      await env.DB.prepare('SELECT * FROM werewolf_user_camp_stats WHERE user_id = ?')
        .bind(USER_ID)
        .first(),
    ).toBeNull();
    expect(
      await env.DB.prepare('SELECT * FROM camp_settlements WHERE user_id = ?')
        .bind(USER_ID)
        .first(),
    ).toBeNull();
  });
});
