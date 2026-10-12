/**
 * Pack-row writes shared by the undercover and drawguess editorial queues.
 *
 * Category selection, candidate storage, and the publish choreography stay
 * with each game (their queue semantics differ); the pack row lifecycle —
 * reserve insert under the capacity gate, publish completion inside the
 * game's batch, and failure recording — is identical modulo the table name.
 */

export type WordPacksTable = 'undercover_word_packs' | 'drawguess_word_packs';

export interface WordPackRef {
  readonly id: string;
  readonly request_token: string;
}

/**
 * Manual runs (normal or force) carry a unique runId so repeated triggers on
 * the same day never collide with each other or with the scheduled batches.
 */
export function createWordPackId(
  day: string,
  batchIndex: number,
  opts: { readonly force?: boolean; readonly runId?: string },
): string {
  return opts.runId
    ? `${day}-${opts.force ? 'force' : 'manual'}-${opts.runId}-${batchIndex}`
    : `${day}-${batchIndex}`;
}

/** Insert a reserved pack row if database capacity allows; null when refused or already taken. */
export async function insertReservedWordPack(
  db: D1Database,
  options: {
    readonly packsTable: WordPacksTable;
    readonly packId: string;
    readonly category: string;
    readonly model: string;
    readonly promptVersion: string;
    readonly reviewVersion: string;
  },
): Promise<Record<string, unknown> | null> {
  return db
    .prepare(
      `INSERT INTO ${options.packsTable} (id, category, request_token, status, created_at, model, prompt_version, review_version)
    SELECT ?, ?, ?, 'reserved', ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM database_capacity WHERE id = 1 AND state IN ('normal', 'warning'))
    ON CONFLICT (id) DO NOTHING RETURNING id, category, request_token`,
    )
    .bind(
      options.packId,
      options.category,
      crypto.randomUUID(),
      new Date().toISOString(),
      options.model,
      options.promptVersion,
      options.reviewVersion,
    )
    .first();
}

/** Final publish statement; the caller appends it to its own publication batch. */
export function createCompleteWordPackStatement(
  db: D1Database,
  packsTable: WordPacksTable,
  pack: WordPackRef,
  candidatesJson: string,
  reviewsJson: string,
  completedAt: string,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE ${packsTable} SET status = 'published', candidates_json = ?, reviews_json = ?, completed_at = ?
    WHERE id = ? AND request_token = ? AND status = 'reserved'`,
    )
    .bind(candidatesJson, reviewsJson, completedAt, pack.id, pack.request_token);
}

/** Record failure without disabling inventory or discarding the unreviewed queue. */
export async function failWordPack(
  db: D1Database,
  packsTable: WordPacksTable,
  pack: WordPackRef,
  reason: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE ${packsTable} SET status = 'failed', failure_reason = ?, completed_at = ?
    WHERE id = ? AND request_token = ? AND status = 'reserved'`,
    )
    .bind(reason, new Date().toISOString(), pack.id, pack.request_token)
    .run();
}
