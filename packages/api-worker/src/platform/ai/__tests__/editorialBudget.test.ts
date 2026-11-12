/** D1 serializes the shared editorial ceiling across independent game owners. */
import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import { createRowCountingDb } from '../../../../test/rowCountingDb';
import {
  claimEditorialModelRequest,
  EDITORIAL_DAILY_REQUEST_LIMIT,
  EDITORIAL_MONTHLY_REQUEST_LIMIT,
  isEditorialBudgetAvailable,
} from '../editorialBudget';

describe('editorial request budget', () => {
  it('checks both rolling limits with bounded reads and allows expired requests', async () => {
    await env.DB.prepare('DELETE FROM editorial_model_requests').run();
    const now = Date.parse('2026-09-22T12:00:00Z');
    const older = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 500)
       INSERT INTO editorial_model_requests (id, owner, model, claimed_at)
       SELECT 'old-' || i, 'test', 'model', ? FROM n`,
    )
      .bind(older)
      .run();
    const measured = createRowCountingDb(env.DB);
    expect(await isEditorialBudgetAvailable(measured.db, now)).toBe(false);
    expect(measured.counts.rowsRead).toBeLessThanOrEqual(EDITORIAL_MONTHLY_REQUEST_LIMIT + 10);
    await expect(
      claimEditorialModelRequest(measured.db, 'blocked-month', 'test', 'model', now),
    ).rejects.toThrow('consumed or shared budget');
    await env.DB.prepare(
      "UPDATE editorial_model_requests SET claimed_at = '2026-01-01T00:00:00.000Z'",
    ).run();
    expect(await isEditorialBudgetAvailable(env.DB, now)).toBe(true);
    for (let index = 0; index < EDITORIAL_DAILY_REQUEST_LIMIT; index += 1)
      await claimEditorialModelRequest(env.DB, `daily-${index}`, 'test', 'model', now);
    expect(await isEditorialBudgetAvailable(env.DB, now)).toBe(false);
  });

  it('excludes requests exactly at each rolling boundary', async () => {
    await env.DB.prepare('DELETE FROM editorial_model_requests').run();
    const now = Date.parse('2026-09-22T12:00:00Z');
    const day = 24 * 60 * 60 * 1000;
    for (const [label, count, age] of [
      ['day', EDITORIAL_DAILY_REQUEST_LIMIT, day],
      ['month', EDITORIAL_MONTHLY_REQUEST_LIMIT, 30 * day],
    ] as const) {
      await env.DB.prepare('DELETE FROM editorial_model_requests').run();
      await env.DB.prepare(
        `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ?)
         INSERT INTO editorial_model_requests (id, owner, model, claimed_at)
         SELECT ? || i, 'test', 'model', ? FROM n`,
      )
        .bind(count, label, new Date(now - age).toISOString())
        .run();
      expect(await isEditorialBudgetAvailable(env.DB, now)).toBe(true);
      expect(await isEditorialBudgetAvailable(env.DB, now - 1)).toBe(false);
    }
  });

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
