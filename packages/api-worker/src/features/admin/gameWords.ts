/**
 * Admin word-supply dashboard backend.
 *
 * Per-game supply stats and manual supply triggers through exhaustive adapters.
 * Game names are whitelisted to table/binding mappings — user input never
 * reaches SQL or env bindings directly.
 */

import { DECRYPTO_WORD_CATEGORY_CATALOG } from '@game-judge/game-engine/games/decrypto/public';
import { DRAWGUESS_WORD_CATEGORY_CATALOG } from '@game-judge/game-engine/games/drawguess/public';
import {
  FIB_WORD_CATEGORY_IDS,
  FIBKING_WORD_CATEGORY_CATALOG,
} from '@game-judge/game-engine/games/fibking/public';
import {
  UNDERCOVER_CATEGORY_MIN_ACTIVE_PAIRS,
  UNDERCOVER_WORD_CATEGORY_CATALOG,
} from '@game-judge/game-engine/games/undercover/public';
import { WORD_CATEGORY_CATALOGS } from '@game-judge/game-engine/games/wordCategoryCatalogs';
import {
  GAME_WORD_GAMES,
  type GameWordGame,
  type GameWordsStats,
  type TriggerSupplyResult,
  type WordLibraryItems,
  type WordSubmissionStatus,
  wordSubmissionStatusSchema,
} from '@game-judge/game-engine/product/wordSupply';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import type { Env } from '../../env';
import { FIB_WORD_TAVILY_FREE_MONTHLY_CREDITS } from '../../games/fibking/wordPublication';
import { createFibWordSearchQuery } from '../../games/fibking/wordSearchPlan';
import { readModelBudgetByOperation } from '../../platform/ai/editorialBudget';
import { isWordSupplyAvailable } from '../../platform/wordSupply/automaticSupply';
import { wordCategoryCooldownCutoff } from '../../platform/wordSupply/categoryCooldown';
import type { WordSupplyParams } from '../../platform/wordSupply/wordSupplyWorkflow';

export const gameWordGameSchema = z.enum(GAME_WORD_GAMES);

export const triggerSupplySchema = z.discriminatedUnion('game', [
  z.strictObject({ game: z.literal('fibking'), category: z.enum(FIB_WORD_CATEGORY_IDS) }),
  z.strictObject({
    game: z.literal('undercover'),
    category: z.enum(UNDERCOVER_WORD_CATEGORY_CATALOG.ids),
  }),
  z.strictObject({
    game: z.literal('drawguess'),
    category: z.enum(DRAWGUESS_WORD_CATEGORY_CATALOG.ids),
  }),
  z.strictObject({
    game: z.literal('decrypto'),
    category: z.enum(DECRYPTO_WORD_CATEGORY_CATALOG.ids),
  }),
]);
export type TriggerSupplyInput = z.output<typeof triggerSupplySchema>;

type DashboardDetails = Pick<GameWordsStats, 'categories' | 'modelBudget'>;

/**
 * Category columns are NOT NULL with a foreign key into `word_categories`, so a stored value
 * outside the code catalog means the catalog and D1 have drifted: fail with the game and value.
 */
function catalogCategorySchema<const Id extends string>(
  game: GameWordGame,
  ids: readonly [Id, ...Id[]],
) {
  return z.enum(ids, {
    error: (issue) => `${game} category ${JSON.stringify(issue.input)} is not in its catalog`,
  });
}

function parseCategoryRows<T>(
  game: GameWordGame,
  source: string,
  schema: z.ZodType<T>,
  rows: unknown,
): T {
  const parsed = schema.safeParse(rows);
  if (!parsed.success) {
    throw new Error(`Admin word stats: ${game} ${source} rows do not match the category catalog`, {
      cause: parsed.error,
    });
  }
  return parsed.data;
}
type DashboardBase = Omit<GameWordsStats, keyof DashboardDetails>;

