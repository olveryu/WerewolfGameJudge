/** External Decrypto submissions use the same canonical identity and review path as generated words. */
import {
  SUBMISSION_PUBLICATION_GATE,
  type WordSubmissionAdapter,
} from '../../platform/wordSupply/submissionAdapter';
import {
  DECRYPTO_WORD_BATCH_LIMIT,
  DECRYPTO_WORD_REVIEW_VERSION,
  decryptoCandidateSchema,
  getDecryptoWordId,
  isDecryptoReviewAccepted,
  parseDecryptoCandidates,
} from './wordEditorial';
import { createDecryptoWordProvider, DECRYPTO_WORD_MODEL } from './wordProvider';

export const decryptoWordSubmissionAdapter: WordSubmissionAdapter = {
  game: 'decrypto',
  inputSchema: decryptoCandidateSchema,
  model: DECRYPTO_WORD_MODEL,
  reviewVersion: DECRYPTO_WORD_REVIEW_VERSION,
  reviewBatchLimit: DECRYPTO_WORD_BATCH_LIMIT,
  inventoryExistsSql: 'EXISTS (SELECT 1 FROM decrypto_words WHERE id = item.identity)',
  async normalize(value) {
    const input = decryptoCandidateSchema.parse(value);
    const [candidate] = parseDecryptoCandidates({ candidates: [input] }, input.category);
    if (candidate === undefined) throw new Error('Decrypto candidate was not normalized');
    return {
      identity: await getDecryptoWordId(candidate.word),
      title: candidate.word,
      category: candidate.category,
      content: candidate,
    };
  },
  async review(env, contents, context) {
    const candidates = contents.map((content) => decryptoCandidateSchema.parse(content));
    const reviews = await createDecryptoWordProvider(env.GEMINI_API_KEY).reviewBatch(
      candidates,
      context,
    );
    return reviews.map((review, index) => {
      const candidate = candidates[index];
      if (candidate === undefined) throw new Error('Decrypto review result lacks its candidate');
      return {
        review: {
          passed: isDecryptoReviewAccepted(review),
          canOverride: true,
          reason: review.reason,
          checks: review.qualityChecks,
          details: {},
        },
        verifiedContent: candidate,
      };
    });
  },
  publish(db, publication) {
    const candidate = decryptoCandidateSchema.parse(
      publication.approvalReason !== null ? publication.content : publication.verifiedContent,
    );
    return [
      db
        .prepare(
          `INSERT INTO decrypto_words (id, word, category, status, created_at)
           SELECT ?, ?, ?, 'active', ? WHERE ${SUBMISSION_PUBLICATION_GATE}`,
        )
        .bind(
          publication.identity,
          candidate.word,
          candidate.category,
          publication.now,
          publication.itemId,
          publication.actionId,
        ),
    ];
  },
  unpublish(db, publication) {
    return [
      db
        .prepare(
          `UPDATE decrypto_words SET status = 'disabled'
           WHERE id = ? AND ${SUBMISSION_PUBLICATION_GATE}`,
        )
        .bind(publication.identity, publication.itemId, publication.actionId),
    ];
  },
};
