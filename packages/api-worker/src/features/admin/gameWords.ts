/**
 * Admin word-supply dashboard backend.
 *
 * Per-game supply stats and manual supply triggers through exhaustive adapters.
 * Game names are whitelisted to table/binding mappings — user input never
 * reaches SQL or env bindings directly.
 */

import {
  type ApproveWordCandidatesResult,
  type DismissWordCandidatesResult,
  GAME_WORD_GAMES,
  type GameWordGame,
  type GameWordsStats,
  type TriggerSupplyResult,
  type WordCandidateList,
  type WordCandidateListStatus,
  type WordLibraryItem,
  type WordLibraryItems,
  type WordLibraryItemSource,
  type WordSubmissionStatus,
} from '@game-judge/game-engine/product/wordSupply';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import type { Env } from '../../env';
import { FIB_WORD_REVIEW_VERSION } from '../../games/fibking/wordProviders/prompt';
import {
  FIB_WORD_MONTHLY_BATCH_LIMIT,
  FIB_WORD_MONTHLY_TARGET,
  FIB_WORD_TAVILY_FREE_MONTHLY_CREDITS,
} from '../../games/fibking/wordPublication';
import { createFibWordSearchQuery } from '../../games/fibking/wordSearchPlan';
import { FIB_WORD_TOPIC_IDS, FIB_WORD_TOPICS } from '../../games/fibking/wordTopics';
import {
  EDITORIAL_DAILY_REQUEST_LIMIT,
  EDITORIAL_MONTHLY_REQUEST_LIMIT,
  isEditorialBudgetAvailable,
  readModelBudgetByOperation,
} from '../../platform/ai/editorialBudget';
import { isWordSupplyAvailable } from '../../platform/wordSupply/automaticSupply';
import { wordCategoryCooldownCutoff } from '../../platform/wordSupply/categoryCooldown';
import type { WordSupplyParams } from '../../platform/wordSupply/wordSupplyWorkflow';
import { DRAWGUESS_DASHBOARD_CATEGORIES } from './drawGuessWordLabels';
import {
  UNDERCOVER_CATEGORY_MIN_ACTIVE_PAIRS,
  UNDERCOVER_DASHBOARD_CATEGORIES,
} from './undercoverWordLabels';

export const gameWordGameSchema = z.enum(GAME_WORD_GAMES);

export const triggerSupplySchema = z.strictObject({
  game: gameWordGameSchema,
  force: z.boolean().optional(),
});
export type TriggerSupplyInput = z.output<typeof triggerSupplySchema>;

type DashboardDetails = Pick<GameWordsStats, 'categories' | 'modelBudget'>;
type DashboardBase = Omit<GameWordsStats, keyof DashboardDetails>;

