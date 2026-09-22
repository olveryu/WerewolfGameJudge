/** D1 serializes the shared editorial ceiling across independent game owners. */
import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import { claimEditorialModelRequest, EDITORIAL_DAILY_REQUEST_LIMIT } from '../editorialBudget';

describe('editorial request budget', () => {
  it('limits concurrent cross-game requests and never refunds uncertain calls', async () => {
    await env.DB.prepare('DELETE FROM editorial_model_requests').run();
    const now = Date.parse('2026-09-21T12:00:00Z');
    const results = await Promise.allSettled(
      Array.from({ length: EDITORIAL_DAILY_REQUEST_LIMIT + 2 }, (_, index) =>
        claimEditorialModelRequest(
          env.DB,
          `request-${index}`,
          index % 2 === 0 ? 'fibking' : 'undercover',
          'model',
          now,
        ),
      ),
    );
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(
      EDITORIAL_DAILY_REQUEST_LIMIT,
    );
    await expect(
      claimEditorialModelRequest(env.DB, 'request-0', 'fibking', 'model', now),
    ).rejects.toThrow('consumed or shared budget');
  });
});