/** Exhaustive over `GameWordGame`: a new word game fails typecheck here instead of reading another game's tables. */
const WORD_LIBRARY_TABLES: {
  readonly [TGame in GameWordGame]: { readonly wordsTable: string; readonly packsTable: string };
} = {
  fibking: { wordsTable: 'fib_words', packsTable: 'fib_word_packs' },
  undercover: { wordsTable: 'undercover_word_pairs', packsTable: 'undercover_word_packs' },
  drawguess: { wordsTable: 'drawguess_words', packsTable: 'drawguess_word_packs' },
  decrypto: { wordsTable: 'decrypto_words', packsTable: 'decrypto_word_packs' },
};

async function getDashboardDetails(db: D1Database, game: GameWordGame): Promise<DashboardDetails> {
  const isFib = game === 'fibking';
  const { wordsTable, packsTable } = WORD_LIBRARY_TABLES[game];
  const catalog = WORD_CATEGORY_CATALOGS[game];
  const category = catalogCategorySchema(game, catalog.ids);
  // Pending counts read the submission queue (the candidate tables were dropped in 0085).
  // Every category column is NOT NULL and references word_categories, so all queries group
  // by the stored category directly.
  const packTime = isFib ? 'search_selected_at' : 'created_at';
  const packFilter = isFib ? 'WHERE search_selected_at IS NOT NULL' : '';
  // Yield (published words that came through supply) is only computable for
  // fibking, from the sequence table; the undercover/drawguess yield JOIN
  // read the dropped candidate tables, so those games report no yield.
  const yieldSql = isFib
    ? `SELECT w.category AS category, COUNT(*) AS count
       FROM fib_word_sequence s JOIN fib_words w ON w.word = s.word
       WHERE s.pack_id IS NOT NULL GROUP BY w.category`
    : null;
  const now = Date.now();
  const statements = [
    db.prepare(
      `SELECT category, SUM(status = 'active') AS active, COUNT(*) AS total FROM ${wordsTable} GROUP BY category`,
    ),
    db
      .prepare(
        `SELECT category, COUNT(*) AS count FROM word_submission_items
         WHERE game = ? AND status IN ('pending', 'approved') GROUP BY category`,
      )
      .bind(game),
    db.prepare(
      `SELECT category, COUNT(*) AS count, MAX(${packTime}) AS last FROM ${packsTable} ${packFilter} GROUP BY category`,
    ),
  ];
  if (yieldSql !== null) statements.push(db.prepare(yieldSql));
  statements.push(
    db
      .prepare(
        `SELECT SUM(claimed_at > ?) AS daily, SUM(claimed_at > ?) AS monthly FROM editorial_model_requests`,
      )
      .bind(
        new Date(now - 24 * 60 * 60 * 1000).toISOString(),
        new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(),
      ),
  );
  const batchResults = await db.batch(statements);
  const [inventory, pending, packs] = batchResults;
  const yielded = yieldSql === null ? undefined : batchResults[3];
  const budget = batchResults[yieldSql === null ? 3 : 4];
  const rows = z.array(z.strictObject({ category, count: z.int().nonnegative() }));
  const inventoryRows = parseCategoryRows(
    game,
    wordsTable,
    z.array(
      z.strictObject({ category, active: z.int().nonnegative(), total: z.int().nonnegative() }),
    ),
    inventory.results,
  );
  const pendingRows = parseCategoryRows(game, 'word_submission_items', rows, pending.results);
  const packRows = parseCategoryRows(
    game,
    packsTable,
    z.array(
      z.strictObject({ category, count: z.int().nonnegative(), last: z.string().nullable() }),
    ),
    packs.results,
  );
  const yieldRows =
    yielded === undefined
      ? []
      : parseCategoryRows(game, 'fib_word_sequence', rows, yielded.results);
  const budgetRow = z
    .strictObject({ daily: z.int().nullable(), monthly: z.int().nullable() })
    .parse(budget?.results[0]);
  const byOperation = await readModelBudgetByOperation(db);
  const cutoff = wordCategoryCooldownCutoff(now);
  return {
    categories: catalog.entries.map(({ id, name }) => {
      const stock = inventoryRows.find((row) => row.category === id);
      const batch = packRows.find((row) => row.category === id);
      const lastAttempt = batch?.last ?? null;
      const active = stock?.active ?? 0;
      return {
        id,
        name,
        active,
        total: stock?.total ?? 0,
        pending: pendingRows.find((row) => row.category === id)?.count ?? 0,
        batches: batch?.count ?? 0,
        yieldCount: yieldRows.find((row) => row.category === id)?.count ?? 0,
        lastAttempt,
        coolingDown: lastAttempt !== null && lastAttempt > cutoff,
        menuEligible: game === 'undercover' ? active >= UNDERCOVER_CATEGORY_MIN_ACTIVE_PAIRS : null,
      };
    }),
    modelBudget: {
      dailyUsed: budgetRow.daily ?? 0,
      monthlyUsed: budgetRow.monthly ?? 0,
      byOperation,
    },
  };
}

