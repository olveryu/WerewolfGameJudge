/** Real D1 row-read budgets and cursor correctness, not mocked query plans. */
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { createRowCountingDb } from '../../../../test/rowCountingDb';
import { queryGrowthStats } from '../growthStats';
import { adminRoutes } from '../routes';
import { queryUserCountries, queryUserDirectory } from '../userDirectory';

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM users WHERE id LIKE 'budget-%' OR id = 'without-stats'").run();
});

async function seedUsers(start: number, end: number) {
  await env.DB.prepare(
    `
    WITH RECURSIVE n(i) AS (SELECT ? UNION ALL SELECT i + 1 FROM n WHERE i < ?)
    INSERT INTO users (id, email, display_name, is_anonymous, last_country, last_colo, created_at, updated_at)
    SELECT printf('budget-%05d', i), printf('budget-%05d@example.com', i), 'Budget user', 0,
      'CN', CASE WHEN i % 2 = 0 THEN 'HKG' ELSE NULL END,
      '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z' FROM n
  `,
  )
    .bind(start, end)
    .run();
  await env.DB.prepare(
    `
    INSERT INTO user_stats (user_id, level, games_played, updated_at)
    SELECT id, 2, 10, updated_at FROM users WHERE id LIKE 'budget-%'
    ON CONFLICT(user_id) DO NOTHING
  `,
  ).run();
}

