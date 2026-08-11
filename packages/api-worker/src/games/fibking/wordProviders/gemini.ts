/** Gemini grounded structured-output adapter for the Fib word provider port. */

import { z } from 'zod';

import {
  FIB_WORD_CANDIDATES_JSON_SCHEMA,
  type GeneratedFibWordCandidate,
  parseGeneratedFibWordCandidatesJson,
  selectGeneratedFibWordCandidate,
} from './candidate';
import { createFibWordMessages } from './prompt';
import { createFibWordProviderRequestError, FibWordProviderError } from './providerError';
import type { FibWordProvider } from './types';

const GEMINI_INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const GEMINI_MODEL = 'gemini-3.5-flash-lite';
const FIB_GROUNDING_MINIMUM_CITED_MEANING_LENGTH = 6;

const geminiResponseSchema = z.object({
  status: z.literal('completed'),
  steps: z.array(z.unknown()).min(1),
});

const geminiStepTypeSchema = z.object({ type: z.string() });
const geminiModelOutputStepSchema = z.object({
  type: z.literal('model_output'),
  content: z.array(
    z.object({
      type: z.literal('text'),
      text: z.string(),
      annotations: z.array(z.unknown()).optional(),
    }),
  ),
});
const geminiUrlCitationSchema = z.object({
  type: z.literal('url_citation'),
  url: z.url(),
  title: z.string().min(1),
  start_index: z.int().nonnegative(),
  end_index: z.int().positive(),
});

type GeminiUrlCitation = z.output<typeof geminiUrlCitationSchema>;

function extractGroundedOutput(response: unknown): {
  readonly text: string;
  readonly citations: readonly GeminiUrlCitation[];
} {
  const interaction = geminiResponseSchema.parse(response);
  const stepTypes = interaction.steps.flatMap((step) => {
    const parsed = geminiStepTypeSchema.safeParse(step);
    return parsed.success ? [parsed.data.type] : [];
  });
  if (!stepTypes.includes('google_search_call') || !stepTypes.includes('google_search_result')) {
    throw new Error('Gemini response did not execute Google Search grounding');
  }
  const textBlocks = interaction.steps.flatMap((step) => {
    const parsed = geminiModelOutputStepSchema.safeParse(step);
    return parsed.success ? parsed.data.content : [];
  });
  if (textBlocks.length !== 1) {
    throw new Error('Gemini response must contain exactly one structured text output');
  }
  const textBlock = textBlocks[0];
  if (textBlock === undefined) {
    throw new Error('[FAIL-FAST] Gemini structured text output was unavailable');
  }
  const citations = (textBlock.annotations ?? []).flatMap((annotation) => {
    const parsed = geminiUrlCitationSchema.safeParse(annotation);
    return parsed.success ? [parsed.data] : [];
  });
  for (const citation of citations) {
    if (citation.start_index >= citation.end_index || citation.end_index > textBlock.text.length) {
      throw new Error('Gemini response contained an invalid citation range');
    }
  }
  return { text: textBlock.text, citations };
}

function assertCandidatesAreGrounded(
  text: string,
  citations: readonly GeminiUrlCitation[],
  candidates: readonly GeneratedFibWordCandidate[],
): void {
  const evidenceRanges = candidates.map((candidate) => {
    const evidenceStart = text.indexOf(candidate.evidence);
    if (evidenceStart < 0 || evidenceStart !== text.lastIndexOf(candidate.evidence)) {
      throw new Error(`Gemini candidate evidence was not uniquely present: ${candidate.word}`);
    }
    return {
      word: candidate.word,
      start: evidenceStart,
      meaningStart: evidenceStart + candidate.word.length + 1,
      end: evidenceStart + candidate.evidence.length,
    };
  });
  for (const candidate of candidates) {
    const evidenceRange = evidenceRanges.find((range) => range.word === candidate.word);
    if (evidenceRange === undefined) {
      throw new Error('[FAIL-FAST] Gemini candidate evidence range was unavailable');
    }
    const hasCandidateCitation = citations.some((citation) => {
      const citedMeaningLength =
        Math.min(citation.end_index, evidenceRange.end) -
        Math.max(citation.start_index, evidenceRange.meaningStart);
      return (
        citedMeaningLength >= FIB_GROUNDING_MINIMUM_CITED_MEANING_LENGTH &&
        evidenceRanges.every(
          (otherRange) =>
            otherRange.word === candidate.word ||
            citation.end_index <= otherRange.start ||
            citation.start_index >= otherRange.end,
        )
      );
    });
    if (!hasCandidateCitation) {
      throw new Error(`Gemini candidate did not have an independent citation: ${candidate.word}`);
    }
  }
}

export function createGeminiFibWordProvider(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): FibWordProvider {
  if (apiKey.length === 0) throw new Error('Gemini Fib word provider requires an API key');

  return {
    async generate(request) {
      const [systemMessage, userMessage] = createFibWordMessages(request);
      let response: Response;
      try {
        response = await fetchImpl(GEMINI_INTERACTIONS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            model: GEMINI_MODEL,
            system_instruction: systemMessage.content,
            input: userMessage.content,
            tools: [{ type: 'google_search' }],
            response_format: {
              type: 'text',
              mime_type: 'application/json',
              schema: FIB_WORD_CANDIDATES_JSON_SCHEMA,
            },
            generation_config: { temperature: 1 },
            store: false,
          }),
          signal: request.signal,
        });
      } catch (error) {
        throw createFibWordProviderRequestError('Gemini', request.signal, error);
      }
      if (!response.ok) {
        const body = await response.text();
        const failureKind =
          response.status === 401 || response.status === 403
            ? 'authenticationFailed'
            : response.status === 429
              ? 'rateLimited'
              : response.status >= 500
                ? 'serviceUnavailable'
                : 'requestFailed';
        throw new FibWordProviderError(
          `Gemini Fib word request failed (${response.status}): ${body.slice(0, 500)}`,
          failureKind,
        );
      }
      try {
        const groundedOutput = extractGroundedOutput(await response.json());
        const candidates = parseGeneratedFibWordCandidatesJson(groundedOutput.text);
        assertCandidatesAreGrounded(groundedOutput.text, groundedOutput.citations, candidates);
        return selectGeneratedFibWordCandidate({ candidates }, 'gemini', request);
      } catch (error) {
        if (request.signal.aborted) {
          throw createFibWordProviderRequestError('Gemini', request.signal, error);
        }
        throw new FibWordProviderError('Gemini Fib word response was invalid', 'invalidOutput', {
          cause: error,
        });
      }
    },
  };
}
