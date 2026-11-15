/** The editorial model log records every call; there is no ceiling. */
import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import { claimEditorialModelRequest, readModelBudgetByOperation } from '../editorialBudget';

describe('editorial request log', () => {
  it('records every claim exactly once and rejects a repeated id', async () => {
    await env.DB.prepare('DELETE FROM editorial_model_requests').run();
    const now = Date.parse('2026-09-22T12:00:00Z');
    await claimEditorialModelRequest(env.DB, 'gen-1', 'fibking', 'model', 'generation', now);
    await claimEditorialModelRequest(env.DB, 'rev-1', 'undercover', 'model', 'review', now);
    await expect(
      claimEditorialModelRequest(env.DB, 'gen-1', 'fibking', 'model', 'generation', now),
    ).rejects.toThrow('already consumed');
    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM editorial_model_requests').first<{
      n: number;
    }>();
    expect(count?.n).toBe(2);
  });

  it('never blocks on volume: concurrent claims all record', async () => {
    await env.DB.prepare('DELETE FROM editorial_model_requests').run();
    const now = Date.parse('2026-09-21T12:00:00Z');
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, index) =>
        claimEditorialModelRequest(
          env.DB,
          `request-${index}`,
          index % 2 === 0 ? 'fibking' : 'undercover',
          'model',
          'generation',
          now,
        ),
      ),
    );
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(10);
  });

  it('splits usage into generation and review without changing the totals', async () => {
    await env.DB.prepare('DELETE FROM editorial_model_requests').run();
    const now = Date.parse('2026-09-22T12:00:00Z');
    await claimEditorialModelRequest(env.DB, 'gen-1', 'fibking', 'model', 'generation', now);
    await claimEditorialModelRequest(env.DB, 'gen-2', 'fibking', 'model', 'generation', now);
    await claimEditorialModelRequest(env.DB, 'rev-1', 'undercover', 'model', 'review', now);
    const byOperation = await readModelBudgetByOperation(env.DB, now);
    expect(byOperation).toEqual({
      generation: { dailyUsed: 2, monthlyUsed: 2 },
      review: { dailyUsed: 1, monthlyUsed: 1 },
    });
    // The split is a partition of the same log, not a second budget.
    expect(byOperation.generation.dailyUsed + byOperation.review.dailyUsed).toBe(3);
    expect(byOperation.generation.monthlyUsed + byOperation.review.monthlyUsed).toBe(3);
    const stored = await env.DB.prepare(
      "SELECT operation FROM editorial_model_requests WHERE id = 'rev-1'",
    ).first<{ operation: string }>();
    expect(stored?.operation).toBe('review');
  });

  it('counts only the rolling daily and monthly windows', async () => {
    await env.DB.prepare('DELETE FROM editorial_model_requests').run();
    const now = Date.parse('2026-09-22T12:00:00Z');
    const day = 24 * 60 * 60 * 1000;
    // A request 31 days old is outside both windows; one 25 days old is
    // inside the monthly window only; one an hour ago is inside both.
    for (const [id, age] of [
      ['old', 31 * day],
      ['month-only', 25 * day],
      ['recent', 60 * 60 * 1000],
    ] as const) {
      await env.DB.prepare(
        `INSERT INTO editorial_model_requests (id, owner, model, operation, claimed_at)
         VALUES (?, 'test', 'model', 'generation', ?)`,
      )
        .bind(id, new Date(now - age).toISOString())
        .run();
    }
    const byOperation = await readModelBudgetByOperation(env.DB, now);
    expect(byOperation.generation).toEqual({ dailyUsed: 1, monthlyUsed: 2 });
    expect(byOperation.review).toEqual({ dailyUsed: 0, monthlyUsed: 0 });
  });
});
