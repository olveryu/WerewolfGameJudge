/** Submission capacity is independent of model budgets and automatic supply switches. */
import {
  WORD_SUBMISSION_DAILY_LIMIT,
  WORD_SUBMISSION_PENDING_LIMIT,
} from '@game-judge/game-engine/product/wordSupply';
import { z } from 'zod';

import {
  EDITORIAL_DAILY_REQUEST_LIMIT,
  EDITORIAL_MONTHLY_REQUEST_LIMIT,
} from '../../platform/ai/editorialBudget';

/** Counters are transactionally maintained; model history is read through its time index. */
export async function readSubmissionSettings(db: D1Database) {
  const now = new Date();
  const rows = await db.batch([
    db.prepare(`SELECT accepting, pending_count, submission_day, submitted_today,
      awaiting_review_count, awaiting_publication_count, failed_count, published_count
      FROM word_submission_limits WHERE id = 1`),
    db
      .prepare(
        `SELECT
      SUM(claimed_at > ?) AS daily, COUNT(*) AS monthly
      FROM editorial_model_requests WHERE claimed_at > ?`,
      )
      .bind(
        new Date(now.getTime() - 86_400_000).toISOString(),
        new Date(now.getTime() - 30 * 86_400_000).toISOString(),
      ),
  ]);
  const settings = z
    .strictObject({
      accepting: z.union([z.literal(0), z.literal(1)]),
      pending_count: z.int().nonnegative(),
      submission_day: z.string(),
      submitted_today: z.int().nonnegative(),
      awaiting_review_count: z.int().nonnegative(),
      awaiting_publication_count: z.int().nonnegative(),
      failed_count: z.int().nonnegative(),
      published_count: z.int().nonnegative(),
    })
    .parse(rows[0]?.results[0]);
  const budget = z
    .strictObject({
      daily: z.int().nonnegative().nullable(),
      monthly: z.int().nonnegative(),
    })
    .parse(rows[1]?.results[0]);
  return {
    accepting: settings.accepting === 1,
    pending: settings.pending_count,
    pendingLimit: WORD_SUBMISSION_PENDING_LIMIT,
    submittedToday:
      settings.submission_day === now.toISOString().slice(0, 10) ? settings.submitted_today : 0,
    awaitingReview: settings.awaiting_review_count,
    awaitingPublication: settings.awaiting_publication_count,
    failed: settings.failed_count,
    published: settings.published_count,
    dailyLimit: WORD_SUBMISSION_DAILY_LIMIT,
    modelBudget: {
      dailyUsed: budget.daily ?? 0,
      dailyLimit: EDITORIAL_DAILY_REQUEST_LIMIT,
      monthlyUsed: budget.monthly,
      monthlyLimit: EDITORIAL_MONTHLY_REQUEST_LIMIT,
    },
  };
}
