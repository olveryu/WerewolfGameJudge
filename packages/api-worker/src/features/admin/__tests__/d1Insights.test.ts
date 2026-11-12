import { env } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { queryD1Insights } from '../providers/d1Insights';
import { adminRoutes } from '../routes';

describe('D1 query insights', () => {
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
