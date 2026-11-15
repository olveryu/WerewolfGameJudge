/**
 * Manual candidate review/publish for undercover, composed in the Worker
 * game catalog. The shared pair implementation lives in
 * platform/wordSupply/candidateReviewAdapter; this file only supplies the
 * game's provider, parsers, versions, and inventory statement.
 */
import type { UndercoverCategory } from '@game-judge/game-engine/games/undercover/public';
import { UNDERCOVER_CATEGORIES } from '@game-judge/game-engine/games/undercover/public';
import { z } from 'zod';

import {
  type PairCandidateDeps,
  publishPairCandidates,
  reviewPairCandidate,
  type StoredCandidateReview,
  type WordCandidateReviewAdapter,
} from '../../platform/wordSupply/candidateReviewAdapter';
import {
  getUndercoverPairId,
  isUndercoverReviewAccepted,
  parseUndercoverCandidates,
  parseUndercoverReviews,
  UNDERCOVER_WORD_PROMPT_VERSION,
  UNDERCOVER_WORD_REVIEW_VERSION,
  type UndercoverWordCandidate,
  type UndercoverWordReview,
} from './wordEditorial';
import { createUndercoverWordProvider, UNDERCOVER_WORD_MODEL } from './wordProvider';

const deps: PairCandidateDeps<UndercoverWordCandidate, UndercoverWordReview, UndercoverCategory> = {
  game: 'undercover',
  table: 'undercover_word_candidates',
  model: UNDERCOVER_WORD_MODEL,
  reviewVersion: UNDERCOVER_WORD_REVIEW_VERSION,
  promptVersion: UNDERCOVER_WORD_PROMPT_VERSION,
  parseCategory: (value) => z.enum(UNDERCOVER_CATEGORIES).parse(value),
  createProvider: createUndercoverWordProvider,
  parseCandidates: parseUndercoverCandidates,
  parseReviews: parseUndercoverReviews,
  isReviewAccepted: isUndercoverReviewAccepted,
  getCandidateId: (candidate) => getUndercoverPairId(candidate.wordA, candidate.wordB),
  buildInventory: async (db, candidate, stored: StoredCandidateReview, now) => {
    const pairId = await getUndercoverPairId(candidate.wordA, candidate.wordB);
    return {
      kind: 'statement',
      statement: db
        .prepare(
          `INSERT INTO undercover_word_pairs
             (id, word_a, word_b, category, status, created_at, reviewed_at, review_json)
           VALUES (?, ?, ?, ?, 'active', ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             category = excluded.category, status = 'active',
             reviewed_at = excluded.reviewed_at, review_json = excluded.review_json`,
        )
        .bind(
          pairId,
          candidate.wordA,
          candidate.wordB,
          candidate.category,
          now,
          now,
          JSON.stringify(stored),
        ),
    };
  },
};

export const undercoverCandidateReviewAdapter: WordCandidateReviewAdapter = {
  game: 'undercover',
  model: UNDERCOVER_WORD_MODEL,
  reviewVersion: UNDERCOVER_WORD_REVIEW_VERSION,
  reviewCandidate: (db, env, candidateId, context) =>
    reviewPairCandidate(db, env, candidateId, deps, context),
  publishCandidates: (db, candidateIds) => publishPairCandidates(db, candidateIds, deps),
};