/** Submission review pass rate, from the model verdicts on submission items:
 * review_json holds the latest independent-review outcome; items passed by
 * human override (approve) carry no review_json and are not model verdicts,
 * and items that never reached a verdict (failed review) are not counted. */
async function getSubmissionReviewDecisions(db: D1Database, game: GameWordGame) {
  const rows = await db
    .prepare(
      `SELECT CASE WHEN json_extract(review_json, '$.passed') = 1 THEN 'accepted' ELSE 'rejected' END AS decision,
              COUNT(*) AS count
       FROM word_submission_items
       WHERE game = ? AND review_json IS NOT NULL
       GROUP BY decision ORDER BY decision`,
    )
    .bind(game)
    .all<{ decision: string; count: number }>();
  return (rows.results ?? []).map((row) => ({ decision: row.decision, count: Number(row.count) }));
}

async function getFibWordStats(env: Env): Promise<DashboardBase> {
  const db = env.DB;
  // Candidate review history is gone with the candidate tables (0085); the
  // dashboard keeps the shape with empty history.
  const reviewCheckStats = (
    [
      'isEstablishedTerm',
      'isDefinitionAccurate',
      'isMeaningUnfamiliarToMostPlayers',
      'isMeaningDistinctFromLiteralReading',
      'hasMultiplePlausibleWrongDefinitions',
      'hasRevealValue',
    ] as const
  ).map((check) => ({ check, failCount: 0 }));
  // Pack ids start with the UTC date, so the prefix selects this month's packs.
  // Only Tavily operations count (discovery/extraction and their verification
  // variants); generation/review are Gemini model calls, not Tavily.
  const currentMonth = new Date().toISOString().slice(0, 7);
  const tavilyRow = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM fib_word_provider_requests
         WHERE pack_id >= ? AND pack_id < ?
           AND (operation IN ('discovery', 'extraction') OR operation LIKE 'verification-%'))
         + (SELECT COUNT(*) FROM word_submission_evidence_requests
           WHERE claimed_at >= ? AND claimed_at < ?) AS used`,
    )
    .bind(`${currentMonth}-`, `${currentMonth}.`, `${currentMonth}-`, `${currentMonth}.`)
    .first<{ used: number }>();
  const boardRows = await db
    .prepare(
      `SELECT p.search_index AS searchIndex, p.category AS category, c.prompt_version AS promptVersion,
                COUNT(DISTINCT p.id) AS packs, COUNT(w.id) AS publishedWords
         FROM fib_word_packs p
         LEFT JOIN fib_word_generation_cycles c ON c.id = p.id
         LEFT JOIN fib_words w ON w.generation_cycle_id = p.id AND w.status = 'active'
         WHERE p.search_index IS NOT NULL
         GROUP BY p.search_index, p.category, c.prompt_version
         ORDER BY publishedWords DESC`,
    )
    .all();
  const leaderboardRows = parseCategoryRows(
    'fibking',
    'fib_word_packs leaderboard',
    z.array(
      z.strictObject({
        searchIndex: z.int().nonnegative(),
        category: catalogCategorySchema('fibking', FIBKING_WORD_CATEGORY_CATALOG.ids),
        promptVersion: z.string().nullable(),
        packs: z.int().nonnegative(),
        publishedWords: z.int().nonnegative(),
      }),
    ),
    boardRows.results,
  );
  const queryLeaderboard = leaderboardRows.map((r) => {
    let label = `查询 #${r.searchIndex}`;
    try {
      label = createFibWordSearchQuery(r.searchIndex);
    } catch {
      // Search plan shrank since this pack was reserved; keep the fallback label.
    }
    const details = [
      FIBKING_WORD_CATEGORY_CATALOG.names[r.category],
      r.promptVersion === null ? null : `prompt v${r.promptVersion}`,
    ].filter((value) => value !== null);
    return {
      label,
      detail: details.join(' · '),
      publishedWords: r.publishedWords,
      packs: r.packs,
    };
  });
  return {
    game: 'fibking',
    reviewDecisions: await getSubmissionReviewDecisions(db, 'fibking'),
    reviewCheckStats,
    tavilyRequestsUsed: Number(tavilyRow?.used ?? 0),
    tavilyMonthlyQuota: FIB_WORD_TAVILY_FREE_MONTHLY_CREDITS,
    queryLeaderboard,
    supplyEnabled: isWordSupplyAvailable(env, 'fibking'),
  };
}