async function getDashboardDetails(db: D1Database, game: GameWordGame): Promise<DashboardDetails> {
  const isFib = game === 'fibking';
  const wordsTable = isFib
    ? 'fib_words'
    : game === 'undercover'
      ? 'undercover_word_pairs'
      : 'drawguess_words';
  const candidatesTable = isFib
    ? 'fib_word_candidates'
    : game === 'undercover'
      ? 'undercover_word_candidates'
      : 'drawguess_word_candidates';
  const packsTable = isFib
    ? 'fib_word_packs'
    : game === 'undercover'
      ? 'undercover_word_packs'
      : 'drawguess_word_packs';
  const categoryColumn = isFib ? 'topic' : 'category';
  const labels = isFib
    ? [
        ...FIB_WORD_TOPIC_IDS.map((id) => ({ id, name: FIB_WORD_TOPICS[id] })),
        { id: 'other', name: '其他' },
        { id: 'unclassified', name: '未标主题' },
      ]
    : game === 'undercover'
      ? UNDERCOVER_DASHBOARD_CATEGORIES
      : DRAWGUESS_DASHBOARD_CATEGORIES;
  const bucket = `COALESCE(${categoryColumn}, 'unclassified')`;
  const packTime = isFib ? 'search_selected_at' : 'created_at';
  const packFilter = isFib ? 'WHERE search_selected_at IS NOT NULL' : '';
  const yieldSql = isFib
    ? `SELECT COALESCE(w.topic, 'unclassified') AS category, COUNT(*) AS count
       FROM fib_word_sequence s JOIN fib_words w ON w.word = s.word
       WHERE s.pack_id IS NOT NULL GROUP BY COALESCE(w.topic, 'unclassified')`
    : `SELECT c.category, COUNT(*) AS count FROM ${candidatesTable} c
       JOIN ${wordsTable} w ON w.id = c.id AND w.status = 'active'
       WHERE c.status = 'accepted' AND c.claimed_pack_id IS NOT NULL GROUP BY c.category`;
  const now = Date.now();
  const [inventory, pending, packs, yielded, budget] = await db.batch([
    db.prepare(
      `SELECT ${bucket} AS category, SUM(status = 'active') AS active, COUNT(*) AS total FROM ${wordsTable} GROUP BY ${bucket}`,
    ),
    db.prepare(
      `SELECT ${bucket} AS category, COUNT(*) AS count FROM ${candidatesTable} WHERE status ${isFib ? "IN ('pending', 'approved', 'claimed')" : "IN ('pending', 'approved')"} GROUP BY ${bucket}`,
    ),
    db.prepare(
      `SELECT ${categoryColumn} AS category, COUNT(*) AS count, MAX(${packTime}) AS last FROM ${packsTable} ${packFilter} GROUP BY ${categoryColumn}`,
    ),
    db.prepare(yieldSql),
    db
      .prepare(
        `SELECT SUM(claimed_at > ?) AS daily, SUM(claimed_at > ?) AS monthly FROM editorial_model_requests`,
      )
      .bind(
        new Date(now - 24 * 60 * 60 * 1000).toISOString(),
        new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(),
      ),
  ]);
  const rows = z.array(
    z.strictObject({ category: z.string().nullable(), count: z.int().nonnegative() }),
  );
  const inventoryRows = z
    .array(
      z.strictObject({
        category: z.string(),
        active: z.int().nonnegative(),
        total: z.int().nonnegative(),
      }),
    )
    .parse(inventory.results);
  const pendingRows = rows.parse(pending.results);
  const packRows = z
    .array(
      z.strictObject({
        category: z.string().nullable(),
        count: z.int().nonnegative(),
        last: z.string().nullable(),
      }),
    )
    .parse(packs.results);
  const yieldRows = rows.parse(yielded.results);
  const budgetRow = z
    .strictObject({ daily: z.int().nullable(), monthly: z.int().nullable() })
    .parse(budget.results[0]);
  const byOperation = await readModelBudgetByOperation(db);
  const cutoff = wordCategoryCooldownCutoff(now);
  return {
    categories: labels.map(({ id, name }) => {
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
      dailyLimit: EDITORIAL_DAILY_REQUEST_LIMIT,
      monthlyUsed: budgetRow.monthly ?? 0,
      monthlyLimit: EDITORIAL_MONTHLY_REQUEST_LIMIT,
      byOperation,
    },
  };
}

async function getFibWordStats(env: Env): Promise<DashboardBase> {
  const db = env.DB;
  const monthRow = await db
    .prepare(
      `SELECT id AS month, requests_reserved AS reserved, published_count AS published
         FROM fib_word_supply_months ORDER BY id DESC LIMIT 1`,
    )
    .first<{ month: string; reserved: number; published: number }>();
  const reviewRows = await db
    .prepare(
      `SELECT decision, COUNT(*) AS count FROM fib_word_candidate_reviews
         WHERE reviewed_at >= datetime('now', '-30 days')
         GROUP BY decision ORDER BY decision`,
    )
    .all<{ decision: string; count: number }>();
  const checkStatsRow = await db
    .prepare(
      `SELECT
           SUM(CASE WHEN decision = 'rejected' AND is_established_term = 0 THEN 1 ELSE 0 END) AS isEstablishedTerm,
           SUM(CASE WHEN decision = 'rejected' AND is_definition_accurate = 0 THEN 1 ELSE 0 END) AS isDefinitionAccurate,
           SUM(CASE WHEN decision = 'rejected' AND is_meaning_unfamiliar_to_most_players = 0 THEN 1 ELSE 0 END) AS isMeaningUnfamiliarToMostPlayers,
           SUM(CASE WHEN decision = 'rejected' AND is_meaning_distinct_from_literal_reading = 0 THEN 1 ELSE 0 END) AS isMeaningDistinctFromLiteralReading,
           SUM(CASE WHEN decision = 'rejected' AND has_multiple_plausible_wrong_definitions = 0 THEN 1 ELSE 0 END) AS hasMultiplePlausibleWrongDefinitions,
           SUM(CASE WHEN decision = 'rejected' AND has_reveal_value = 0 THEN 1 ELSE 0 END) AS hasRevealValue
         FROM fib_word_candidate_reviews
         WHERE reviewed_at >= datetime('now', '-30 days') AND review_version = ?`,
    )
    .bind(FIB_WORD_REVIEW_VERSION)
    .first<{
      isEstablishedTerm: number | null;
      isDefinitionAccurate: number | null;
      isMeaningUnfamiliarToMostPlayers: number | null;
      isMeaningDistinctFromLiteralReading: number | null;
      hasMultiplePlausibleWrongDefinitions: number | null;
      hasRevealValue: number | null;
    }>();
  const reviewCheckStats = (
    [
      'isEstablishedTerm',
      'isDefinitionAccurate',
      'isMeaningUnfamiliarToMostPlayers',
      'isMeaningDistinctFromLiteralReading',
      'hasMultiplePlausibleWrongDefinitions',
      'hasRevealValue',
    ] as const
  ).map((check) => ({ check, failCount: Number(checkStatsRow?.[check] ?? 0) }));
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
      `SELECT p.search_index AS searchIndex, p.topic AS topic, c.prompt_version AS promptVersion,
                COUNT(DISTINCT p.id) AS packs, COUNT(w.id) AS publishedWords
         FROM fib_word_packs p
         LEFT JOIN fib_word_generation_cycles c ON c.id = p.id
         LEFT JOIN fib_words w ON w.generation_cycle_id = p.id AND w.status = 'active'
         WHERE p.search_index IS NOT NULL
         GROUP BY p.search_index, p.topic, c.prompt_version
         ORDER BY publishedWords DESC`,
    )
    .all<{
      searchIndex: number;
      topic: string | null;
      promptVersion: string | null;
      packs: number;
      publishedWords: number;
    }>();
  const queryLeaderboard = (boardRows.results ?? []).map((r) => {
    let label = `查询 #${r.searchIndex}`;
    try {
      label = createFibWordSearchQuery(r.searchIndex);
    } catch {
      // Search plan shrank since this pack was reserved; keep the fallback label.
    }
    const topic = FIB_WORD_TOPIC_IDS.find((id) => id === r.topic);
    const details = [
      topic === undefined ? '旧批次：预留查询，可能未执行' : FIB_WORD_TOPICS[topic],
      r.promptVersion === null ? null : `prompt v${r.promptVersion}`,
    ].filter((value) => value !== null);
    return {
      label,
      detail: details.join(' · '),
      publishedWords: Number(r.publishedWords),
      packs: Number(r.packs),
    };
  });
  return {
    game: 'fibking',
    monthlySupply:
      monthRow === null
        ? null
        : {
            month: monthRow.month,
            reserved: Number(monthRow.reserved),
            published: Number(monthRow.published),
            batchLimit: FIB_WORD_MONTHLY_BATCH_LIMIT,
            wordTarget: FIB_WORD_MONTHLY_TARGET,
          },
    reviewDecisions: (reviewRows.results ?? []).map((r) => ({
      decision: r.decision,
      count: Number(r.count),
    })),
    reviewCheckStats,
    tavilyRequestsUsed: Number(tavilyRow?.used ?? 0),
    tavilyMonthlyQuota: FIB_WORD_TAVILY_FREE_MONTHLY_CREDITS,
    queryLeaderboard,
    supplyEnabled: isWordSupplyAvailable(env, 'fibking'),
  };
}

