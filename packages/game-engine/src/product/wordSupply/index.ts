/** Shared word-supply admin contracts; no storage, workflow, or UI dependencies. */

import type { GameWordGame } from './games';

export * from './games';
export * from './submissions';

/** Dashboard response shared by the Worker and admin client. */
export interface GameWordsStats {
  game: GameWordGame;
  categories: Array<{
    id: string;
    name: string;
    active: number;
    total: number;
    pending: number;
    batches: number;
    yieldCount: number;
    lastAttempt: string | null;
    coolingDown: boolean;
    menuEligible: boolean | null;
  }>;
  modelBudget: { dailyUsed: number; dailyLimit: number; monthlyUsed: number; monthlyLimit: number };
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