async function getUndercoverWordStats(env: Env): Promise<DashboardBase> {
  return {
    game: 'undercover',
    tavilyRequestsUsed: null,
    tavilyMonthlyQuota: null,
    reviewDecisions: await getSubmissionReviewDecisions(env.DB, 'undercover'),
    reviewCheckStats: [],
    queryLeaderboard: [],
    supplyEnabled: isWordSupplyAvailable(env, 'undercover'),
  };
}

async function getDrawGuessWordStats(env: Env): Promise<DashboardBase> {
  return {
    game: 'drawguess',
    tavilyRequestsUsed: null,
    tavilyMonthlyQuota: null,
    reviewDecisions: await getSubmissionReviewDecisions(env.DB, 'drawguess'),
    reviewCheckStats: [],
    queryLeaderboard: [],
    supplyEnabled: isWordSupplyAvailable(env, 'drawguess'),
  };
}

async function getDecryptoWordStats(env: Env): Promise<DashboardBase> {
  return {
    game: 'decrypto',
    tavilyRequestsUsed: null,
    tavilyMonthlyQuota: null,
    reviewDecisions: await getSubmissionReviewDecisions(env.DB, 'decrypto'),
    reviewCheckStats: [],
    queryLeaderboard: [],
    supplyEnabled: isWordSupplyAvailable(env, 'decrypto'),
  };
}

const GAME_WORD_ADAPTERS = {
  fibking: {
    getStats: getFibWordStats,
    getWorkflow: (env: Env) => env.FIB_WORD_SUPPLY,
  },
  undercover: {
    getStats: getUndercoverWordStats,
    getWorkflow: (env: Env) => env.UNDERCOVER_WORD_SUPPLY,
  },
  drawguess: {
    getStats: getDrawGuessWordStats,
    getWorkflow: (env: Env) => env.DRAWGUESS_WORD_SUPPLY,
  },
  decrypto: {
    getStats: getDecryptoWordStats,
    getWorkflow: (env: Env) => env.DECRYPTO_WORD_SUPPLY,
  },
} satisfies Record<
  GameWordGame,
  {
    getStats: (env: Env) => Promise<DashboardBase>;
    getWorkflow: (env: Env) => Workflow<WordSupplyParams>;
  }
>;

