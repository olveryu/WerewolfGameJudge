/**
 * Manual candidate review/publish for drawguess, composed in the Worker
 * game catalog. The shared pair implementation lives in
 * platform/wordSupply/candidateReviewAdapter; this file only supplies the
 * game's provider, parsers, versions, and inventory statement.
 *
 * Pinyin initials are computed here, at publish time: a word whose
 * initials cannot be computed can never enter the inventory, so it is
 * rejected and a live inventory word with the same id is retired — the
 * same rule the old supply-pack publish applied.
 */
import type { DrawGuessWordCategory } from '@game-judge/game-engine/games/drawguess/public';
import { DRAWGUESS_WORD_CATEGORIES } from '@game-judge/game-engine/games/drawguess/public';
import { z } from 'zod';

import {
  type PairCandidateDeps,
  publishPairCandidates,
  reviewPairCandidate,
  type StoredCandidateReview,
  type WordCandidateReviewAdapter,
} from '../../platform/wordSupply/candidateReviewAdapter';
import {
  DRAWGUESS_WORD_PROMPT_VERSION,
  DRAWGUESS_WORD_REVIEW_VERSION,
  type DrawGuessWordCandidate,
  type DrawGuessWordReview,
  getDrawGuessWordId,
  isDrawGuessReviewAccepted,
  parseDrawGuessCandidates,
  parseDrawGuessReviews,
  toPinyinInitials,
} from './wordEditorial';
import { createDrawGuessWordProvider, DRAWGUESS_WORD_MODEL } from './wordProvider';

const deps: PairCandidateDeps<DrawGuessWordCandidate, DrawGuessWordReview, DrawGuessWordCategory> =
  {
    game: 'drawguess',
    table: 'drawguess_word_candidates',
    model: DRAWGUESS_WORD_MODEL,
    reviewVersion: DRAWGUESS_WORD_REVIEW_VERSION,
    promptVersion: DRAWGUESS_WORD_PROMPT_VERSION,
    parseCategory: (value) => z.enum(DRAWGUESS_WORD_CATEGORIES).parse(value),
    createProvider: createDrawGuessWordProvider,
    parseCandidates: parseDrawGuessCandidates,
    parseReviews: parseDrawGuessReviews,
    isReviewAccepted: isDrawGuessReviewAccepted,
    getCandidateId: (candidate) => getDrawGuessWordId(candidate.word),
    buildInventory: async (db, candidate, _stored: StoredCandidateReview, now) => {
      const wordId = await getDrawGuessWordId(candidate.word);
      let pinyin: string | null = null;
      try {
        pinyin = toPinyinInitials(candidate.word);
      } catch {
        // Pinyin failure means the word can never enter the inventory.
        pinyin = null;
      }
      if (pinyin === null) {
        return {
          kind: 'unpublishable',
          statements: [
            db
              .prepare(
                `UPDATE drawguess_words SET status = 'disabled', disabled_at = ?
               WHERE id = ? AND status = 'active'`,
              )
              .bind(now, wordId),
          ],
        };
      }
      return {
        kind: 'statement',
        statement: db
          .prepare(
            `INSERT INTO drawguess_words
             (id, word, pinyin_initials, category, difficulty, status, created_at, disabled_at)
           VALUES (?, ?, ?, ?, ?, 'active', ?, NULL)
           ON CONFLICT(id) DO UPDATE SET
             pinyin_initials = excluded.pinyin_initials,
             category = excluded.category,
             difficulty = excluded.difficulty, status = 'active',
             disabled_at = NULL`,
          )
          .bind(wordId, candidate.word, pinyin, candidate.category, candidate.difficulty, now),
      };
    },
  };

export const drawGuessCandidateReviewAdapter: WordCandidateReviewAdapter = {
  game: 'drawguess',
  model: DRAWGUESS_WORD_MODEL,
  reviewVersion: DRAWGUESS_WORD_REVIEW_VERSION,
  reviewCandidate: (db, env, candidateId, context) =>
    reviewPairCandidate(db, env, candidateId, deps, context),
  publishCandidates: (db, candidateIds) => publishPairCandidates(db, candidateIds, deps),
};
