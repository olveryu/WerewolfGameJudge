/**
 * Pack-row writes shared by the undercover, drawguess, and fibking editorial
 * queues.
 *
 * Category selection, intake, review policy, and inventory statements stay
 * game-owned. Undercover and drawguess share candidate claims and the atomic
 * candidate-review / inventory / pack-completion transaction. Fibking shares only the failure
 * statement: its packs table carries a different column set (month_id /
 * published_at / source_json / outcome instead of model / candidates_json /
 * failure_reason), so its reserve insert and publish completion stay in its
 * own publication module.
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

const WORD_PACK_CANDIDATES_TABLES = {
  undercover_word_packs: {
    candidatesTable: 'undercover_word_candidates',
    hasCandidateReviewJson: false,
  },
  drawguess_word_packs: {
    candidatesTable: 'drawguess_word_candidates',
    hasCandidateReviewJson: true,
  },
} as const;

/** Claim category-scoped pending material; callers may prepend game-owned re-review statements. */
export function createClaimWordCandidatesStatement(
  db: D1Database,
  packsTable: keyof typeof WORD_PACK_CANDIDATES_TABLES,
  pack: WordPackRef & { readonly category: string },
  batchLimit: number,
): D1PreparedStatement {
  const { candidatesTable } = WORD_PACK_CANDIDATES_TABLES[packsTable];
  return db
    .prepare(
      `UPDATE ${candidatesTable} SET claimed_pack_id = ?
      WHERE id IN (SELECT id FROM ${candidatesTable} WHERE category = ? AND status = 'pending'
        AND (claimed_pack_id IS NULL OR claimed_pack_id = ? OR EXISTS (SELECT 1 FROM ${packsTable} failed WHERE failed.id = claimed_pack_id AND failed.status = 'failed'))
        ORDER BY created_at, id LIMIT ?)
      AND EXISTS (SELECT 1 FROM ${packsTable} WHERE id = ? AND request_token = ? AND status = 'reserved')
      RETURNING material_json`,
    )
    .bind(pack.id, pack.category, pack.id, batchLimit, pack.id, pack.request_token);
}

interface WordCandidatePublication {
  readonly id: string;
  readonly isAccepted: boolean;
  readonly reviewJson: string;
  readonly inventoryStatement: D1PreparedStatement;
}

/** Commit candidate reviews, game-owned inventory writes, and pack completion atomically. */
export async function publishReviewedWordPack<TCandidate, TReview>(
  db: D1Database,
  packsTable: keyof typeof WORD_PACK_CANDIDATES_TABLES,
  pack: WordPackRef,
  candidates: readonly TCandidate[],
  reviews: readonly TReview[],
  createPublication: (
    candidate: TCandidate,
    review: TReview,
    now: string,
  ) => Promise<WordCandidatePublication>,
): Promise<void> {
  const { candidatesTable, hasCandidateReviewJson } = WORD_PACK_CANDIDATES_TABLES[packsTable];
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];
  for (const [index, candidate] of candidates.entries()) {
    const review = reviews[index];
    if (review === undefined) throw new Error('Word publication review missing');
    const publication = await createPublication(candidate, review, now);
    const reviewAssignment = hasCandidateReviewJson ? ', review_json = ?' : '';
    const binds = [publication.isAccepted ? 'accepted' : 'rejected', now];
    if (hasCandidateReviewJson) binds.push(publication.reviewJson);
    statements.push(
      db
        .prepare(
          `UPDATE ${candidatesTable} SET status = ?, reviewed_at = ?${reviewAssignment}
      WHERE id = ? AND claimed_pack_id = ? AND EXISTS (SELECT 1 FROM ${packsTable} WHERE id = ? AND request_token = ? AND status = 'reserved')`,
        )
        .bind(...binds, publication.id, pack.id, pack.id, pack.request_token),
      publication.inventoryStatement,
    );
  }
  statements.push(
    createCompleteWordPackStatement(
      db,
      packsTable,
      pack,
      JSON.stringify(candidates),
      JSON.stringify(reviews),
      now,
    ),
  );
  await db.batch(statements);
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

/** Complete the pack after candidate and inventory writes in the publication batch. */
function createCompleteWordPackStatement(
  db: D1Database,
  packsTable: keyof typeof WORD_PACK_CANDIDATES_TABLES,
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
