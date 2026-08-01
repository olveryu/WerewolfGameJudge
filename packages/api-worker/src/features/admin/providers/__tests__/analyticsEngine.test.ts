/** Analytics Engine SQL response boundary tests. */

import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import { queryAIUsageAnalytics, queryLoadTimingAnalytics } from '../analyticsEngine';

describe('Analytics Engine provider', () => {
  it('parses documented JSON envelopes and normalizes numeric columns', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          meta: [],
          data: [
            {
              country: 'US',
              colo: 'IAD',
              isp: 'Example ISP',
              cnt: '3',
              avg_load_ms: 120.5,
              avg_ttfb_ms: '40.25',
            },
          ],
          rows: 1,
        }),
        { status: 200 },
      );

    await expect(queryLoadTimingAnalytics(env, 'SELECT 1', fetchImpl)).resolves.toEqual([
      {
        country: 'US',
        colo: 'IAD',
        isp: 'Example ISP',
        cnt: 3,
        avg_load_ms: 120.5,
        avg_ttfb_ms: 40.25,
      },
    ]);
  });

  it('rejects malformed successful responses as provider failures', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ data: [{ userId: 'user-with-missing-columns' }] }), {
        status: 200,
      });

    await expect(queryAIUsageAnalytics(env, 'SELECT 1', fetchImpl)).rejects.toThrow(
      'AI_USAGE_QUERY_FAILED',
    );
  });

  it.each([' ', '0x10', 'Infinity'])('rejects non-decimal numeric text %j', async (cnt) => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              country: 'US',
              colo: 'IAD',
              isp: 'Example ISP',
              cnt,
              avg_load_ms: '1',
              avg_ttfb_ms: '1',
            },
          ],
        }),
        { status: 200 },
      );

    await expect(queryLoadTimingAnalytics(env, 'SELECT 1', fetchImpl)).rejects.toThrow(
      'ANALYTICS_QUERY_FAILED',
    );
  });

  it('preserves the provider failure code for non-success responses', async () => {
    const fetchImpl: typeof fetch = async () => new Response('unavailable', { status: 503 });

    await expect(queryLoadTimingAnalytics(env, 'SELECT 1', fetchImpl)).rejects.toThrow(
      'ANALYTICS_QUERY_FAILED',
    );
  });
});
