import { env } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { queryD1Insights } from '../providers/d1Insights';
import { adminRoutes } from '../routes';

describe('D1 query insights', () => {
  it('protects official Tavily usage and surfaces provider failures without raw responses', async () => {
    const fetchImpl = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('private provider response', { status: 401 }));
    try {
      expect((await adminRoutes.request('/tavily-usage', {}, env)).status).toBe(401);
      expect(fetchImpl).not.toHaveBeenCalled();
      const response = await adminRoutes.request(
        '/tavily-usage',
        { headers: { 'X-Admin-Token': env.ADMIN_PASSWORD } },
        { ...env, TAVILY_API_KEY: 'usage-test-key' },
      );
      expect(response.status).toBe(502);
      expect(await response.text()).toBe('TAVILY_USAGE_QUERY_FAILED');
      expect(fetchImpl).toHaveBeenCalledOnce();
    } finally {
      fetchImpl.mockRestore();
    }
  });
  it('uses bounded parameterized queries, labels estimates and never returns SQL', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      if (typeof init?.body !== 'string') throw new Error('Expected request body');
      const request = z
        .strictObject({
          query: z.string(),
          scope: z.strictObject({ accountTag: z.string() }),
          params: z.strictObject({ from: z.string(), to: z.string() }),
        })
        .parse(JSON.parse(init.body));
      expect(request.params.from).toBe('2026-11-12T00:00:00.000Z');
      expect(request.params.to).toBe('2026-11-12T12:00:00.000Z');
      expect(request.scope.accountTag).toBe(env.CLOUDFLARE_ACCOUNT_ID);
      expect(request.query).not.toContain('sampleInterval');
      if (request.query.includes('GROUP BY databaseId')) {
        expect(request.query).toContain('ORDER BY writes DESC LIMIT 20');
        return Response.json({
          data: [
            {
              databaseId: 'db',
              query: "SELECT * FROM drawguess_words WHERE word = 'private value'",
              reads: '120',
              writes: '4',
              count: '2',
            },
          ],
        });
      }
      expect(request.query).toContain('toStartOfHour');
      return Response.json({ data: [{ bucket: '2026-11-12T08:00:00Z', reads: 120, writes: 4 }] });
    });
    const result = await queryD1Insights(
      env,
      'today',
      'writes',
      new Date('2026-11-12T12:00:00Z'),
      fetchImpl,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.queries[0]).toMatchObject({
      label: '可能涉及：你画我猜词库',
      reads: 120,
      writes: 4,
      count: 2,
    });
    expect(result.queries[0]?.id).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(result)).not.toContain('private value');
    expect(result.series[0]).toEqual({ timestamp: '2026-11-12T08:00:00Z', reads: 120, writes: 4 });
  });

  it('rejects invalid provider data rather than reporting no usage', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: [{ reads: -1 }] }));
    await expect(queryD1Insights(env, '7d', 'reads', new Date(), fetchImpl)).rejects.toThrow(
      'D1_INSIGHTS_QUERY_FAILED',
    );
  });

  it.each([
    {
      query: 'SELECT * FROM word_submission_items',
      label: '可能涉及：词条投稿',
    },
    {
      query: 'SELECT * FROM room_participants p JOIN USERS u ON u.id = p.user_id',
      label: '可能涉及：房间参与记录、用户',
    },
    {
      query: 'UPDATE OR IGNORE "main".`user_stats` SET level = 1',
      label: '可能涉及：用户成长',
    },
    {
      query: 'REPLACE INTO [drawguess_words] (id) VALUES (?)',
      label: '可能涉及：你画我猜词库',
    },
    {
      query: 'DELETE FROM refresh_tokens WHERE token = ?',
      label: '可能涉及：账号认证',
    },
    {
      query: 'SELECT * FROM refresh_tokens JOIN refresh_token_rotations USING (token)',
      label: '可能涉及：账号认证',
    },
    {
      query:
        "/* FROM users */ SELECT 'JOIN rooms' FROM /* comment */ word_submission_batches -- JOIN users",
      label: '可能涉及：词条投稿批次',
    },
    {
      query: "SELECT 'private value '' FROM users', \"JOIN rooms\" FROM private_table AS users",
      label: undefined,
    },
    {
      query: 'SELECT users FROM users_private',
      label: undefined,
    },
    {
      query: 'WITH users AS (SELECT * FROM private_table) SELECT * FROM users',
      label: undefined,
    },
    {
      query: 'SELECT * FROM private_schema.users',
      label: undefined,
    },
    {
      query: 'SELECT * FROM users(?)',
      label: undefined,
    },
    {
      query: 'SELECT * FROM sqlite_master',
      label: undefined,
    },
  ])('classifies only allowlisted table references: $query', async ({ query, label }) => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      if (typeof init?.body !== 'string') throw new Error('Expected request body');
      const request = z
        .strictObject({
          query: z.string(),
          scope: z.strictObject({ accountTag: z.string() }),
          params: z.strictObject({ from: z.string(), to: z.string() }),
        })
        .parse(JSON.parse(init.body));
      return Response.json({
        data: request.query.includes('GROUP BY databaseId')
          ? [{ databaseId: 'db', query, reads: 120, writes: 4, count: 2 }]
          : [],
      });
    });
    const result = await queryD1Insights(env, 'today', 'reads', new Date(), fetchImpl);
    const row = result.queries[0];
    expect(row?.id).toMatch(/^[a-f0-9]{64}$/);
    expect(row).toEqual({
      id: row?.id,
      label: label ?? `未归类查询 · ${row?.id.slice(0, 12)}`,
      reads: 120,
      writes: 4,
      count: 2,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(result)).not.toContain(query);
    expect(JSON.stringify(result)).not.toContain('private');
  });

  it('distinguishes no samples from a provider failure', async () => {
    const empty = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ data: [] }));
    const result = await queryD1Insights(env, '24h', 'reads', new Date(), empty);
    expect(result.queries).toEqual([]);
    expect(result.series).toEqual([]);
    const denied = vi.fn<typeof fetch>().mockResolvedValue(new Response('denied', { status: 403 }));
    await expect(queryD1Insights(env, 'today', 'reads', new Date(), denied)).rejects.toThrow(
      'D1_INSIGHTS_QUERY_FAILED',
    );
  });

  it('limits ranking to a selected bucket while keeping the full trend range', async () => {
    const calls: Array<{ query: string; from: string; to: string }> = [];
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      if (typeof init?.body !== 'string') throw new Error('Expected request body');
      const request = z
        .strictObject({
          query: z.string(),
          scope: z.strictObject({ accountTag: z.string() }),
          params: z.strictObject({ from: z.string(), to: z.string() }),
        })
        .parse(JSON.parse(init.body));
      calls.push({ query: request.query, ...request.params });
      return Response.json({ data: [] });
    });
    await queryD1Insights(
      env,
      'today',
      'reads',
      new Date('2026-11-12T12:30:00Z'),
      fetchImpl,
      new Date('2026-11-12T08:00:00Z'),
    );
    expect(calls.find((call) => call.query.includes('GROUP BY databaseId'))).toMatchObject({
      from: '2026-11-12T08:00:00.000Z',
      to: '2026-11-12T09:00:00.000Z',
    });
    expect(calls.find((call) => call.query.includes('GROUP BY bucket'))).toMatchObject({
      from: '2026-11-12T00:00:00.000Z',
      to: '2026-11-12T12:30:00.000Z',
    });
    await expect(
      queryD1Insights(
        env,
        'today',
        'reads',
        new Date('2026-11-12T12:30:00Z'),
        fetchImpl,
        new Date('2026-11-12T08:15:00Z'),
      ),
    ).rejects.toThrow('INVALID_TIME_BUCKET');
  });

  it('requires admin authentication and validates both controls before contacting Cloudflare', async () => {
    expect((await adminRoutes.request('/d1-insights?range=today&sort=reads', {}, env)).status).toBe(
      401,
    );
    const headers = { 'X-Admin-Token': env.ADMIN_PASSWORD };
    expect(
      (await adminRoutes.request('/d1-insights?range=30d&sort=reads', { headers }, env)).status,
    ).toBe(400);
    expect(
      (await adminRoutes.request('/d1-insights?range=today&sort=bad', { headers }, env)).status,
    ).toBe(400);
  });
});
