/** Cloudflare Workers GraphQL response boundary tests. */

import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import { queryWorkerInvocationAnalytics } from '../workerAnalytics';

describe('Workers Analytics provider', () => {
  it('sums all invocation groups and sends configured account and script variables', async () => {
    let requestBody: unknown;
    const fetchImpl: typeof fetch = async (_input, init) => {
      if (typeof init?.body !== 'string') throw new Error('Expected a JSON string request body');
      requestBody = JSON.parse(init.body) as unknown;
      return new Response(
        JSON.stringify({
          data: {
            viewer: {
              accounts: [
                {
                  workersInvocationsAdaptive: [
                    { sum: { requests: 10, errors: 1, subrequests: 4 } },
                    { sum: { requests: 5, errors: 0, subrequests: 2 } },
                  ],
                },
              ],
            },
          },
          errors: null,
        }),
        { status: 200 },
      );
    };

    await expect(
      queryWorkerInvocationAnalytics(
        env,
        '2026-08-31T00:00:00.000Z',
        '2026-08-31T01:00:00.000Z',
        fetchImpl,
      ),
    ).resolves.toEqual({ requests: 15, errors: 1, subrequests: 6 });
    expect(requestBody).toMatchObject({
      variables: {
        accountTag: 'test-cloudflare-account',
        scriptName: 'werewolf-api',
      },
    });
  });

  it('rejects GraphQL errors returned with HTTP 200', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          data: { viewer: { accounts: [] } },
          errors: [{ message: 'query rejected' }],
        }),
        { status: 200 },
      );

    await expect(
      queryWorkerInvocationAnalytics(
        env,
        '2026-08-31T00:00:00Z',
        '2026-08-31T01:00:00Z',
        fetchImpl,
      ),
    ).rejects.toThrow('WORKER_ANALYTICS_QUERY_FAILED');
  });

  it('normalizes network failures into the provider failure code', async () => {
    const fetchImpl: typeof fetch = () => Promise.reject(new Error('network unavailable'));

    await expect(
      queryWorkerInvocationAnalytics(
        env,
        '2026-08-31T00:00:00Z',
        '2026-08-31T01:00:00Z',
        fetchImpl,
      ),
    ).rejects.toThrow('WORKER_ANALYTICS_QUERY_FAILED');
  });
});
