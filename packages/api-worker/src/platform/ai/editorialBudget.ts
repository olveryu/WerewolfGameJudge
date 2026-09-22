/** Shared application ceilings for editorial model calls, not a claim about provider quotas. */

export const EDITORIAL_DAILY_REQUEST_LIMIT = 8;
const EDITORIAL_MONTHLY_REQUEST_LIMIT = 120;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Consume before HTTP; uncertain operations are never automatically charged and sent twice. */
export async function claimEditorialModelRequest(
  db: D1Database,
  id: string,
  owner: string,
  model: string,
  nowMs = Date.now(),
): Promise<void> {
  const row = await db
    .prepare(
      `INSERT INTO editorial_model_requests (id, owner, model, claimed_at)
    SELECT ?, ?, ?, ?
    WHERE (SELECT COUNT(*) FROM editorial_model_requests WHERE claimed_at > ?) < ?
      AND (SELECT COUNT(*) FROM editorial_model_requests WHERE claimed_at > ?) < ?
    ON CONFLICT (id) DO NOTHING RETURNING id`,
    )
    .bind(
      id,
      owner,
      model,
      new Date(nowMs).toISOString(),
      new Date(nowMs - DAY_MS).toISOString(),
      EDITORIAL_DAILY_REQUEST_LIMIT,
      new Date(nowMs - 30 * DAY_MS).toISOString(),
      EDITORIAL_MONTHLY_REQUEST_LIMIT,
    )
    .first();
  if (row === null)
    throw new Error('Editorial model request already consumed or shared budget exhausted');
}
