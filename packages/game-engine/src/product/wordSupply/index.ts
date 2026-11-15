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
  modelBudget: {
    dailyUsed: number;
    dailyLimit: number;
    monthlyUsed: number;
    monthlyLimit: number;
    byOperation: {
      generation: { dailyUsed: number; monthlyUsed: number };
      review: { dailyUsed: number; monthlyUsed: number };
    };
  };
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

/** Candidate states the admin list can filter by. Fib candidates hold no
 * terminal review state (publish deletes the row); undercover/drawguess
 * keep accepted/rejected rows. */
export type WordCandidateListStatus = 'pending' | 'approved' | 'claimed' | 'accepted' | 'rejected';

/** A supply candidate awaiting human approval (or already approved). */
export interface WordCandidateListItem {
  id: string;
  game: GameWordGame;
  title: string;
  category: string;
  /** Fibking evidence links; null for games without per-candidate evidence. */
  evidenceCount: number | null;
  createdAt: string;
  status: WordCandidateListStatus;
}

export interface WordCandidateList {
  game: GameWordGame;
  candidates: WordCandidateListItem[];
  /** Keyset cursor over (created_at, id); null when the list is exhausted. */
  nextCursor: string | null;
}

export interface ApproveWordCandidatesResult {
  game: GameWordGame;
  approvedIds: string[];
  /** Requested ids that were already approved, unknown, or not approvable. */
  skippedIds: string[];
}

export interface DismissWordCandidatesResult {
  game: GameWordGame;
  dismissedIds: string[];
  /** Requested ids that were not pending, unknown, or already dismissed. */
  skippedIds: string[];
}
