/** Provider-only citation references; persisted reviews retain literal source quotations. */

import { z } from 'zod';

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

function resolveQuote(quoteOptions: EvidenceQuotes, evidenceIndex: number, id: string): string {
  const reference = quoteOptions.find((option) => option.id === id);
  if (reference === undefined || reference.evidenceIndex !== evidenceIndex) {
    throw new Error(`Invalid Fib word evidence reference: ${id}`);
  }
  return reference.quote;
}

/** Resolve generation references before the domain parser validates the entire payload. */
export function resolveFibWordCandidateReferences(value: unknown, quoteOptions: EvidenceQuotes) {
  const payload = z
    .looseObject({
      candidates: z.array(
        z.looseObject({
          citations: z.array(z.looseObject({ evidenceIndex: z.number().int(), quote: z.string() })),
        }),
      ),
    })
    .parse(value);
  return {
    ...payload,
    candidates: payload.candidates.map((candidate) => ({
      ...candidate,
      citations: candidate.citations.map((citation) => ({
        ...citation,
        quote: resolveQuote(quoteOptions, citation.evidenceIndex, citation.quote),
      })),
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
    throw new Error('Fib word review batch size mismatch');
  }
  const candidateWords = new Set(candidates.map(({ word }) => word));
  const reviewsByWord = new Map<string, (typeof payload.reviews)[number]>();
  for (const review of payload.reviews) {
    if (!candidateWords.has(review.word)) {
      throw new Error(`Fib word review returned an unknown candidate: ${review.word}`);
    }
    if (reviewsByWord.has(review.word)) {
      throw new Error(`Fib word review returned a duplicate candidate: ${review.word}`);
    }
    reviewsByWord.set(review.word, review);
  }
  return {
    ...payload,
    reviews: candidates.map((candidate, index) => {
      const review = reviewsByWord.get(candidate.word);
      if (review === undefined) {
        throw new Error(`Fib word review is missing candidate: ${candidate.word}`);
      }
      const options = quoteOptions[index];
      if (options === undefined) throw new Error('Fib word review batch size mismatch');
      if (review.evidenceIndex === null && review.evidenceQuote === null) return review;
      if (review.evidenceIndex === null || review.evidenceQuote === null) {
        throw new Error('Fib word review reference requires both source and quote');
      }
      return {
        ...review,
        evidenceQuote: resolveQuote(options, review.evidenceIndex, review.evidenceQuote),
      };
    }),
  };
}
