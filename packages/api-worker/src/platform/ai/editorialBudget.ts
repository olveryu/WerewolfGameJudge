/** Shared application ceilings for editorial model calls, not a claim about provider quotas. */

export const EDITORIAL_DAILY_REQUEST_LIMIT = 8;
export const EDITORIAL_MONTHLY_REQUEST_LIMIT = 120;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Generation and review share one budget; the split is display-only. */
export type EditorialModelOperation = 'generation' | 'review';

const BUDGET_AVAILABLE_SQL = `NOT EXISTS (
  SELECT 1 FROM editorial_model_requests WHERE claimed_at > ? LIMIT 1 OFFSET ?
) AND NOT EXISTS (
  SELECT 1 FROM editorial_model_requests WHERE claimed_at > ? LIMIT 1 OFFSET ?
)`;

function budgetBindings(nowMs: number): [string, number, string, number] {
  return [
    new Date(nowMs - DAY_MS).toISOString(),
    EDITORIAL_DAILY_REQUEST_LIMIT - 1,
    new Date(nowMs - 30 * DAY_MS).toISOString(),
    EDITORIAL_MONTHLY_REQUEST_LIMIT - 1,
  ];
}

/** Check the shared ceiling before starting expensive work; the claim remains authoritative. */
export async function isEditorialBudgetAvailable(
  db: D1Database,
  nowMs = Date.now(),
): Promise<boolean> {
  const row = await db
    .prepare(`SELECT ${BUDGET_AVAILABLE_SQL} AS available`)
    .bind(...budgetBindings(nowMs))
    .first<{ available: number }>();
  if (row === null) throw new Error('Editorial budget check returned no result');
  return row.available === 1;
}

/** Split the shared ceiling by operation (generation vs review); display-only. */
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

/** Consume before HTTP; uncertain operations are never automatically charged and sent twice. */
export async function claimEditorialModelRequest(
  db: D1Database,
  id: string,
  owner: string,
  model: string,
  operation: EditorialModelOperation,
  nowMs = Date.now(),
  opts: { force?: boolean } = {},
): Promise<void> {
  const claimedAt = new Date(nowMs).toISOString();
  const row =
    opts.force === true
      ? await db
          .prepare(
            `INSERT INTO editorial_model_requests (id, owner, model, operation, claimed_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (id) DO NOTHING RETURNING id`,
          )
          .bind(id, owner, model, operation, claimedAt)
          .first()
      : await db
          .prepare(
            `INSERT INTO editorial_model_requests (id, owner, model, operation, claimed_at)
    SELECT ?, ?, ?, ?, ?
    WHERE ${BUDGET_AVAILABLE_SQL}
    ON CONFLICT (id) DO NOTHING RETURNING id`,
          )
          .bind(id, owner, model, operation, claimedAt, ...budgetBindings(nowMs))
          .first();
  if (row === null)
    throw new Error('Editorial model request already consumed or shared budget exhausted');
}
