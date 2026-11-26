/** Pack reservation in D1. Supply only generates and stores — review and
 * publication live on the manual review/publish endpoints, never in the
 * workflow. There is no monthly quota: the admin controls how often to
 * trigger by hand. */

import {
  FIB_WORD_CATEGORY_IDS,
  FIBKING_WORD_CATEGORY_CATALOG,
  type FibWordSupplyCategory,
} from '@game-judge/game-engine/games/fibking/public';
import { z } from 'zod';

import { claimEditorialModelRequest } from '../../platform/ai/editorialBudget';
import { createFailWordPackStatement } from '../../platform/wordSupply/wordPackLedger';
import { GEMINI_FIB_WORD_MODEL } from './wordProviders/gemini';
import { FIB_WORD_PROMPT_VERSION } from './wordProviders/prompt';
import { FIB_WORD_SEARCH_QUERY_COUNT, FIB_WORD_SEARCHES } from './wordSearchPlan';

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
  category: z.enum(FIBKING_WORD_CATEGORY_CATALOG.ids),
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
    );
  }
}

/** Reserve at most seven source requests and two model calls; uncertain calls are not refunded. */
export async function reserveFibWordPack(
  db: D1Database,
  day: string,
  runId: string,
  category: FibWordSupplyCategory,
): Promise<FibWordPack | null> {
  const parsedDay = z.iso.date().parse(day);
  z.string().min(1).max(64).parse(runId);
  const selectedCategory = z.enum(FIB_WORD_CATEGORY_IDS).parse(category);
  const monthId = parsedDay.slice(0, 7);
  const id = `${parsedDay}-${runId}`;
  const requestToken = crypto.randomUUID();
  const results = await db.batch([
    db
      .prepare('INSERT INTO fib_word_supply_months (id) VALUES (?) ON CONFLICT (id) DO NOTHING')
      .bind(monthId),
    db
      .prepare(
        `INSERT INTO fib_word_packs
        (id, month_id, request_token, category, status, created_at)
      SELECT ?, id, ?, ?, 'reserved', ? FROM fib_word_supply_months
      WHERE id = ?
        AND EXISTS (SELECT 1 FROM database_capacity WHERE id = 1 AND state IN ('normal', 'warning'))
      ON CONFLICT (id) DO NOTHING RETURNING id, category, request_token`,
      )
      .bind(id, requestToken, selectedCategory, new Date().toISOString(), monthId),
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
     SET search_index = (
       SELECT CAST(key AS INTEGER) FROM json_each(?)
       WHERE json_extract(value, '$.category') = ?
       ORDER BY COALESCE((SELECT MAX(search_selected_at) FROM fib_word_packs previous
         WHERE previous.category = ? AND previous.search_index = CAST(key AS INTEGER)), ''),
         CAST(key AS INTEGER)
       LIMIT 1
     ), search_selected_at = ?
     WHERE id = ? AND request_token = ? AND status = 'reserved' AND search_index IS NULL
     RETURNING search_index AS searchIndex, category`,
    )
    .bind(searches, pack.category, pack.category, now, pack.id, pack.request_token)
    .first();
  const selected =
    row ??
    (await db
      .prepare(
        `SELECT search_index AS searchIndex, category FROM fib_word_packs
         WHERE id = ? AND request_token = ? AND status = 'reserved'`,
      )
      .bind(pack.id, pack.request_token)
      .first());
  if (selected === null)
    throw new Error(`Fib category search could not be selected for pack ${pack.id}`);
  return z
    .strictObject({
      searchIndex: z
        .int()
        .min(0)
        .max(FIB_WORD_SEARCH_QUERY_COUNT - 1),
      category: z.enum(FIBKING_WORD_CATEGORY_CATALOG.ids),
    })
    .parse(selected);
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
  ]);
}
