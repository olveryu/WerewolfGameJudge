/** Integration contract for the production daily reward timestamp migration. */

import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

const MIGRATION_NAME = '0040_normalize_daily_reward_timestamp.sql';
const INSERT_TRIGGER = 'user_stats_last_login_reward_at_insert';
const UPDATE_TRIGGER = 'user_stats_last_login_reward_at_update';

function requireMigration() {
  const migration = env.TEST_MIGRATIONS.find(({ name }) => name === MIGRATION_NAME);
  if (migration === undefined || migration.queries.length === 0) {
    throw new Error(`[FAIL-FAST] Missing test migration ${MIGRATION_NAME}`);
  }
  return migration;
}

async function dropTimestampTriggers(): Promise<void> {
  await env.DB.exec(`
    DROP TRIGGER IF EXISTS ${INSERT_TRIGGER};
    DROP TRIGGER IF EXISTS ${UPDATE_TRIGGER};
  `);
}

async function insertStats(userId: string, lastLoginRewardAt: string): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO users (id, is_anonymous, created_at, updated_at)
       VALUES (?, 1, datetime('now'), datetime('now'))`,
    ).bind(userId),
    env.DB.prepare(
      `INSERT INTO user_stats (user_id, last_login_reward_at, updated_at)
       VALUES (?, ?, datetime('now'))`,
    ).bind(userId, lastLoginRewardAt),
  ]);
}

async function applyTimestampMigration(): Promise<void> {
  const migration = requireMigration();
  await env.DB.batch(migration.queries.map((query) => env.DB.prepare(query)));
}

describe(MIGRATION_NAME, () => {
  it('normalizes valid date-only rows, preserves ISO rows, and enforces future writes', async () => {
    await dropTimestampTriggers();
    await insertStats('legacy-daily-reward', '2026-07-01');
    await insertStats('canonical-daily-reward', '2026-07-02T03:04:05.006Z');

    await applyTimestampMigration();

    const result = await env.DB.prepare(
      `SELECT user_id, last_login_reward_at
       FROM user_stats
       WHERE user_id IN ('canonical-daily-reward', 'legacy-daily-reward')
       ORDER BY user_id`,
    ).all<{ user_id: string; last_login_reward_at: string }>();
    expect(result.results).toEqual([
      {
        user_id: 'canonical-daily-reward',
        last_login_reward_at: '2026-07-02T03:04:05.006Z',
      },
      {
        user_id: 'legacy-daily-reward',
        last_login_reward_at: '2026-07-01T00:00:00.000Z',
      },
    ]);

    await expect(
      env.DB.prepare(
        `UPDATE user_stats SET last_login_reward_at = '2026-07-03'
         WHERE user_id = 'legacy-daily-reward'`,
      ).run(),
    ).rejects.toThrow('last_login_reward_at must be a canonical ISO timestamp');
  });

  it('aborts instead of guessing how to repair an invalid calendar date', async () => {
    await dropTimestampTriggers();
    await insertStats('malformed-daily-reward', '2026-02-30');

    await expect(applyTimestampMigration()).rejects.toThrow();

    const row = await env.DB.prepare(
      `SELECT last_login_reward_at FROM user_stats WHERE user_id = 'malformed-daily-reward'`,
    ).first<{ last_login_reward_at: string }>();
    expect(row).toEqual({ last_login_reward_at: '2026-02-30' });
  });
});
