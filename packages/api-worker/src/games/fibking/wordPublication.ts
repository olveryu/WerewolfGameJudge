/** Bounded monthly editorial budget and pack reservation in D1. Supply only
 * generates and stores — review and publication live on the manual
 * review/publish endpoints, never in the workflow. */

import { z } from 'zod';

import { claimEditorialModelRequest } from '../../platform/ai/editorialBudget';
import { wordCategoryCooldownCutoff } from '../../platform/wordSupply/categoryCooldown';
import { createFailWordPackStatement } from '../../platform/wordSupply/wordPackLedger';
import { parseFibWordEditorialCandidate } from './wordProviders/candidate';
import { GEMINI_FIB_WORD_MODEL } from './wordProviders/gemini';
import { FIB_WORD_PROMPT_VERSION, FIB_WORD_REVIEW_VERSION } from './wordProviders/prompt';
import {
  FIB_WORD_CATEGORIES,
  FIB_WORD_STORED_GENERATION_BATCH_LIMIT,
  type FibWordEditorialCandidate,
} from './wordProviders/types';
import { FIB_WORD_SEARCH_QUERY_COUNT, FIB_WORD_SEARCHES } from './wordSearchPlan';
import { FIB_WORD_TOPIC_IDS } from './wordTopics';

export const FIB_WORD_MONTHLY_TARGET = 100;
export const FIB_WORD_MONTHLY_BATCH_LIMIT = 78;
export const FIB_WORD_DAILY_BATCH_LIMIT = 4;
const FIB_WORD_TAVILY_REQUEST_LIMIT = 7;
/**
 * Tavily free (Researcher) plan: 1,000 credits/month. Every fibking Tavily
 * operation uses basic search/extract, so each ledger row costs at most one
 * credit and the row count is an upper bound on credits consumed.
 */
export const FIB_WORD_TAVILY_FREE_MONTHLY_CREDITS = 1000;

type FibWordProviderOperation =
  | 'discovery'
  | 'extraction'
  | 'generation'
  | 'review'
  | `verification-${number}`
  | `verification-extraction-${number}`;

const packSchema = z.strictObject({
  id: z.string(),
  category: z.enum(FIB_WORD_CATEGORIES),
  topic: z.enum(FIB_WORD_TOPIC_IDS).nullable().optional(),
  request_token: z.string(),
  searchIndex: z
    .number()
    .int()
    .min(0)
    .max(FIB_WORD_SEARCH_QUERY_COUNT - 1)
    .optional(),
});
export type FibWordPack = z.output<typeof packSchema>;

/** An uncertain provider operation is consumed permanently, including after Workflow restart. */
export async function claimFibWordProviderRequest(
  db: D1Database,
  pack: FibWordPack,
  operation: FibWordProviderOperation,
  opts: { force?: boolean } = {},
): Promise<void> {
  const result = await db
    .prepare(
      `INSERT INTO fib_word_provider_requests (pack_id, operation)
    SELECT id, ? FROM fib_word_packs WHERE id = ? AND request_token = ? AND status = 'reserved'
      AND (? IN ('generation', 'review') OR (
        SELECT COUNT(*) FROM fib_word_provider_requests
        WHERE pack_id = ? AND operation NOT IN ('generation', 'review')
      ) < ?)
    ON CONFLICT (pack_id, operation) DO NOTHING RETURNING pack_id`,
    )
    .bind(operation, pack.id, pack.request_token, operation, pack.id, FIB_WORD_TAVILY_REQUEST_LIMIT)
    .first();
  if (result === null)
    throw new Error('Fib provider operation already consumed, budget exhausted, or pack is closed');
  if (operation === 'generation' || operation === 'review') {
    await claimEditorialModelRequest(
      db,
      `fib:${pack.id}:${operation}`,
      'fibking',
      GEMINI_FIB_WORD_MODEL,
      operation,
      Date.now(),
      { force: opts.force },
    );
  }
}

