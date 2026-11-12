/** Account-wide analytics stays available without issuing any D1 query. */
import { env } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { queryD1UsageAnalytics } from '../providers/workerAnalytics';

function envelope(groups: unknown[]) {
  return { data: { viewer: { accounts: [{ d1AnalyticsAdaptiveGroups: groups }] } }, errors: null };
}

describe('D1 usage analytics', () => {
  it('uses the UTC date and account scope, summing read and write counts', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json(
          envelope([
            { sum: { rowsRead: 140, rowsWritten: 20 } },
            { sum: { rowsRead: 60, rowsWritten: 3 } },
          ]),
        ),
      );
    const result = await queryD1UsageAnalytics(env, new Date('2026-11-12T00:01:00Z'), fetchImpl);
    expect(result).toMatchObject({
      day: '2026-11-12',
      rowsRead: 200,
      rowsWritten: 23,
      rowsReadLimit: 5_000_000,
      rowsWrittenLimit: 100_000,
    });
    const requestBody = fetchImpl.mock.calls[0]?.[1]?.body;
    if (typeof requestBody !== 'string') throw new Error('Expected a JSON request body');
    const body = z
      .strictObject({ query: z.string(), variables: z.record(z.string(), z.string()) })
      .parse(JSON.parse(requestBody));
    expect(body.variables).toEqual({ accountTag: env.CLOUDFLARE_ACCOUNT_ID, day: '2026-11-12' });
    expect(body.query).not.toContain('databaseId');
  });

  it('reports zero for a valid account with no activity', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json(envelope([])));
    expect(await queryD1UsageAnalytics(env, new Date(), fetchImpl)).toMatchObject({
      rowsRead: 0,
      rowsWritten: 0,
    });
  });

  it.each([
    { errors: [{ message: 'denied' }] },
    { data: { viewer: { accounts: [] } } },
    envelope([{ sum: { rowsRead: -1, rowsWritten: 0 } }]),
  ])('fails explicitly for provider errors and invalid data', async (body) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json(body));
    await expect(queryD1UsageAnalytics(env, new Date(), fetchImpl)).rejects.toThrow(
      'D1_ANALYTICS_QUERY_FAILED',
    );
  });

  it.each(['transport', 'http', 'json'])(
    'surfaces %s failures as a D1 analytics failure',
    async (failure) => {
      const fetchImpl = vi.fn<typeof fetch>();
      if (failure === 'transport') fetchImpl.mockRejectedValue(new Error('offline'));
      else
        fetchImpl.mockResolvedValue(
          new Response('not json', { status: failure === 'http' ? 403 : 200 }),
        );
      await expect(queryD1UsageAnalytics(env, new Date(), fetchImpl)).rejects.toThrow(
        'D1_ANALYTICS_QUERY_FAILED',
      );
    },
  );
});
