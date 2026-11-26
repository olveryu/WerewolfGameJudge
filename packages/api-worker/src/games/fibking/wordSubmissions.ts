/** Model review uses independent evidence; explicit human approval remains a separate decision. */
import {
  FIB_DEFINITION_FIELD_MAX_LENGTH,
  FIB_DEFINITION_FIELD_MIN_LENGTH,
  FIB_WORD_MAX_LENGTH,
  FIB_WORD_MIN_LENGTH,
  FIBKING_WORD_CATEGORY_CATALOG,
} from '@game-judge/game-engine/games/fibking/public';
import { Converter } from 'opencc-js/t2cn';
import { z } from 'zod';

import { redactAiDiagnostic } from '../../platform/ai/aiError';
import { createLogger } from '../../platform/observability/logger';
import {
  SUBMISSION_PUBLICATION_GATE,
  SubmissionReviewItemError,
  type WordSubmissionAdapter,
} from '../../platform/wordSupply/submissionAdapter';
import { parseFibWordEditorialCandidate } from './wordProviders/candidate';
import { createGeminiFibWordProvider, GEMINI_FIB_WORD_MODEL } from './wordProviders/gemini';
import { FIB_WORD_REVIEW_VERSION } from './wordProviders/prompt';
import { FibWordProviderError } from './wordProviders/providerError';
import { extractFibWordEvidence, searchFibWordEvidence } from './wordProviders/tavily';
import { FIB_WORD_REVIEW_BATCH_LIMIT } from './wordProviders/types';

const toSimplified = Converter({ from: 't', to: 'cn' });
const log = createLogger('fib-submission-evidence');
const definitionField = z
  .string()
  .trim()
  .min(FIB_DEFINITION_FIELD_MIN_LENGTH)
  .max(FIB_DEFINITION_FIELD_MAX_LENGTH);
const inputSchema = z.strictObject({
  word: z.string().trim().min(FIB_WORD_MIN_LENGTH).max(FIB_WORD_MAX_LENGTH),
  definition: z.strictObject({ coreMeaning: definitionField, usageNote: definitionField }),
  category: z.enum(FIBKING_WORD_CATEGORY_CATALOG.ids),
  references: z
    .array(
      z.strictObject({
        url: z.url({ protocol: /^https?$/ }).max(2048),
        note: z.string().trim().max(300),
      }),
    )
    .max(2),
});

export const fibSubmissionAdapter: WordSubmissionAdapter = {
  game: 'fibking',
  inputSchema,
  model: GEMINI_FIB_WORD_MODEL,
  reviewVersion: FIB_WORD_REVIEW_VERSION,
  reviewBatchLimit: FIB_WORD_REVIEW_BATCH_LIMIT,
  inventoryExistsSql: 'EXISTS (SELECT 1 FROM fib_words WHERE word = item.identity)',
  async normalize(value) {
    const { references, ...input } = inputSchema.parse(value);
    const candidate = parseFibWordEditorialCandidate({
      ...input,
      word: toSimplified(input.word.normalize('NFKC')),
      source: 'local',
      evidence: [],
    });
    return {
      identity: candidate.word,
      title: candidate.word,
      category: candidate.category,
      content: {
        word: candidate.word,
        definition: candidate.definition,
        category: candidate.category,
        references,
      },
    };
  },
  async prepareReview(env, content, claim, context) {
    const { references: _references, ...input } = inputSchema.parse(content);
    try {
      await claim('search');
      const sources = await searchFibWordEvidence(
        env.TAVILY_API_KEY,
        `"${input.word}" 词典 释义 出处`,
      );
      let evidence: Awaited<ReturnType<typeof searchFibWordEvidence>> = [];
      if (sources.length > 0) {
        await claim('extract');
        const extraction = await extractFibWordEvidence(env.TAVILY_API_KEY, sources, {
          privateValues: content,
        });
        if (extraction.failures.length > 0) {
          log.warn('independent evidence extraction failed for sources', {
            ...context,
            failedSources: extraction.failures,
            extractedCount: extraction.evidence.length,
          });
          if (extraction.evidence.length === 0)
            throw new SubmissionReviewItemError('evidence:extractionFailed');
        }
        evidence = extraction.evidence;
      }
      return { ...parseFibWordEditorialCandidate({ ...input, source: 'local', evidence }) };
    } catch (error) {
      if (error instanceof FibWordProviderError)
        log.warn('independent evidence provider failed', {
          ...context,
          failureKind: error.failureKind,
          detail: redactAiDiagnostic(error.message, [env.TAVILY_API_KEY, content]),
        });
      throw error;
    }
  },
  async review(env, contents, context) {
    const candidates = contents.map((content) => parseFibWordEditorialCandidate(content));
    const first = candidates[0];
    if (first === undefined) throw new Error('Cannot review an empty Fib submission group');
    const reviews = await createGeminiFibWordProvider(env.GEMINI_API_KEY).reviewBatch(
      {
        category: first.category,
        evidence: [],
        deadlineAt: Date.now() + 120_000,
        signal: AbortSignal.timeout(120_000),
      },
      candidates,
      context,
    );
    return reviews.map((review, index) => {
      const candidate = candidates[index];
      if (candidate === undefined) throw new Error('Fib review result lacks its candidate');
      return {
        review: {
          passed: review.decision === 'accepted',
          canOverride: candidate.evidence.some((source) => source.content.includes(candidate.word)),
          reason: review.reason,
          checks: { ...review.qualityChecks },
          details: {
            evidence: candidate.evidence,
            evidenceIndex: review.evidenceIndex,
            evidenceQuote: review.evidenceQuote,
          },
        },
        verifiedContent: { ...candidate },
      };
    });
  },
  publish(db, publication) {
    const material =
      publication.approvalReason !== null ? inputSchema.parse(publication.content) : null;
    const candidate =
      material !== null
        ? parseFibWordEditorialCandidate({
            word: material.word,
            definition: material.definition,
            category: material.category,
            source: 'local',
            evidence: [],
          })
        : parseFibWordEditorialCandidate(publication.verifiedContent);
    if (publication.approvalReason === null && candidate.evidence.length === 0)
      throw new Error('Fib publication requires independently retrieved evidence');
    return [
      db
        .prepare(
          `INSERT INTO fib_words
        (id, word, core_meaning, usage_note, category, source, status,
         selection_key, created_at, activated_at)
        SELECT ?, ?, ?, ?, ?, 'local', 'active', 0, ?, ? WHERE ${SUBMISSION_PUBLICATION_GATE}`,
        )
        .bind(
          `submission:${publication.itemId}`,
          candidate.word,
          candidate.definition.coreMeaning,
          candidate.definition.usageNote,
          candidate.category,
          publication.now,
          publication.now,
          publication.itemId,
          publication.actionId,
        ),
      db
        .prepare(
          `INSERT INTO fib_word_sequence (word, published_at)
        SELECT ?, ? WHERE ${SUBMISSION_PUBLICATION_GATE}`,
        )
        .bind(candidate.word, publication.now, publication.itemId, publication.actionId),
    ];
  },
  unpublish(db, publication) {
    return [
      db
        .prepare(
          `UPDATE fib_words SET status = 'disabled', disabled_at = ?,
        status_reason = 'external_submission: manually unpublished'
        WHERE word = ? AND ${SUBMISSION_PUBLICATION_GATE}`,
        )
        .bind(publication.now, publication.identity, publication.itemId, publication.actionId),
    ];
  },
};
