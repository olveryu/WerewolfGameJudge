/**
 * Pack-row writes shared by the undercover, drawguess, and fibking editorial
 * queues.
 *
 * Category selection, intake, review policy, and inventory statements stay
 * game-owned. Undercover and drawguess share only the failure statement
 * now: the workflow only generates and stores, so candidate claims and the
 * atomic candidate-review / inventory / pack-completion transaction are
 * gone — review and publication live on the manual review/publish
 * endpoints. Fibking shares only the failure statement: its packs table
 * carries a different column set (month_id / published_at / source_json /
 * outcome instead of model / candidates_json / failure_reason), so its
 * reserve insert and failure completion stay in its own publication module.
 */

export type WordPacksTable = 'undercover_word_packs' | 'drawguess_word_packs' | 'fib_word_packs';

/**
 * Columns the failure statement writes, per packs table. The undercover and
 * drawguess packs tables record the reason and completion time on the pack
 * row itself; the fibking packs table has neither column (its failure detail
 * lives on fib_word_generation_cycles), so its failure statement writes the
 * status alone.
 */
const WORD_PACK_FAILURE_COLUMNS: Readonly<
  Record<
    WordPacksTable,
    { readonly failureReason: string | null; readonly completedAt: string | null }
  >
> = {
  undercover_word_packs: { failureReason: 'failure_reason', completedAt: 'completed_at' },
  drawguess_word_packs: { failureReason: 'failure_reason', completedAt: 'completed_at' },
  fib_word_packs: { failureReason: null, completedAt: null },
};

export interface WordPackRef {
  readonly id: string;
  readonly request_token: string;
}

/**
 * Manual runs carry a unique runId so repeated triggers on the same day
 * never collide with each other. One trigger runs one pack, so the pack id
 * is the day plus the run id — no batch slots, no manual identity split.
 */
export function createWordPackId(day: string, runId: string): string {
  return `${day}-${runId}`;
}

/** Insert a reserved pack row if database capacity allows; null when refused or already taken. */
export async function insertReservedWordPack(
  db: D1Database,
  options: {
    readonly packsTable: WordPacksTable;
    readonly packId: string;
    readonly categorySql: string;
    readonly categoryBinds: readonly unknown[];
    readonly model: string;
    readonly promptVersion: string;
    readonly reviewVersion: string;
  },
): Promise<Record<string, unknown> | null> {
  return db
    .prepare(
      `INSERT INTO ${options.packsTable} (id, category, request_token, status, created_at, model, prompt_version, review_version)
    SELECT ?, (${options.categorySql}), ?, 'reserved', ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM database_capacity WHERE id = 1 AND state IN ('normal', 'warning'))
    ON CONFLICT (id) DO NOTHING RETURNING id, category, request_token`,
    )
    .bind(
      options.packId,
      ...options.categoryBinds,
      crypto.randomUUID(),
      new Date().toISOString(),
      options.model,
      options.promptVersion,
      options.reviewVersion,
    )
    .first();
}

/**
 * Failure statement for one pack row; games with companion-table teardown
 * (fibking) append it to their own failure batch instead of running it here.
 */
export function createFailWordPackStatement(
  db: D1Database,
  packsTable: WordPacksTable,
  pack: WordPackRef,
  reason: string,
): D1PreparedStatement {
  const columns = WORD_PACK_FAILURE_COLUMNS[packsTable];
  const assignments = ["status = 'failed'"];
  const binds: string[] = [];
  if (columns.failureReason !== null) {
    assignments.push(`${columns.failureReason} = ?`);
    binds.push(reason);
  }
  if (columns.completedAt !== null) {
    assignments.push(`${columns.completedAt} = ?`);
    binds.push(new Date().toISOString());
  }
  return db
    .prepare(
      `UPDATE ${packsTable} SET ${assignments.join(', ')}
    WHERE id = ? AND request_token = ? AND status = 'reserved'`,
    )
    .bind(...binds, pack.id, pack.request_token);
}

/** Record failure without disabling inventory or discarding the unreviewed queue. */
export async function failWordPack(
  db: D1Database,
  packsTable: WordPacksTable,
  pack: WordPackRef,
  reason: string,
): Promise<void> {
  await createFailWordPackStatement(db, packsTable, pack, reason).run();
}
