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

  it('lets force claims bypass the shared budget but keeps the idempotency ledger', async () => {
    await env.DB.prepare('DELETE FROM editorial_model_requests').run();
    const now = Date.parse('2026-09-22T12:00:00Z');
    for (let index = 0; index < EDITORIAL_DAILY_REQUEST_LIMIT; index += 1) {
      await claimEditorialModelRequest(env.DB, `fill-${index}`, 'fibking', 'model', now);
    }
    await expect(
      claimEditorialModelRequest(env.DB, 'blocked', 'undercover', 'model', now),
    ).rejects.toThrow('consumed or shared budget');
    // Force exceeds the budget but still records the claim exactly once.
    await claimEditorialModelRequest(env.DB, 'forced-1', 'undercover', 'model', now, {
      force: true,
    });
    // A repeated force claim for the same id is still rejected: the ledger stays idempotent.
    await expect(
      claimEditorialModelRequest(env.DB, 'forced-1', 'undercover', 'model', now, {
        force: true,
      }),
    ).rejects.toThrow('already consumed');
    const count = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM editorial_model_requests WHERE id = 'forced-1'",
    ).first<{ n: number }>();
    expect(count?.n).toBe(1);
  });
});
