/** Shared word-supply admin contracts; no storage, workflow, or UI dependencies. */

import type { GameType } from '../../platform/protocol/gameTypes';

export const GAME_WORD_GAMES = [
  'fibking',
  'undercover',
  'drawguess',
] as const satisfies readonly GameType[];

export type GameWordGame = (typeof GAME_WORD_GAMES)[number];

/** Narrow an untrusted value to a supported word-supply game. */
export function isGameWordGame(value: unknown): value is GameWordGame {
  return GAME_WORD_GAMES.some((game) => game === value);
}

/** Dashboard response shared by the Worker and admin client. */
export interface GameWordsStats {
  game: GameWordGame;
  wordsByCategory: Array<{ category: string; active: number; total: number }>;
  /** Null for games without a monthly budget. */
  monthlySupply: {
    month: string;
    reserved: number;
    published: number;
    batchLimit: number;
    wordTarget: number;
  } | null;
  /** This month's Tavily usage, an upper bound on credits; null when unused. */
  tavilyRequestsUsed: number | null;
  /** Tavily free-plan monthly credit quota; null when unused. */
  tavilyMonthlyQuota: number | null;
  reviewDecisions: Array<{ decision: string; count: number }>;
  /** Rejected-review check failures under the current rubric; empty when unused. */
  reviewCheckStats: Array<{ check: string; failCount: number }>;
  queryLeaderboard: Array<{
    label: string;
    detail: string | null;
    publishedWords: number;
    /** Packs attempted for this row; denominator of the yield rate. */
    packs: number;
  }>;
  supplyEnabled: boolean;
}

/** Accepted manual workflow trigger response. */
export interface TriggerSupplyResult {
  game: GameWordGame;
  force: boolean;
  workflowId: string;
}
