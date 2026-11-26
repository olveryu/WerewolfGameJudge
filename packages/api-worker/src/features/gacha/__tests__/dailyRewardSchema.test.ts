/** Current-schema contract for the daily reward timestamp (triggers introduced by 0040):
 * last_login_reward_at must stay a canonical ISO timestamp. Runs on the full migration chain
 * applied by test/applyMigrations.ts. */

import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

describe('daily reward timestamp triggers', () => {
  it('rejects date-only writes to last_login_reward_at', async () => {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO users (id, is_anonymous, created_at, updated_at)
         VALUES ('canonical-daily-reward', 1, datetime('now'), datetime('now'))`,
      ),
      env.DB.prepare(
        `INSERT INTO user_stats (user_id, last_login_reward_at, updated_at)
         VALUES ('canonical-daily-reward', '2026-07-02T03:04:05.006Z', datetime('now'))`,
      ),
    ]);

    await expect(
      env.DB.prepare(
        `UPDATE user_stats SET last_login_reward_at = '2026-07-03'
         WHERE user_id = 'canonical-daily-reward'`,
      ).run(),
    ).rejects.toThrow('last_login_reward_at must be a canonical ISO timestamp');
  });
});
