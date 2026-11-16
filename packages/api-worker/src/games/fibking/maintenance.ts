/** Bounded Fib usage retention; word order and seen records never expire. */
const RETENTION_DAYS = 90;
const DELETE_BATCH_LIMIT = 100;

/** Remove at most 100 obsolete usage rows per run; the candidate tables are gone (0085), so only usage retention remains. */
export async function cleanupFibWordAudit(db: D1Database, nowMs: number): Promise<void> {
  const boundary = new Date(nowMs - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await db.batch([
    db
      .prepare(
        `DELETE FROM fib_word_usages WHERE rowid IN (
      SELECT usage.rowid FROM fib_word_usages AS usage WHERE used_at < ?
      AND NOT EXISTS (SELECT 1 FROM rooms WHERE creation_id = usage.room_creation_id)
      ORDER BY used_at LIMIT ?)`,
      )
      .bind(boundary, DELETE_BATCH_LIMIT),
  ]);
}
