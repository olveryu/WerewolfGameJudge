/** Shared word-supply admin contracts; no storage, workflow, or UI dependencies. */

import type { GameWordGame } from './games';
import type { WordSubmissionStatus } from './submissions';

export * from './categoryCatalog';
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
  /** Model-call usage counts; there is no ceiling — generation and review
   * are both triggered manually by an administrator. */
  modelBudget: {
    dailyUsed: number;
    monthlyUsed: number;
    byOperation: {
      generation: { dailyUsed: number; monthlyUsed: number };
      review: { dailyUsed: number; monthlyUsed: number };
    };
  };
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
  category: string;
  workflowId: string;
}

/** One row of the submission stream: a supply-produced or agent-submitted
 * item awaiting review. The card stream shows no inventory rows; inventory
 * appears as numbers only. */
export interface WordLibraryItem {
  /** Submission item id. */
  id: string;
  /** Submission batch id. */
  batchId: string;
  /** Agent who submitted the item; '系统补词' for supply-produced items. */
  agentName: string;
  game: GameWordGame;
  title: string;
  category: string;
  /** One-line definition: fib coreMeaning, undercover common traits/differences;
   * null when the material carries none (drawguess has no definition text). */
  definition: string | null;
  createdAt: string;
  /** Submission item status. */
  status: WordSubmissionStatus;
  /** Submission duplicate pointer (inventory:<identity> or an earlier item id);
   * null for non-duplicates. */
  duplicateOf: string | null;
  /** Submission action payload fields. */
  contentHash: string;
  revision: number;
}

export interface WordLibraryItems {
  game: GameWordGame;
  items: WordLibraryItem[];
  /** Per-status item totals, across all rows (ignores filters and cursor). */
  totals: {
    submissions: Partial<Record<WordSubmissionStatus, number>>;
  };
  /** Keyset cursor over (created_at, id); null when the list is exhausted. */
  nextCursor: string | null;
}
