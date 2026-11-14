/** External DrawGuess editorial material reuses the game's canonical identity and review rubric. */
import {
  SUBMISSION_PUBLICATION_GATE,
  type WordSubmissionAdapter,
} from '../../platform/wordSupply/submissionAdapter';
import {
  DRAWGUESS_WORD_BATCH_LIMIT,
  DRAWGUESS_WORD_REVIEW_VERSION,
  drawGuessCandidateSchema,
  getDrawGuessWordId,
  isDrawGuessReviewAccepted,
  parseDrawGuessCandidates,
  toPinyinInitials,
} from './wordEditorial';
import { createDrawGuessWordProvider, DRAWGUESS_WORD_MODEL } from './wordProvider';

export const drawGuessSubmissionAdapter: WordSubmissionAdapter = {
  game: 'drawguess',
  inputSchema: drawGuessCandidateSchema,
  model: DRAWGUESS_WORD_MODEL,
  reviewVersion: DRAWGUESS_WORD_REVIEW_VERSION,
  reviewBatchLimit: DRAWGUESS_WORD_BATCH_LIMIT,
  inventoryExistsSql: 'EXISTS (SELECT 1 FROM drawguess_words WHERE id = item.identity)',
  async normalize(value) {
    const input = drawGuessCandidateSchema.parse(value);
    const [candidate] = parseDrawGuessCandidates({ candidates: [input] }, input.category);
    if (candidate === undefined) throw new Error('DrawGuess candidate was not normalized');
    toPinyinInitials(candidate.word);
    return {
      identity: await getDrawGuessWordId(candidate.word),
      title: candidate.word,
      category: candidate.category,
      content: candidate,
    };
  },
  async review(env, contents, context) {
    const candidates = contents.map((content) => drawGuessCandidateSchema.parse(content));
    const first = candidates[0];
    if (first === undefined) throw new Error('Cannot review an empty DrawGuess submission group');
    const reviews = await createDrawGuessWordProvider(env.GEMINI_API_KEY).reviewBatch(
      first.category,
      candidates,
      context,
    );
    return reviews.map((review, index) => {
      const candidate = candidates[index];
      if (candidate === undefined) throw new Error('DrawGuess review result lacks its candidate');
      return {
        review: {
          passed: isDrawGuessReviewAccepted(review),
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
    const candidate = drawGuessCandidateSchema.parse(
      publication.approvalReason !== null ? publication.content : publication.verifiedContent,
    );
    return [
      db
        .prepare(
          `INSERT INTO drawguess_words
        (id, word, pinyin_initials, category, difficulty, status, created_at, disabled_at)
        SELECT ?, ?, ?, ?, ?, 'active', ?, NULL WHERE ${SUBMISSION_PUBLICATION_GATE}`,
        )
        .bind(
          publication.identity,
          candidate.word,
          toPinyinInitials(candidate.word),
          candidate.category,
          candidate.difficulty,
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
          `UPDATE drawguess_words SET status = 'disabled', disabled_at = ?
        WHERE id = ? AND ${SUBMISSION_PUBLICATION_GATE}`,
        )
        .bind(publication.now, publication.identity, publication.itemId, publication.actionId),
    ];
  },
};
