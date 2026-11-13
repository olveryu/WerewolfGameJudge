/** Bounded, indexed reads of isolated submission data; credential data never enters batches. */
import {
  type GameWordGame,
  type WordSubmissionBatch,
  wordSubmissionBatchHeaderSchema,
  type WordSubmissionItem,
  wordSubmissionItemSchema,
  wordSubmissionReviewSchema,
} from '@game-judge/game-engine/product/wordSupply';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

const jsonObjectSchema = z.record(z.string(), z.unknown());
export function parseSubmissionObject(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value);
  return jsonObjectSchema.parse(parsed);
}

export interface StoredSubmissionItem extends WordSubmissionItem {
  readonly verifiedContent: Record<string, unknown> | null;
}

const itemSelect = `SELECT id, client_item_id AS clientItemId, identity,
  content_hash AS contentHash, title, category, material_json, status,
  duplicate_of AS duplicateOf, review_id AS reviewId, review_version AS reviewVersion, review_model AS reviewModel,
  review_json, verified_material_json, failure, approval_reason AS approvalReason, revision
  FROM word_submission_items`;

function decodeItem(value: unknown): StoredSubmissionItem {
  const row = jsonObjectSchema.parse(value);
  const { material_json, review_json, verified_material_json, ...item } = row;
  return {
    ...wordSubmissionItemSchema.parse({
      ...item,
      content: parseSubmissionObject(z.string().parse(material_json)),
      review:
        review_json === null
          ? null
          : wordSubmissionReviewSchema.parse(parseSubmissionObject(z.string().parse(review_json))),
    }),
    verifiedContent:
      verified_material_json === null
        ? null
        : parseSubmissionObject(z.string().parse(verified_material_json)),
  };
}

/** Load the immutable content and current review together within a D1 transaction. */
export async function readStoredSubmissionBatch(
  db: D1Database,
  id: string,
  agentId?: string,
): Promise<Omit<WordSubmissionBatch, 'items'> & { items: StoredSubmissionItem[] }> {
  const results = await db.batch([
    db
      .prepare(
        `SELECT b.id, b.game, b.agent_id AS agentId, a.name AS agentName,
      b.created_at AS createdAt FROM word_submission_batches b
      JOIN word_submission_agents a ON a.id = b.agent_id
      WHERE b.id = ? AND (? IS NULL OR b.agent_id = ?)`,
      )
      .bind(id, agentId ?? null, agentId ?? null),
    db.prepare(`${itemSelect} WHERE batch_id = ? ORDER BY rowid`).bind(id),
  ]);
  const row = results[0]?.results[0];
  if (row === undefined) throw new HTTPException(404, { message: 'SUBMISSION_BATCH_NOT_FOUND' });
  const items = results[1];
  if (items === undefined) throw new Error('Submission item query result missing');
  const batch = wordSubmissionBatchHeaderSchema.parse(row);
  return { ...batch, items: items.results.map(decodeItem) };
}

/** The public view intentionally excludes verified internal material and request receipts. */
export async function readSubmissionBatch(db: D1Database, id: string, agentId?: string) {
  const batch = await readStoredSubmissionBatch(db, id, agentId);
  return {
    ...batch,
    items: batch.items.map(({ verifiedContent: _verifiedContent, ...item }) => item),
  };
}

/** Keyset pagination stays independent of historical batch count; game filters have their own index. */
export async function listSubmissionBatches(
  db: D1Database,
  filter: {
    game?: GameWordGame;
    agent?: string;
    status?: WordSubmissionItem['status'];
    search?: string;
    cursor?: number;
  },
) {
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const terms: string[] = [];
  if (filter.game !== undefined) terms.push(`game:${quote(filter.game)}`);
  if (filter.agent !== undefined) terms.push(`agent:${quote(filter.agent)}`);
  if (filter.status !== undefined) terms.push(`statuses:${quote(filter.status)}`);
  if (filter.search !== undefined && filter.search.length > 0)
    terms.push(`search_text:${quote(filter.search)}*`);
  const binds: (string | number)[] = terms.length === 0 ? [] : [terms.join(' AND ')];
  const where: string[] = terms.length === 0 ? [] : ['word_submission_search MATCH ?'];
  if (filter.cursor !== undefined) {
    where.push('search.rowid < ?');
    binds.push(filter.cursor);
  }
  const rows = await db
    .prepare(
      `SELECT b.id, b.game, b.agent_id AS agentId,
    search.rowid AS cursor,
    a.name AS agentName, b.created_at AS createdAt
    FROM word_submission_search search
    JOIN word_submission_batches b ON b.rowid = search.rowid
    JOIN word_submission_agents a ON a.id = b.agent_id
    ${where.length === 0 ? '' : `WHERE ${where.join(' AND ')}`}
    ORDER BY search.rowid DESC LIMIT 31`,
    )
    .bind(...binds)
    .all();
  const entries = rows.results
    .slice(0, 30)
    .map(({ cursor: _cursor, ...row }) => wordSubmissionBatchHeaderSchema.parse(row));
  const counts = await db
    .prepare(
      `SELECT batch_id, status, COUNT(*) AS count
    FROM word_submission_items WHERE batch_id IN (SELECT value FROM json_each(?))
    GROUP BY batch_id, status`,
    )
    .bind(JSON.stringify(entries.map((entry) => entry.id)))
    .all<{ batch_id: string; status: WordSubmissionItem['status']; count: number }>();
  const last = rows.results[29];
  return {
    batches: entries.map((entry) => ({
      ...entry,
      counts: Object.fromEntries(
        counts.results
          .filter((row) => row.batch_id === entry.id)
          .map((row) => [row.status, row.count]),
      ),
    })),
    nextCursor: rows.results.length > 30 && last !== undefined ? String(last.cursor) : null,
  };
}

/** Reindex at most 30 immutable items, inside the transaction that changes their statuses. */
export function refreshSubmissionSearch(db: D1Database, batchId: string) {
  return db
    .prepare(
      `UPDATE word_submission_search SET statuses = (
    SELECT group_concat(DISTINCT status) FROM word_submission_items WHERE batch_id = ?
  ) WHERE rowid = (SELECT rowid FROM word_submission_batches WHERE id = ?)`,
    )
    .bind(batchId, batchId);
}