/** Read the selected game's dashboard without exposing table names to callers. */
export async function getGameWordsStats(env: Env, game: GameWordGame): Promise<GameWordsStats> {
  const [stats, details] = await Promise.all([
    GAME_WORD_ADAPTERS[game].getStats(env),
    getDashboardDetails(env.DB, game),
  ]);
  return { ...stats, ...details };
}

/** Enqueue a validated manual run; workflow failures propagate to the route error handler. */
export async function triggerGameWordSupply(
  env: Env,
  input: TriggerSupplyInput,
): Promise<TriggerSupplyResult> {
  const parsed = triggerSupplySchema.parse(input);
  const day = new Date().toISOString().slice(0, 10);
  const runId = crypto.randomUUID();
  const workflowId = `${parsed.game}-manual-${runId}`;
  await GAME_WORD_ADAPTERS[parsed.game]
    .getWorkflow(env)
    .createBatch([{ id: workflowId, params: { day, runId, category: parsed.category } }]);
  return { game: parsed.game, category: parsed.category, workflowId };
}

// ── Unified library (submissions only) ───────────────────────────────────────

function encodeLibraryCursor(createdAt: string, id: string): string {
  return `${createdAt}|${id}`;
}

function decodeLibraryCursor(cursor: string): { createdAt: string; id: string } {
  const separator = cursor.lastIndexOf('|');
  if (separator <= 0 || separator === cursor.length - 1)
    throw new HTTPException(400, { message: 'INVALID_CURSOR' });
  const createdAt = cursor.slice(0, separator);
  const id = cursor.slice(separator + 1);
  if (Number.isNaN(Date.parse(createdAt)) || id.length === 0)
    throw new HTTPException(400, { message: 'INVALID_CURSOR' });
  return { createdAt, id };
}

export interface ListLibraryItemsInput {
  game: GameWordGame;
  status?: WordSubmissionStatus;
  category?: string;
  search?: string;
  cursor?: string;
}

const LIBRARY_ITEMS_PAGE_SIZE = 30;

const librarySubmissionRowSchema = z.strictObject({
  id: z.string(),
  batchId: z.string(),
  agentName: z.string(),
  title: z.string(),
  category: z.string(),
  createdAt: z.string(),
  status: z.enum([
    'pending',
    'approved',
    'reviewing',
    'passed',
    'rejected',
    'failed',
    'published',
    'dismissed',
    'unpublished',
    'duplicate',
  ]),
  duplicateOf: z.string().nullable(),
  contentHash: z.string(),
  revision: z.int().nonnegative(),
  materialJson: z.string(),
  verifiedMaterialJson: z.string().nullable(),
});