/** Reserve at most seven source requests and two model calls; uncertain calls are not refunded. */
export async function reserveFibWordPack(
  db: D1Database,
  day: string,
  batchIndex: number,
  opts: { force?: boolean; runId?: string; batchLimit?: number } = {},
): Promise<FibWordPack | null> {
  const batchLimit = opts.batchLimit ?? FIB_WORD_DAILY_BATCH_LIMIT;
  const parsedDay = z.iso.date().parse(day);
  z.int().min(FIB_WORD_DAILY_BATCH_LIMIT).max(FIB_WORD_MONTHLY_BATCH_LIMIT).parse(batchLimit);
  z.int()
    .min(0)
    .max(batchLimit - 1)
    .parse(batchIndex);
  const monthId = parsedDay.slice(0, 7);
  // Manual runs (normal or force) carry a unique runId so repeated triggers on the same
  // day never collide with each other or with the scheduled daily batches. Force mode
  // additionally bypasses the monthly budget below.
  const id = opts.runId
    ? `${parsedDay}-${opts.force ? 'force' : 'manual'}-${opts.runId}-${batchIndex}`
    : `${parsedDay}-${batchIndex}`;
  const requestToken = crypto.randomUUID();
  const category =
    FIB_WORD_CATEGORIES[(Number(parsedDay.slice(-2)) + batchIndex) % FIB_WORD_CATEGORIES.length];
  if (category === undefined) throw new Error('Fib publication category unavailable');
  const quotaClause = opts.force ? '' : 'AND requests_reserved < ? AND published_count < ?';
  const quotaBinds: number[] = opts.force
    ? []
    : [FIB_WORD_MONTHLY_BATCH_LIMIT, FIB_WORD_MONTHLY_TARGET];
  const results = await db.batch([
    db
      .prepare('INSERT INTO fib_word_supply_months (id) VALUES (?) ON CONFLICT (id) DO NOTHING')
      .bind(monthId),
    db
      .prepare(
        `INSERT INTO fib_word_packs (id, month_id, request_token, category, status, created_at)
      SELECT ?, id, ?, ?, 'reserved', ? FROM fib_word_supply_months
      WHERE id = ? ${quotaClause}
        AND EXISTS (SELECT 1 FROM database_capacity WHERE id = 1 AND state IN ('normal', 'warning'))
      ON CONFLICT (id) DO NOTHING RETURNING id, category, request_token`,
      )
      .bind(id, requestToken, category, new Date().toISOString(), monthId, ...quotaBinds),
    db
      .prepare(
        `UPDATE fib_word_supply_months SET requests_reserved = requests_reserved + 1
      WHERE id = ? AND EXISTS (SELECT 1 FROM fib_word_packs WHERE id = ? AND request_token = ?)
      RETURNING requests_reserved`,
      )
      .bind(monthId, id, requestToken),
    db
      .prepare(
        `INSERT INTO fib_word_generation_cycles (id, status, provider, model, prompt_version, started_at)
      SELECT id, 'running', 'gemini', ?, ?, created_at FROM fib_word_packs WHERE id = ? AND request_token = ?`,
      )
      .bind(GEMINI_FIB_WORD_MODEL, FIB_WORD_PROMPT_VERSION, id, requestToken),
  ]);
  const result = results[1];
  if (result === undefined) throw new Error('Fib pack reservation result missing');
  const row = result.results[0];
  if (row === undefined) return null;
  return packSchema.parse(row);
}

