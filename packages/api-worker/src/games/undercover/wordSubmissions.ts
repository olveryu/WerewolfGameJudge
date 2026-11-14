/** External pairs share the exact reversed-pair identity and nine-check review used by supply. */
import {
  SUBMISSION_PUBLICATION_GATE,
  type WordSubmissionAdapter,
} from '../../platform/wordSupply/submissionAdapter';
import {
  getUndercoverPairId,
  isUndercoverReviewAccepted,
  parseUndercoverCandidates,
  UNDERCOVER_WORD_BATCH_LIMIT,
  UNDERCOVER_WORD_REVIEW_VERSION,
  undercoverCandidateSchema,
} from './wordEditorial';
import { createUndercoverWordProvider, UNDERCOVER_WORD_MODEL } from './wordProvider';

export const undercoverSubmissionAdapter: WordSubmissionAdapter = {
  game: 'undercover',
  inputSchema: undercoverCandidateSchema,
  model: UNDERCOVER_WORD_MODEL,
  reviewVersion: UNDERCOVER_WORD_REVIEW_VERSION,
  reviewBatchLimit: UNDERCOVER_WORD_BATCH_LIMIT,
  inventoryExistsSql: 'EXISTS (SELECT 1 FROM undercover_word_pairs WHERE id = item.identity)',
  async normalize(value) {
    const input = undercoverCandidateSchema.parse(value);
    const [candidate] = parseUndercoverCandidates({ candidates: [input] }, input.category);
    if (candidate === undefined) throw new Error('Undercover candidate was not normalized');
    return {
      identity: await getUndercoverPairId(candidate.wordA, candidate.wordB),
      title: `${candidate.wordA} / ${candidate.wordB}`,
      category: candidate.category,
      content: candidate,
    };
  },
  async review(env, contents, context) {
    const candidates = contents.map((content) => undercoverCandidateSchema.parse(content));
    const first = candidates[0];
    if (first === undefined) throw new Error('Cannot review an empty Undercover submission group');
    const reviews = await createUndercoverWordProvider(env.GEMINI_API_KEY).reviewBatch(
      first.category,
      candidates,
      context,
    );
    return reviews.map((review, index) => {
      const candidate = candidates[index];
      if (candidate === undefined) throw new Error('Undercover review result lacks its candidate');
      return {
        review: {
          passed: isUndercoverReviewAccepted(review),
          canOverride: true,
          reason: review.reason,
          checks: review.qualityChecks,
          details: { commonTraits: review.commonTraits, differences: review.differences },
        },
        verifiedContent: candidate,
      };
    });
  },
  publish(db, publication) {
    const candidate = undercoverCandidateSchema.parse(
      publication.approvalReason !== null ? publication.content : publication.verifiedContent,
    );
    return [
      db
        .prepare(
          `INSERT INTO undercover_word_pairs
        (id, word_a, word_b, category, status, created_at, reviewed_at, review_json)
        SELECT ?, ?, ?, ?, 'active', ?, ?, ? WHERE ${SUBMISSION_PUBLICATION_GATE}`,
        )
        .bind(
          publication.identity,
          candidate.wordA,
          candidate.wordB,
          candidate.category,
          publication.now,
          publication.now,
          JSON.stringify(
            publication.approvalReason !== null
              ? {
                  actor: 'shared-admin',
                  reason: publication.approvalReason,
                  modelReview: publication.review,
                }
              : publication.review,
          ),
          publication.itemId,
          publication.actionId,
        ),
    ];
  },
  unpublish(db, publication) {
    return [
      db
        .prepare(
          `UPDATE undercover_word_pairs SET status = 'disabled', reviewed_at = ?
        WHERE id = ? AND ${SUBMISSION_PUBLICATION_GATE}`,
        )
        .bind(publication.now, publication.identity, publication.itemId, publication.actionId),
    ];
  },
};