const libraryTotalsRowSchema = z.strictObject({
  status: wordSubmissionStatusSchema,
  count: z.int().nonnegative(),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function parseMaterialJson(raw: string | null): Record<string, unknown> | null {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return isRecord(parsed) ? parsed : null;
}

/** Undercover definition line, from candidate material or submission content. */
function buildUndercoverDefinition(materialJson: string | null): string | null {
  const material = parseMaterialJson(materialJson);
  if (material === null) return null;
  const traits = stringList(material.commonTraits);
  const differences = stringList(material.differences);
  if (traits.length === 0 && differences.length === 0) return null;
  const parts: string[] = [];
  if (traits.length > 0) parts.push(`共性：${traits.join('、')}`);
  if (differences.length > 0) parts.push(`差异：${differences.join('、')}`);
  return `${parts.join('。')}。`;
}

function extractFibDefinition(
  materialJson: string,
  verifiedMaterialJson: string | null,
): string | null {
  // Verified material is the review-verified wording; fall back to the
  // submitted material when the item has not been reviewed.
  for (const raw of [verifiedMaterialJson, materialJson]) {
    const material = parseMaterialJson(raw);
    if (material === null) continue;
    const definition = material.definition;
    if (!isRecord(definition)) continue;
    const coreMeaning = definition.coreMeaning;
    if (typeof coreMeaning === 'string' && coreMeaning.length > 0) return coreMeaning;
  }
  return null;
}

function extractSubmissionDefinition(
  game: GameWordGame,
  materialJson: string,
  verifiedMaterialJson: string | null,
): string | null {
  if (game === 'fibking') return extractFibDefinition(materialJson, verifiedMaterialJson);
  if (game === 'undercover') return buildUndercoverDefinition(verifiedMaterialJson ?? materialJson);
  return null;
}

/** LIKE wildcards in the search term match literally, not as patterns. */
function escapeLikeTerm(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Submission stream, oldest first, keyset-paged on (batch created_at, item
 * id). Search matches titles; category is an exact filter. Totals ignore
 * filters and cursor. Inventory never enters the stream. */
export async function listLibraryItems(
  db: D1Database,
  input: ListLibraryItemsInput,
): Promise<WordLibraryItems> {
  const searchTerm = input.search?.trim();
  const likePattern =
    searchTerm === undefined || searchTerm === '' ? null : `%${escapeLikeTerm(searchTerm)}%`;
  const cursor = input.cursor === undefined ? undefined : decodeLibraryCursor(input.cursor);

  const binds: unknown[] = [input.game];
  let where = '';
  if (input.status !== undefined) {
    where += ' AND item.status = ?';
    binds.push(input.status);
  }
  if (input.category !== undefined) {
    where += ' AND item.category = ?';
    binds.push(input.category);
  }
  if (likePattern !== null) {
    where += ` AND item.title LIKE ? ESCAPE '\\'`;
    binds.push(likePattern);
  }
  if (cursor !== undefined) {
    where += ' AND (batch.created_at, item.id) > (?, ?)';
    binds.push(cursor.createdAt, cursor.id);
  }
  const rows = await db
    .prepare(
      `SELECT item.id, item.batch_id AS batchId, agent.name AS agentName, item.title, item.category,
        batch.created_at AS createdAt, item.status, item.duplicate_of AS duplicateOf,
        item.content_hash AS contentHash, item.revision,
        item.material_json AS materialJson,
        item.verified_material_json AS verifiedMaterialJson
       FROM word_submission_items item
       JOIN word_submission_batches batch ON batch.id = item.batch_id
       JOIN word_submission_agents agent ON agent.id = batch.agent_id
       WHERE item.game = ?${where}
       ORDER BY batch.created_at, item.id LIMIT ${LIBRARY_ITEMS_PAGE_SIZE + 1}`,
    )
    .bind(...binds)
    .all();
  const parsed = z.array(librarySubmissionRowSchema).parse(rows.results);
  const page = parsed.slice(0, LIBRARY_ITEMS_PAGE_SIZE);
  const last = page[page.length - 1];

  const totalsRows = await db
    .prepare(
      `SELECT status, COUNT(*) AS count
       FROM word_submission_items WHERE game = ?
       GROUP BY status ORDER BY status`,
    )
    .bind(input.game)
    .all();
  const submissionTotals: Partial<Record<WordSubmissionStatus, number>> = {};
  for (const row of z.array(libraryTotalsRowSchema).parse(totalsRows.results)) {
    submissionTotals[row.status] = (submissionTotals[row.status] ?? 0) + row.count;
  }

  return {
    game: input.game,
    items: page.map((row) => ({
      id: row.id,
      batchId: row.batchId,
      agentName: row.agentName,
      game: input.game,
      title: row.title,
      category: row.category,
      definition: extractSubmissionDefinition(
        input.game,
        row.materialJson,
        row.verifiedMaterialJson,
      ),
      createdAt: row.createdAt,
      status: row.status,
      duplicateOf: row.duplicateOf,
      contentHash: row.contentHash,
      revision: row.revision,
    })),
    totals: { submissions: submissionTotals },
    nextCursor:
      parsed.length > LIBRARY_ITEMS_PAGE_SIZE && last !== undefined
        ? encodeLibraryCursor(last.createdAt, last.id)
        : null,
  };
}
