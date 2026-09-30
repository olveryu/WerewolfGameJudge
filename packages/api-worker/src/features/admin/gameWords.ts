/**
 * Admin word-supply dashboard backend.
 *
 * Per-game supply stats (fibking / undercover) and manual supply triggers.
 * Game names are whitelisted to table/binding mappings — user input never
 * reaches SQL or env bindings directly.
 */

import { z } from 'zod';

import type { Env } from '../../env';
import {
  FIB_WORD_MONTHLY_BATCH_LIMIT,
  FIB_WORD_MONTHLY_TARGET,
} from '../../games/fibking/wordPublication';
import { FIB_WORD_REVIEW_VERSION } from '../../games/fibking/wordProviders/prompt';
import { createFibWordSearchQuery } from '../../games/fibking/wordSearchPlan';

const GAME_WORD_GAMES = ['fibking', 'undercover'] as const;
export type GameWordGame = (typeof GAME_WORD_GAMES)[number];

export const gameWordGameSchema = z.enum(GAME_WORD_GAMES);

export const triggerSupplySchema = z.strictObject({
  game: gameWordGameSchema,
  force: z.boolean().optional(),
});
export type TriggerSupplyInput = z.output<typeof triggerSupplySchema>;

export interface GameWordsStats {
  game: GameWordGame;
  wordsByCategory: Array<{ category: string; active: number; total: number }>;
  /** Null for games without a monthly budget (undercover). */
  monthlySupply: {
    month: string;
    reserved: number;
    published: number;
    batchLimit: number;
    wordTarget: number;
  } | null;
  reviewDecisions: Array<{ decision: string; count: number }>;
  /**
   * Fibking only: how many rejected reviews failed each quality check in the
   * last 30 days under the current review rubric. Empty for undercover.
   */
  reviewCheckStats: Array<{ check: string; failCount: number }>;
  /** Per search query (fibking) or per category (undercover). */
  queryLeaderboard: Array<{
    label: string;
    detail: string | null;
    publishedWords: number;
    /** Packs attempted (reserved) for this row; denominator of the yield rate. */
    packs: number;
  }>;
  supplyEnabled: boolean;
}

async function queryWordsByCategory(
  db: D1Database,
  wordsTable: string,
): Promise<GameWordsStats['wordsByCategory']> {
  const rows = await db
    .prepare(
      `SELECT category, SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active, COUNT(*) AS total
       FROM ${wordsTable} GROUP BY category ORDER BY category`,
    )
    .all<{ category: string; active: number; total: number }>();
  return (rows.results ?? []).map((r) => ({
    category: r.category,
    active: Number(r.active),
    total: Number(r.total),
  }));
}

export async function getGameWordsStats(env: Env, game: GameWordGame): Promise<GameWordsStats> {
  const db = env.DB;
  if (game === 'fibking') {
    const wordsByCategory = await queryWordsByCategory(db, 'fib_words');
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
    const boardRows = await db
      .prepare(
        `SELECT p.search_index AS searchIndex, c.prompt_version AS promptVersion,
                COUNT(DISTINCT p.id) AS packs, COUNT(w.id) AS publishedWords
         FROM fib_word_packs p
         LEFT JOIN fib_word_generation_cycles c ON c.id = p.id
         LEFT JOIN fib_words w ON w.generation_cycle_id = p.id AND w.status = 'active'
         WHERE p.search_index IS NOT NULL
         GROUP BY p.search_index, c.prompt_version
         ORDER BY publishedWords DESC`,
      )
      .all<{
        searchIndex: number;
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
      return {
        label,
        detail: r.promptVersion === null ? null : `prompt v${r.promptVersion}`,
        publishedWords: Number(r.publishedWords),
        packs: Number(r.packs),
      };
    });
    return {
      game,
      wordsByCategory,
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
      queryLeaderboard,
      supplyEnabled: env.FIB_WORD_SUPPLY_ENABLED === 'true',
    };
  }

  // undercover: no monthly budget; category is chosen dynamically per pack.
  const wordsByCategory = await queryWordsByCategory(db, 'undercover_word_pairs');
  const reviewRows = await db
    .prepare(
      `SELECT status AS decision, COUNT(*) AS count FROM undercover_word_candidates
       WHERE reviewed_at >= datetime('now', '-30 days') AND status IN ('accepted', 'rejected')
       GROUP BY status ORDER BY status`,
    )
    .all<{ decision: string; count: number }>();
  const boardRows = await db
    .prepare(
      `SELECT p.category AS category,
              COUNT(DISTINCT p.id) AS packs, COUNT(DISTINCT pair.id) AS publishedPairs
       FROM undercover_word_packs p
       LEFT JOIN undercover_word_candidates c
         ON c.claimed_pack_id = p.id AND c.status = 'accepted'
       LEFT JOIN undercover_word_pairs pair ON pair.id = c.id AND pair.status = 'active'
       GROUP BY p.category ORDER BY publishedPairs DESC`,
    )
    .all<{ category: string; packs: number; publishedPairs: number }>();
  return {
    game,
    wordsByCategory,
    monthlySupply: null,
    reviewDecisions: (reviewRows.results ?? []).map((r) => ({
      decision: r.decision,
      count: Number(r.count),
    })),
    reviewCheckStats: [],
    queryLeaderboard: (boardRows.results ?? []).map((r) => ({
      label: r.category,
      detail: 'active 词对',
      publishedWords: Number(r.publishedPairs),
      packs: Number(r.packs),
    })),
    supplyEnabled: env.UNDERCOVER_WORD_SUPPLY_ENABLED === 'true',
  };
}

export async function triggerGameWordSupply(
  env: Env,
  input: TriggerSupplyInput,
): Promise<{ game: GameWordGame; force: boolean; workflowId: string }> {
  const parsed = triggerSupplySchema.parse(input);
  const force = parsed.force === true;
  const day = new Date().toISOString().slice(0, 10);
  const runId = crypto.randomUUID();
  const workflowId = `${parsed.game}-manual-${Date.now()}`;
  if (parsed.game === 'fibking') {
    await env.FIB_WORD_SUPPLY.createBatch([{ id: workflowId, params: { day, force, runId } }]);
  } else {
    await env.UNDERCOVER_WORD_SUPPLY.createBatch([
      { id: workflowId, params: { day, force, runId } },
    ]);
  }
  return { game: parsed.game, force, workflowId };
}
