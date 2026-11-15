/** Shared word-supply admin contracts; no storage, workflow, or UI dependencies. */

import type { GameWordGame } from './games';
import type { WordSubmissionStatus } from './submissions';

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

/** Candidate states the admin list can filter by. Manual review and publish
 * (the single road from approval to inventory) add 'reviewing' (a manual
 * model review is in flight), 'passed' (review accepted, awaiting manual
 * publish), 'failed' (review errored, retryable), and 'published'
 * (inventory written by manual publish); 'accepted' is the legacy
 * undercover/drawguess publish state, 'claimed' a legacy pack-claim state. */
export type WordCandidateListStatus =
  | 'pending'
  | 'approved'
  | 'claimed'
  | 'reviewing'
  | 'passed'
  | 'accepted'
  | 'rejected'
  | 'failed'
  | 'published';

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

/** One manual review call: up to five approved (or failed, for retry, or
 * passed, for re-review after a review-version change) candidates, grouped
 * by category and reviewed one model call each. */
export interface ReviewWordCandidatesResult {
  game: GameWordGame;
  /** Review accepted: the candidate awaits manual publish. */
  passedIds: string[];
  /** Review rejected: the candidate stays rejected. */
  rejectedIds: string[];
  /** Review errored (model/service): the candidate returns to 'failed' and can be retried. */
  failedIds: string[];
  /** Requested ids that were not approved/failed, unknown, or already reviewed. */
  skippedIds: string[];
}

/** One manual publish call: up to thirty passed candidates, written to the
 * inventory in a single transaction. */
export interface PublishWordCandidatesResult {
  game: GameWordGame;
  publishedIds: string[];
  /** Passed candidates whose stored review no longer passes the publish gate
   * (e.g. a rejected review, a stale review version, or no pinyin). */
  rejectedIds: string[];
  /** Requested ids that were not passed or unknown. */
  skippedIds: string[];
}

export interface DismissWordCandidatesResult {
  game: GameWordGame;
  dismissedIds: string[];
  /** Requested ids that were not pending, unknown, or already dismissed. */
  skippedIds: string[];
}

/** Which queue a unified-library row came from. */
export type WordLibraryItemSource = 'candidate' | 'submission';

/** One row of the merged FIFO stream: a supply candidate or a submission item.
 * The card stream shows no inventory rows; inventory appears as numbers only. */
export interface WordLibraryItem {
  /** 'candidate:<id>' or 'submission:<uuid>'; unique across both sources in one game. */
  key: string;
  source: WordLibraryItemSource;
  /** Candidate row id or submission item id. */
  id: string;
  /** Submission batch id; null for candidate rows. */
  batchId: string | null;
  /** Agent who submitted the item; null for candidate rows. */
  agentName: string | null;
  game: GameWordGame;
  title: string;
  category: string;
  /** One-line definition: fib coreMeaning, undercover common traits/differences;
   * null when the material carries none (drawguess has no definition text). */
  definition: string | null;
  /** Fibking evidence links; null for submissions and games without per-candidate evidence. */
  evidenceCount: number | null;
  createdAt: string;
  /** Candidate queue status or submission item status. */
  status: WordCandidateListStatus | WordSubmissionStatus;
  /** Submission duplicate pointer (inventory:<identity> or an earlier item id);
   * null for candidates and non-duplicates. */
  duplicateOf: string | null;
  /** Submission action payload fields; null for candidate rows. */
  contentHash: string | null;
  revision: number | null;
}

export interface WordLibraryItems {
  game: GameWordGame;
  items: WordLibraryItem[];
  /** Per-source item totals by status, across all rows (ignores search/cursor/source). */
  totals: {
    candidates: Partial<Record<WordCandidateListStatus, number>>;
    submissions: Partial<Record<WordSubmissionStatus, number>>;
  };
  /** Keyset cursor over (created_at, id); null when the list is exhausted. */
  nextCursor: string | null;
}
