/** Bounded Fib editorial retention; word order and account progress never expire. */
const RETENTION_DAYS = 90;
const DELETE_BATCH_LIMIT = 100;

/** Remove at most 300 obsolete rows per run; active room usage remains replayable. */
export async function cleanupFibWordAudit(db: D1Database, nowMs: number): Promise<void> {
  const boundary = new Date(nowMs - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await db.batch([
    db
      .prepare(
        `DELETE FROM fib_word_candidate_reviews WHERE id IN (
      SELECT id FROM fib_word_candidate_reviews WHERE reviewed_at < ? ORDER BY reviewed_at LIMIT ?)`,
      )
      .bind(boundary, DELETE_BATCH_LIMIT),
    db
      .prepare(
        `DELETE FROM fib_word_usages WHERE rowid IN (
      SELECT usage.rowid FROM fib_word_usages AS usage WHERE used_at < ?
      AND NOT EXISTS (SELECT 1 FROM rooms WHERE creation_id = usage.room_creation_id)
      ORDER BY used_at LIMIT ?)`,
      )
      .bind(boundary, DELETE_BATCH_LIMIT),
    db
      .prepare(
        `DELETE FROM fib_word_exposures WHERE rowid IN (
      SELECT exposure.rowid FROM fib_word_exposures AS exposure
      WHERE EXISTS (SELECT 1 FROM fib_word_sequence WHERE word = exposure.word) LIMIT ?)`,
      )
      .bind(DELETE_BATCH_LIMIT),
  ]);
}