describe('admin indexed read budgets', () => {
  it('lists every populated country with bounded index seeks as user counts grow tenfold', async () => {
    expect(await queryUserCountries(env.DB)).toEqual({ countries: [] });
    await seedUsers(1, 500);
    await env.DB.prepare(
      `UPDATE users SET last_country = CASE id
        WHEN 'budget-00001' THEN 'JP' WHEN 'budget-00002' THEN 'US'
        WHEN 'budget-00003' THEN NULL WHEN 'budget-00004' THEN ''
        WHEN 'budget-00005' THEN 'invalid' ELSE last_country END`,
    ).run();
    const measured = createRowCountingDb(env.DB);
    expect(await queryUserCountries(measured.db)).toEqual({ countries: ['CN', 'JP', 'US'] });
    const smallReads = measured.counts.rowsRead;
    expect(smallReads).toBeGreaterThan(0);
    expect(smallReads).toBeLessThanOrEqual(16);
    await seedUsers(501, 5000);
    measured.reset();
    expect(await queryUserCountries(measured.db)).toEqual({ countries: ['CN', 'JP', 'US'] });
    expect(measured.counts.rowsRead).toBe(smallReads);
    expect(
      (await queryUserDirectory(env.DB, { country: 'JP' })).users.map((user) => user.id),
    ).toEqual(['budget-00001']);
    const response = await adminRoutes.request(
      '/users/countries',
      {
        headers: { 'X-Admin-Token': env.ADMIN_PASSWORD },
      },
      env,
    );
    expect(await response.json()).toEqual({ countries: ['CN', 'JP', 'US'] });
    expect((await adminRoutes.request('/users/countries', {}, env)).status).toBe(401);
  });

  it('keeps every sort and third-page seek bounded as the directory grows tenfold', async () => {
    await seedUsers(1, 500);
    const measured = createRowCountingDb(env.DB);
    const measurements = new Map<string, number>();
    for (const size of [500, 5000]) {
      if (size === 5000) await seedUsers(501, 5000);
      for (const sort of ['created_at', 'updated_at', 'level', 'games_played']) {
        for (const order of ['asc', 'desc']) {
          let cursor: string | null = null;
          const seen = new Set<string>();
          for (let page = 1; page <= 3; page += 1) {
            measured.reset();
            const result = await queryUserDirectory(measured.db, {
              sort,
              order,
              ...(cursor === null ? {} : { cursor }),
            });
            expect(result.users).toHaveLength(50);
            expect(measured.counts.rowsRead).toBeLessThanOrEqual(4 * 51 + 8);
            for (const user of result.users) {
              expect(seen.has(user.id)).toBe(false);
              seen.add(user.id);
            }
            const key = `${sort}:${order}:${page}`;
            if (size === 500) measurements.set(key, measured.counts.rowsRead);
            else expect(measured.counts.rowsRead).toBe(measurements.get(key));
            cursor = result.nextCursor;
            expect(cursor).not.toBeNull();
          }
        }
      }
    }
    measured.reset();
    const email = await queryUserDirectory(measured.db, { q: 'budget-00001@example.com' });
    expect(email.users.map((user) => user.id)).toEqual(['budget-00001']);
    expect(measured.counts.rowsRead).toBeLessThanOrEqual(8);
    measured.reset();
    const mixedCaseEmail = await queryUserDirectory(measured.db, {
      q: 'BUDGET-00001@EXAMPLE.COM',
    });
    expect(mixedCaseEmail.users.map((user) => user.id)).toEqual(['budget-00001']);
    expect(measured.counts.rowsRead).toBeLessThanOrEqual(8);
  });

  it('does not read out-of-range users when computing growth and preserves null distributions', async () => {
    await seedUsers(1, 500);
    await env.DB.prepare(
      `
      UPDATE users SET created_at = '2026-11-11 00:00:00', updated_at = '2026-11-11 00:00:00'
      WHERE id IN ('budget-00001', 'budget-00002')
    `,
    ).run();
    const measured = createRowCountingDb(env.DB);
    const small = await queryGrowthStats(
      measured.db,
      '2026-11-11T00:00:00.000Z',
      '2026-11-12T00:00:00.000Z',
    );
    const smallReads = measured.counts.rowsRead;
    await seedUsers(501, 5000);
    measured.reset();
    expect(
      await queryGrowthStats(measured.db, '2026-11-11T00:00:00.000Z', '2026-11-12T00:00:00.000Z'),
    ).toEqual(small);
    expect(measured.counts.rowsRead).toBe(smallReads);
    expect(small).toEqual({
      registered: 2,
      active: 2,
      totalGames: 20,
      countries: [{ country: 'CN', count: 2 }],
      colos: [{ colo: 'HKG', count: 1 }],
    });
  });

  it('rejects malformed or cross-filter cursors and distinguishes exact email from literal nickname searches', async () => {
    await seedUsers(1, 100);
    const first = await queryUserDirectory(env.DB, {});
    await expect(queryUserDirectory(env.DB, { cursor: 'not-base64' })).rejects.toThrow(
      'INVALID_ADMIN_CURSOR',
    );
    await expect(queryUserDirectory(env.DB, { sort: 'not-a-sort' })).rejects.toThrow(
      'INVALID_ADMIN_USER_QUERY',
    );
    if (first.nextCursor === null) throw new Error('Expected a second page');
    await expect(
      queryUserDirectory(env.DB, { cursor: first.nextCursor, order: 'asc' }),
    ).rejects.toThrow('INVALID_ADMIN_CURSOR');
    expect((await queryUserDirectory(env.DB, { q: '%' })).users).toEqual([]);
    await env.DB.prepare(
      "INSERT INTO users (id, display_name, created_at, updated_at) VALUES ('without-stats', 'No stats', '2026-12-01', '2026-12-01')",
    ).run();
    expect((await queryUserDirectory(env.DB, {})).users[0]?.id).toBe('without-stats');
    expect(
      (await queryUserDirectory(env.DB, { sort: 'level' })).users.some(
        (user) => user.id === 'without-stats',
      ),
    ).toBe(false);
  });

  it('validates a session without reading or writing D1 and still requires the token', async () => {
    const measured = createRowCountingDb(env.DB);
    const bindings = { ...env, DB: measured.db };
    const response = await adminRoutes.request(
      '/session',
      {
        headers: { 'X-Admin-Token': env.ADMIN_PASSWORD },
      },
      bindings,
    );
    expect(response.status).toBe(204);
    expect(measured.counts).toEqual({ rowsRead: 0, rowsWritten: 0 });
    expect((await adminRoutes.request('/session', {}, bindings)).status).toBe(401);
  });
});
