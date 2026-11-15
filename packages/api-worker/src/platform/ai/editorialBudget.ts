/** Usage log for editorial model calls; there is no ceiling. Generation and
 * review are both triggered manually by an administrator, so the admin is
 * the rate limiter — a shared cap would only block manual work. */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Generation and review share one log; the split is display-only. */
export type EditorialModelOperation = 'generation' | 'review';

/** Split usage by operation (generation vs review); display-only. */
export async function readModelBudgetByOperation(
  db: D1Database,
  nowMs = Date.now(),
): Promise<{
  generation: { dailyUsed: number; monthlyUsed: number };
  review: { dailyUsed: number; monthlyUsed: number };
}> {
  const rows = await db
    .prepare(
      `SELECT operation, SUM(claimed_at > ?) AS daily, COUNT(*) AS monthly
       FROM editorial_model_requests WHERE claimed_at > ? GROUP BY operation`,
    )
    .bind(new Date(nowMs - DAY_MS).toISOString(), new Date(nowMs - 30 * DAY_MS).toISOString())
    .all<{ operation: string; daily: number | null; monthly: number }>();
  const byOperation = {
    generation: { dailyUsed: 0, monthlyUsed: 0 },
    review: { dailyUsed: 0, monthlyUsed: 0 },
  };
  for (const row of rows.results ?? []) {
    if (row.operation === 'generation' || row.operation === 'review')
      byOperation[row.operation] = { dailyUsed: row.daily ?? 0, monthlyUsed: row.monthly };
  }
  return byOperation;
}

/** Record a model call before the HTTP request; uncertain operations are
 * never automatically charged and sent twice. Recording never blocks. */
export async function claimEditorialModelRequest(
  db: D1Database,
  id: string,
  owner: string,
  model: string,
  operation: EditorialModelOperation,
  nowMs = Date.now(),
): Promise<void> {
  const claimedAt = new Date(nowMs).toISOString();
  const row = await db
    .prepare(
      `INSERT INTO editorial_model_requests (id, owner, model, operation, claimed_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (id) DO NOTHING RETURNING id`,
    )
    .bind(id, owner, model, operation, claimedAt)
    .first();
  if (row === null) throw new Error('Editorial model request already consumed');
}
