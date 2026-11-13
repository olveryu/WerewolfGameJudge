/** Generation-only partial acceptance; persisted material and reviews remain strict. */
import { z } from 'zod';

import {
  type AiContext,
  AiOutputValidationError,
  AiProviderError,
  OUTPUT_VALIDATION_SAMPLE_LIMIT,
  type OutputValidationSummary,
} from '../ai/aiError';
import { createLogger } from '../observability/logger';

const log = createLogger('word-generation');

/** Counts describe local eligibility for review, not editorial approval or new inventory. */
export interface GeneratedCandidateBatch<Candidate> {
  readonly candidates: Candidate[];
  readonly validation: OutputValidationSummary;
}

interface GenerationOptions<Candidate> {
  readonly limit: number;
  readonly context: AiContext;
  readonly parseCandidate: (value: unknown) => Candidate;
  readonly getIdentity: (candidate: Candidate) => string;
}

/** Validate the envelope first, then reject known item errors without swallowing program errors. */
export function parseGeneratedCandidateBatch<Candidate>(
  value: unknown,
  options: GenerationOptions<Candidate>,
): GeneratedCandidateBatch<Candidate> {
  const payload = z
    .strictObject({ candidates: z.array(z.unknown()).max(options.limit) })
    .parse(value);
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  const validation: OutputValidationSummary = {
    receivedCount: payload.candidates.length,
    validCount: 0,
    rejectedCount: 0,
    duplicateCount: 0,
    omittedIssueCount: 0,
    rejectionSamples: [],
  };
  const recordIssue = (index: number, path: readonly PropertyKey[], code: string) => {
    if (validation.rejectionSamples.length < OUTPUT_VALIDATION_SAMPLE_LIMIT)
      validation.rejectionSamples.push({
        index,
        path: [
          'candidates',
          index,
          ...path.map((part) => (typeof part === 'symbol' ? 'field' : part)),
        ],
        code,
      });
    else validation.omittedIssueCount += 1;
  };
  for (const [index, item] of payload.candidates.entries()) {
    let candidate: Candidate;
    try {
      candidate = options.parseCandidate(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        for (const issue of error.issues) recordIssue(index, issue.path, issue.code);
      } else if (error instanceof AiOutputValidationError) {
        recordIssue(index, error.path, error.code);
      } else throw error;
      validation.rejectedCount += 1;
      continue;
    }
    const identity = options.getIdentity(candidate);
    if (seen.has(identity)) {
      validation.duplicateCount += 1;
      recordIssue(index, [], 'duplicateCandidate');
      continue;
    }
    seen.add(identity);
    candidates.push(candidate);
  }
  validation.validCount = candidates.length;
  if (validation.receivedCount > 0 && candidates.length === 0)
    throw new AiProviderError(options.context, 'outputValidation', 'invalidOutput', {
      validationCode: 'allCandidatesRejected',
      validationSummary: validation,
    });
  if (validation.rejectedCount > 0 || validation.duplicateCount > 0)
    log.warn('generated candidates rejected', { ...options.context, validation });
  return { candidates, validation };
}