async function getUndercoverWordStats(env: Env): Promise<DashboardBase> {
  const db = env.DB;
  const reviewRows = await db
    .prepare(
      `SELECT status AS decision, COUNT(*) AS count FROM undercover_word_candidates
       WHERE reviewed_at >= datetime('now', '-30 days') AND status IN ('accepted', 'rejected')
       GROUP BY status ORDER BY status`,
    )
    .all<{ decision: string; count: number }>();
  return {
    game: 'undercover',
    monthlySupply: null,
    tavilyRequestsUsed: null,
    tavilyMonthlyQuota: null,
    reviewDecisions: (reviewRows.results ?? []).map((r) => ({
      decision: r.decision,
      count: Number(r.count),
    })),
    reviewCheckStats: [],
    queryLeaderboard: [],
    supplyEnabled: isWordSupplyAvailable(env, 'undercover'),
  };
}

async function getDrawGuessWordStats(env: Env): Promise<DashboardBase> {
  const db = env.DB;
  const reviewRows = await db
    .prepare(
      `SELECT status AS decision, COUNT(*) AS count FROM drawguess_word_candidates
       WHERE reviewed_at >= datetime('now', '-30 days') AND status IN ('accepted', 'rejected')
       GROUP BY status ORDER BY status`,
    )
    .all<{ decision: string; count: number }>();
  return {
    game: 'drawguess',
    monthlySupply: null,
    tavilyRequestsUsed: null,
    tavilyMonthlyQuota: null,
    reviewDecisions: (reviewRows.results ?? []).map((r) => ({
      decision: r.decision,
      count: Number(r.count),
    })),
    reviewCheckStats: [],
    queryLeaderboard: [],
    supplyEnabled: isWordSupplyAvailable(env, 'drawguess'),
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
  const force = parsed.force === true;
  if (!force && !(await isEditorialBudgetAvailable(env.DB)))
    throw new HTTPException(429, { message: '共享模型额度已用完，请稍后重试或选择强制补词' });
  const day = new Date().toISOString().slice(0, 10);
  const runId = crypto.randomUUID();
  const workflowId = `${parsed.game}-manual-${runId}`;
  await GAME_WORD_ADAPTERS[parsed.game]
    .getWorkflow(env)
    .createBatch([{ id: workflowId, params: { day, force, runId } }]);
  return { game: parsed.game, force, workflowId };
}

// ── Candidate approval (D2) ──────────────────────────────────────────────────

/** Per-game candidate table/column map. Game names are whitelisted to table
 * mappings — user input never reaches SQL or env bindings directly. */
const WORD_CANDIDATE_TABLES = {
  fibking: {
    table: 'fib_word_candidates',
    packsTable: 'fib_word_packs',
    titleSql: 'word',
    categorySql: 'COALESCE(topic, category)',
    evidenceSql: 'json_array_length(evidence_json)',
    approveSetSql: "status = 'approved', claimed_pack_id = NULL, claimed_at = NULL",
  },
  undercover: {
    table: 'undercover_word_candidates',
    packsTable: 'undercover_word_packs',
    titleSql: "word_a || ' / ' || word_b",
    categorySql: 'category',
    evidenceSql: 'NULL',
    approveSetSql: "status = 'approved', claimed_pack_id = NULL",
  },
  drawguess: {
    table: 'drawguess_word_candidates',
    packsTable: 'drawguess_word_packs',
    titleSql: 'word',
    categorySql: 'category',
    evidenceSql: 'NULL',
    approveSetSql: "status = 'approved', claimed_pack_id = NULL",
  },
} as const;

export const approveWordCandidatesSchema = z.strictObject({
  game: gameWordGameSchema,
  candidateIds: z.array(z.string().min(1)).min(1).max(30),
  reason: z.string().check(z.trim(), z.minLength(1), z.maxLength(1000)),
});
export type ApproveWordCandidatesInput = z.output<typeof approveWordCandidatesSchema>;

export interface ListWordCandidatesInput {
  game: GameWordGame;
  status?: WordCandidateListStatus;
  cursor?: string;
}

const candidateListRowSchema = z.strictObject({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  evidenceCount: z.int().nonnegative().nullable(),
  createdAt: z.string(),
  status: z.enum(['pending', 'approved', 'claimed', 'accepted', 'rejected']),
});

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

/** List candidates awaiting (or already granted) approval, newest last, keyset-paged. */
export async function listWordCandidates(
  db: D1Database,
  input: ListWordCandidatesInput,
): Promise<WordCandidateList> {
  const adapter = WORD_CANDIDATE_TABLES[input.game];
  const status = input.status ?? 'pending';
  const binds: unknown[] = [status];
  let cursorClause = '';
  if (input.cursor !== undefined) {
    const { createdAt, id } = decodeLibraryCursor(input.cursor);
    cursorClause = ' AND (created_at, id) > (?, ?)';
    binds.push(createdAt, id);
  }
  const rows = await db
    .prepare(
      `SELECT id, ${adapter.titleSql} AS title, ${adapter.categorySql} AS category,
        ${adapter.evidenceSql} AS evidenceCount, created_at AS createdAt, status
       FROM ${adapter.table} WHERE status = ?${cursorClause}
       ORDER BY created_at, id LIMIT 31`,
    )
    .bind(...binds)
    .all();
  const parsed = z.array(candidateListRowSchema).parse(rows.results);
  const page = parsed.slice(0, 30);
  const last = page[page.length - 1];
  return {
    game: input.game,
    candidates: page.map((item) => ({ ...item, game: input.game })),
    nextCursor:
      parsed.length > 30 && last !== undefined
        ? encodeLibraryCursor(last.createdAt, last.id)
        : null,
  };
}

export interface ListLibraryItemsInput {
  game: GameWordGame;
  source?: WordLibraryItemSource;
  status?: WordCandidateListStatus | WordSubmissionStatus;
  search?: string;
  cursor?: string;
}

const LIBRARY_ITEMS_PAGE_SIZE = 30;

/** Per-game candidate definition columns. Fib stores the definition as
 * columns; undercover stores the whole candidate JSON in material_json;
 * drawguess carries no definition text, so its card omits the line. */
const WORD_LIBRARY_CANDIDATE_COLUMNS = {
  fibking: { definitionSql: 'core_meaning', materialSql: 'NULL' },
  undercover: { definitionSql: 'NULL', materialSql: 'material_json' },
  drawguess: { definitionSql: 'NULL', materialSql: 'NULL' },
} as const;

const libraryCandidateRowSchema = z.strictObject({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  definition: z.string().nullable(),
  materialJson: z.string().nullable(),
  evidenceCount: z.int().nonnegative().nullable(),
  createdAt: z.string(),
  status: z.enum(['pending', 'approved', 'claimed', 'accepted', 'rejected']),
});

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
  status: z.string(),
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

function compareLibraryItems(a: WordLibraryItem, b: WordLibraryItem): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return a.key < b.key ? -1 : 1;
}

