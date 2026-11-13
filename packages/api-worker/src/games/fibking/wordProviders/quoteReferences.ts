/** Provider-only citation references; persisted reviews retain literal source quotations. */

import { z } from 'zod';

import { AiOutputValidationError } from '../../../platform/ai/aiError';
import type { FibWordEvidence } from './tavily';
import type { FibWordEditorialCandidate } from './types';

const QUOTE_MIN_LENGTH = 8;
const QUOTE_MAX_LENGTH = 300;

/** Build deterministic references to complete, bounded source sentences. */
export function createFibWordEvidenceQuotes(evidence: readonly FibWordEvidence[]) {
  const segmenter = new Intl.Segmenter('zh', { granularity: 'sentence' });
  return evidence.flatMap((source, evidenceIndex) =>
    Array.from(segmenter.segment(source.content), ({ segment }, sentenceIndex) => ({
      id: `source${evidenceIndex}quote${sentenceIndex}`,
      evidenceIndex,
      quote: segment.trim(),
    })).filter(({ quote }) => quote.length >= QUOTE_MIN_LENGTH && quote.length <= QUOTE_MAX_LENGTH),
  );
}

type EvidenceQuotes = ReturnType<typeof createFibWordEvidenceQuotes>;

function resolveQuote(
  quoteOptions: EvidenceQuotes,
  evidenceIndex: number,
  id: string,
  path: readonly (string | number)[] = [],
): string {
  const reference = quoteOptions.find((option) => option.id === id);
  if (reference === undefined || reference.evidenceIndex !== evidenceIndex) {
    throw new AiOutputValidationError(
      'invalidEvidenceReference',
      `Invalid Fib word evidence reference: ${id}`,
      path,
    );
  }
  return reference.quote;
}

/** Resolve all citations within the same candidate rejection boundary as its domain validation. */
export function resolveFibWordCandidateReference(value: unknown, quoteOptions: EvidenceQuotes) {
  const payload = z
    .looseObject({
      citations: z.array(z.looseObject({ evidenceIndex: z.number().int(), quote: z.string() })),
    })
    .parse(value);
  return {
    ...payload,
    citations: payload.citations.map((citation, index) => ({
      ...citation,
      quote: resolveQuote(quoteOptions, citation.evidenceIndex, citation.quote, [
        'citations',
        index,
        'quote',
      ]),
    })),
  };
}

/** Resolve each review against that candidate's own sources, never another candidate's. */
export function resolveFibWordReviewReferences(
  value: unknown,
  candidates: readonly FibWordEditorialCandidate[],
  quoteOptions: EvidenceQuotes[],
) {
  const payload = z
    .looseObject({
      reviews: z.array(
        z.looseObject({
          word: z.string(),
          evidenceIndex: z.number().int().nullable(),
          evidenceQuote: z.string().nullable(),
        }),
      ),
    })
    .parse(value);
  if (payload.reviews.length !== candidates.length) {
    throw new AiOutputValidationError('reviewCountMismatch', 'Fib word review batch size mismatch');
  }
  const candidateWords = new Set(candidates.map(({ word }) => word));
  const reviewsByWord = new Map<string, (typeof payload.reviews)[number]>();
  for (const review of payload.reviews) {
    if (!candidateWords.has(review.word)) {
      throw new AiOutputValidationError(
        'unknownCandidate',
        `Fib word review returned an unknown candidate: ${review.word}`,
      );
    }
    if (reviewsByWord.has(review.word)) {
      throw new AiOutputValidationError(
        'duplicateCandidate',
        `Fib word review returned a duplicate candidate: ${review.word}`,
      );
    }
    reviewsByWord.set(review.word, review);
  }
  return {
    ...payload,
    reviews: candidates.map((candidate, index) => {
      const review = reviewsByWord.get(candidate.word);
      if (review === undefined) {
        throw new AiOutputValidationError(
          'missingCandidate',
          `Fib word review is missing candidate: ${candidate.word}`,
        );
      }
      const options = quoteOptions[index];
      if (options === undefined)
        throw new AiOutputValidationError(
          'reviewCountMismatch',
          'Fib word review batch size mismatch',
        );
      if (review.evidenceIndex === null && review.evidenceQuote === null) return review;
      if (review.evidenceIndex === null || review.evidenceQuote === null) {
        throw new AiOutputValidationError(
          'incompleteEvidenceReference',
          'Fib word review reference requires both source and quote',
        );
      }
      return {
        ...review,
        evidenceQuote: resolveQuote(options, review.evidenceIndex, review.evidenceQuote),
      };
    }),
  };
}