/** Select and persist the search atomically only when a pack needs discovery. */
export async function selectFibWordSearch(db: D1Database, pack: FibWordPack) {
  const searches = JSON.stringify(FIB_WORD_SEARCHES);
  const now = new Date().toISOString();
  const row = await db
    .prepare(
      `UPDATE fib_word_packs
     SET (search_index, topic) = (
       WITH focus AS (
         SELECT value AS topic FROM json_each(?) categories
         ORDER BY (SELECT COUNT(*) FROM fib_words WHERE status = 'active' AND topic = categories.value),
           COALESCE((SELECT MAX(search_selected_at) FROM fib_word_packs WHERE topic = categories.value), '') > ?,
           COALESCE((SELECT MAX(search_selected_at) FROM fib_word_packs WHERE topic = categories.value), ''),
           value LIMIT 1
       ), choice AS (
         SELECT CAST(key AS INTEGER) AS search_index, json_extract(value, '$.topic') AS topic
         FROM json_each(?) WHERE json_extract(value, '$.topic') = (SELECT topic FROM focus)
         ORDER BY COALESCE((SELECT MAX(search_selected_at) FROM fib_word_packs
           WHERE search_index = CAST(key AS INTEGER)), ''), CAST(key AS INTEGER) LIMIT 1
       )
       SELECT search_index, topic FROM choice
     ), search_selected_at = ?
     WHERE id = ? AND request_token = ? AND status = 'reserved' AND search_index IS NULL
     RETURNING search_index AS searchIndex, topic`,
    )
    .bind(
      JSON.stringify(FIB_WORD_TOPIC_IDS),
      wordCategoryCooldownCutoff(),
      searches,
      now,
      pack.id,
      pack.request_token,
    )
    .first();
  const selected =
    row ??
    (await db
      .prepare(
        `UPDATE fib_word_packs SET topic = COALESCE(topic, json_extract(?, '$[' || search_index || '].topic')),
      search_selected_at = COALESCE(search_selected_at, ?)
     WHERE id = ? AND request_token = ? AND status = 'reserved'
     RETURNING search_index AS searchIndex, topic`,
      )
      .bind(searches, now, pack.id, pack.request_token)
      .first());
  return z
    .strictObject({
      searchIndex: z
        .int()
        .min(0)
        .max(FIB_WORD_SEARCH_QUERY_COUNT - 1),
      topic: z.enum(FIB_WORD_TOPIC_IDS),
    })
    .parse(selected);
}

/** Keep every extracted candidate, including overflow; identical reviewed evidence is not requeued. */
export async function storeFibWordCandidates(
  db: D1Database,
  pack: FibWordPack,
  candidates: readonly FibWordEditorialCandidate[],
): Promise<void> {
  if (candidates.length > FIB_WORD_STORED_GENERATION_BATCH_LIMIT) {
    throw new Error('Fib candidate intake exceeds batch limit');
  }
  if (candidates.length === 0) return;
  const now = new Date().toISOString();
  await db.batch(
    candidates.map((value, index) => {
      const candidate = parseFibWordEditorialCandidate(value);
      if (candidate.evidence.length === 0)
        throw new Error('Extracted Fib candidate has no evidence');
      const evidenceJson = JSON.stringify(candidate.evidence);
      return db
        .prepare(
          `INSERT INTO fib_word_candidates (id, word, core_meaning, usage_note, category, topic, source,
           evidence_json, generation_cycle_id, status, created_at)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?, id, 'pending', ? FROM fib_word_packs
           WHERE id = ? AND request_token = ? AND status = 'reserved'
             AND NOT EXISTS (
               SELECT 1 FROM fib_word_candidate_reviews WHERE word = ? AND core_meaning = ?
                 AND usage_note = ? AND review_version = ? AND evidence_json = ?
             )
           ON CONFLICT (word) DO NOTHING`,
        )
        .bind(
          `${pack.id}:${index}`,
          candidate.word,
          candidate.definition.coreMeaning,
          candidate.definition.usageNote,
          candidate.category,
          candidate.topic ?? null,
          candidate.source,
          evidenceJson,
          now,
          pack.id,
          pack.request_token,
          candidate.word,
          candidate.definition.coreMeaning,
          candidate.definition.usageNote,
          FIB_WORD_REVIEW_VERSION,
          evidenceJson,
        );
    }),
  );
}

/** Mark a failed pack terminal without refunding potentially consumed external quota. */
export async function failFibWordPack(
  db: D1Database,
  pack: FibWordPack,
  errorCode: string,
): Promise<void> {
  await db.batch([
    createFailWordPackStatement(db, 'fib_word_packs', pack, errorCode),
    db
      .prepare(
        "UPDATE fib_word_generation_cycles SET status = 'failed', completed_at = ?, error_code = ? WHERE id = ? AND status = 'running'",
      )
      .bind(new Date().toISOString(), errorCode, pack.id),
    db
      .prepare(
        `UPDATE fib_word_candidates SET status = 'approved', claimed_pack_id = NULL, claimed_at = NULL
         WHERE claimed_pack_id = ? AND EXISTS (
           SELECT 1 FROM fib_word_packs WHERE id = ? AND request_token = ? AND status = 'failed')`,
      )
      .bind(pack.id, pack.id, pack.request_token),
  ]);
}