/** Merged FIFO stream of supply candidates and submission items, oldest first.
 * Each side is keyset-paged on (created_at, id) with the same cursor, then
 * merged and cut to one page; a status value that belongs to one side only
 * simply matches no rows on the other side. Search matches a row's title or
 * its displayed category (fibking: topic, else category) on either side.
 * Totals ignore search, cursor, and source, so the stats and flow bars stay
 * stable while paging or filtering. Inventory never enters the stream; it
 * appears as numbers only. */
export async function listLibraryItems(
  db: D1Database,
  input: ListLibraryItemsInput,
): Promise<WordLibraryItems> {
  const adapter = WORD_CANDIDATE_TABLES[input.game];
  const columns = WORD_LIBRARY_CANDIDATE_COLUMNS[input.game];
  const includeCandidates = input.source !== 'submission';
  const includeSubmissions = input.source !== 'candidate';
  const searchTerm = input.search?.trim();
  const likePattern =
    searchTerm === undefined || searchTerm === '' ? null : `%${escapeLikeTerm(searchTerm)}%`;
  const cursor = input.cursor === undefined ? undefined : decodeLibraryCursor(input.cursor);

  const candidateRows: z.output<typeof libraryCandidateRowSchema>[] = [];
  if (includeCandidates) {
    const binds: unknown[] = [];
    let where = '';
    if (input.status !== undefined) {
      where += ' AND status = ?';
      binds.push(input.status);
    }
    if (likePattern !== null) {
      where += ` AND (${adapter.titleSql} LIKE ? ESCAPE '\\' OR ${adapter.categorySql} LIKE ? ESCAPE '\\')`;
      binds.push(likePattern, likePattern);
    }
    if (cursor !== undefined) {
      where += ' AND (created_at, id) > (?, ?)';
      binds.push(cursor.createdAt, cursor.id);
    }
    const rows = await db
      .prepare(
        `SELECT id, ${adapter.titleSql} AS title, ${adapter.categorySql} AS category,
          ${columns.definitionSql} AS definition, ${columns.materialSql} AS materialJson,
          ${adapter.evidenceSql} AS evidenceCount, created_at AS createdAt, status
         FROM ${adapter.table} WHERE 1 = 1${where}
         ORDER BY created_at, id LIMIT ${LIBRARY_ITEMS_PAGE_SIZE + 1}`,
      )
      .bind(...binds)
      .all();
    candidateRows.push(...z.array(libraryCandidateRowSchema).parse(rows.results));
  }

  const submissionRows: z.output<typeof librarySubmissionRowSchema>[] = [];
  if (includeSubmissions) {
    const binds: unknown[] = [input.game];
    let where = '';
    if (input.status !== undefined) {
      where += ' AND item.status = ?';
      binds.push(input.status);
    }
    if (likePattern !== null) {
      where += ` AND (item.title LIKE ? ESCAPE '\\' OR item.category LIKE ? ESCAPE '\\')`;
      binds.push(likePattern, likePattern);
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
    submissionRows.push(...z.array(librarySubmissionRowSchema).parse(rows.results));
  }

  const merged: WordLibraryItem[] = [
    ...candidateRows.map((row) => ({
      key: `candidate:${row.id}`,
      source: 'candidate' as const,
      id: row.id,
      batchId: null,
      agentName: null,
      game: input.game,
      title: row.title,
      category: row.category,
      definition: row.definition ?? buildUndercoverDefinition(row.materialJson),
      evidenceCount: row.evidenceCount,
      createdAt: row.createdAt,
      status: row.status,
      duplicateOf: null,
      contentHash: null,
      revision: null,
    })),
    ...submissionRows.map((row) => ({
      key: `submission:${row.id}`,
      source: 'submission' as const,
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
      evidenceCount: null,
      createdAt: row.createdAt,
      status: row.status,
      duplicateOf: row.duplicateOf,
      contentHash: row.contentHash,
      revision: row.revision,
    })),
  ].sort(compareLibraryItems);
  const page = merged.slice(0, LIBRARY_ITEMS_PAGE_SIZE);
  const last = page[page.length - 1];

  const [candidateTotalsRows, submissionTotalsRows] = await Promise.all([
    db.prepare(`SELECT status, COUNT(*) AS count FROM ${adapter.table} GROUP BY status`).all(),
    db
      .prepare(
        'SELECT status, COUNT(*) AS count FROM word_submission_items WHERE game = ? GROUP BY status',
      )
      .bind(input.game)
      .all(),
  ]);
  const candidateTotals: Partial<Record<WordCandidateListStatus, number>> = {};
  for (const row of z.array(libraryTotalsRowSchema).parse(candidateTotalsRows.results)) {
    const status = z
      .enum(['pending', 'approved', 'claimed', 'accepted', 'rejected'])
      .parse(row.status);
    candidateTotals[status] = row.count;
  }
  const submissionTotals: Partial<Record<WordSubmissionStatus, number>> = {};
  for (const row of z.array(libraryTotalsRowSchema).parse(submissionTotalsRows.results)) {
    const status = z
      .enum([
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
      ])
      .parse(row.status);
    submissionTotals[status] = row.count;
  }

  return {
    game: input.game,
    items: page,
    totals: { candidates: candidateTotals, submissions: submissionTotals },
    nextCursor:
      merged.length > LIBRARY_ITEMS_PAGE_SIZE && last !== undefined
        ? encodeLibraryCursor(last.createdAt, last.id)
        : null,
  };
}

function candidateApprovalEligibilitySql(table: string, packsTable: string): string {
  return `(${table}.status = 'pending'
    OR (${table}.status = 'claimed' AND (${table}.claimed_pack_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM ${packsTable} pack
      WHERE pack.id = ${table}.claimed_pack_id AND pack.status <> 'failed'
    ))))`;
}

/** Approve pending (or stuck-claimed) candidates for review; audit each approval.
 * A claimed candidate is only stuck — and only approvable — when its pack is
 * failed or gone. Approving one whose pack is still running would clear the
 * claim mid-flight and break the pack's publish/delete matching. */
export async function approveWordCandidates(
  db: D1Database,
  input: ApproveWordCandidatesInput,
): Promise<ApproveWordCandidatesResult> {
  const adapter = WORD_CANDIDATE_TABLES[input.game];
  const candidateIds = [...new Set(input.candidateIds)];
  const placeholders = candidateIds.map(() => '?').join(', ');
  const eligibilitySql = candidateApprovalEligibilitySql(adapter.table, adapter.packsTable);
  const requestId = crypto.randomUUID();
  const now = new Date().toISOString();
  const auditStatements = candidateIds.map((id) =>
    db
      .prepare(
        `INSERT INTO word_candidate_approvals
          (id, request_id, game, candidate_id, reason, created_at)
         SELECT ?, ?, ?, ?, ?, ?
         WHERE EXISTS (
           SELECT 1 FROM ${adapter.table}
           WHERE ${adapter.table}.id = ? AND ${eligibilitySql}
         )`,
      )
      .bind(crypto.randomUUID(), requestId, input.game, id, input.reason, now, id),
  );
  const results = await db.batch([
    ...auditStatements,
    db
      .prepare(
        `UPDATE ${adapter.table} SET ${adapter.approveSetSql}
         WHERE id IN (${placeholders}) AND ${eligibilitySql}
         RETURNING id`,
      )
      .bind(...candidateIds),
  ]);
  const updateResult = results[results.length - 1];
  if (updateResult === undefined) throw new Error('Candidate approval result missing');
  const approvedIds = z
    .array(z.strictObject({ id: z.string() }))
    .parse(updateResult.results)
    .map((row) => row.id);
  const approvedSet = new Set(approvedIds);
  const skippedIds = [...new Set(input.candidateIds.filter((id) => !approvedSet.has(id)))];
  return { game: input.game, approvedIds, skippedIds };
}

export const dismissWordCandidatesSchema = z.strictObject({
  game: gameWordGameSchema,
  candidateIds: z.array(z.string().min(1)).min(1).max(30),
  reason: z.string().check(z.trim(), z.minLength(1), z.maxLength(1000)),
});
export type DismissWordCandidatesInput = z.output<typeof dismissWordCandidatesSchema>;

/** Dismiss pending candidates: delete the queue row and audit the reason.
 * Only 'pending' rows are eligible — a claimed candidate belongs to a
 * running pack, and an approved one is already headed for the next run.
 * Deletion (not a status flip) fits all three games: fib candidates hold
 * no terminal review state and are deleted at publish too, and no table
 * references a candidate row. */
export async function dismissWordCandidates(
  db: D1Database,
  input: DismissWordCandidatesInput,
): Promise<DismissWordCandidatesResult> {
  const adapter = WORD_CANDIDATE_TABLES[input.game];
  const candidateIds = [...new Set(input.candidateIds)];
  const placeholders = candidateIds.map(() => '?').join(', ');
  const eligibilitySql = "status = 'pending'";
  const requestId = crypto.randomUUID();
  const now = new Date().toISOString();
  const auditStatements = candidateIds.map((id) =>
    db
      .prepare(
        `INSERT INTO word_candidate_dismissals
          (id, request_id, game, candidate_id, reason, created_at)
         SELECT ?, ?, ?, ?, ?, ?
         WHERE EXISTS (
           SELECT 1 FROM ${adapter.table} WHERE id = ? AND ${eligibilitySql}
         )`,
      )
      .bind(crypto.randomUUID(), requestId, input.game, id, input.reason, now, id),
  );
  const results = await db.batch([
    ...auditStatements,
    db
      .prepare(
        `DELETE FROM ${adapter.table} WHERE id IN (${placeholders}) AND ${eligibilitySql}
         RETURNING id`,
      )
      .bind(...candidateIds),
  ]);
  const deleteResult = results[results.length - 1];
  if (deleteResult === undefined) throw new Error('Candidate dismissal result missing');
  const dismissedIds = z
    .array(z.strictObject({ id: z.string() }))
    .parse(deleteResult.results)
    .map((row) => row.id);
  const dismissedSet = new Set(dismissedIds);
  const skippedIds = [...new Set(input.candidateIds.filter((id) => !dismissedSet.has(id)))];
  return { game: input.game, dismissedIds, skippedIds };
}
