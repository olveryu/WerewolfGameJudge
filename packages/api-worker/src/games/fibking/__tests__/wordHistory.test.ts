import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { FIB_WORD_HISTORY_LIMIT, readRecentFibWords, recordFibWordExposure } from '../wordHistory';

const USER_A = 'fib-word-history-a';
const USER_B = 'fib-word-history-b';

async function insertUser(userId: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO users (id, is_anonymous, created_at, updated_at)
     VALUES (?, 1, ?, ?)`,
  )
    .bind(userId, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')
    .run();
}

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM users WHERE id IN (?, ?)').bind(USER_A, USER_B).run();
  await insertUser(USER_A);
  await insertUser(USER_B);
});

describe('Fib word history', () => {
  it('returns the recent-word union for all current human participants', async () => {
    await recordFibWordExposure(
      env.DB,
      [USER_A, 'deleted-fib-user'],
      '阒寂',
      '2026-01-01T00:00:00.000Z',
    );
    await recordFibWordExposure(env.DB, [USER_B], '倥偬', '2026-01-02T00:00:00.000Z');

    await expect(readRecentFibWords(env.DB, [USER_A, USER_B])).resolves.toEqual(['倥偬', '阒寂']);
  });

  it('upserts repeated exposure and caps each user history independently', async () => {
    await env.DB.prepare(
      `WITH RECURSIVE sequence(value) AS (
         SELECT 0
         UNION ALL
         SELECT value + 1 FROM sequence WHERE value < ?
       )
       INSERT INTO fib_word_exposures (user_id, word, last_seen_at)
       SELECT ?, '词' || printf('%03d', value), printf('2025-01-01T00:%03d:00.000Z', value)
       FROM sequence`,
    )
      .bind(FIB_WORD_HISTORY_LIMIT, USER_A)
      .run();

    await recordFibWordExposure(env.DB, [USER_A], '菡萏', '2026-01-03T00:00:00.000Z');
    await recordFibWordExposure(env.DB, [USER_A], '菡萏', '2026-01-04T00:00:00.000Z');

    const count = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM fib_word_exposures WHERE user_id = ?',
    )
      .bind(USER_A)
      .first<{ count: number }>();
    expect(count).toEqual({ count: FIB_WORD_HISTORY_LIMIT });
    expect((await readRecentFibWords(env.DB, [USER_A]))[0]).toBe('菡萏');
    await expect(readRecentFibWords(env.DB, [USER_B])).resolves.toEqual([]);
  });
});
