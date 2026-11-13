import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { AiOutputValidationError, getAiDiagnostic } from '../../ai/aiError';
import { parseGeneratedCandidateBatch } from '../generatedCandidates';

const itemSchema = z.strictObject({ word: z.string().min(2) });
const options = {
  limit: 30,
  context: { game: 'test', model: 'test', operation: 'generate' as const, packId: 'pack' },
  parseCandidate: (value: unknown) => itemSchema.parse(value),
  getIdentity: ({ word }: { word: string }) => word,
};

afterEach(() => vi.restoreAllMocks());

describe('generation-only candidate validation', () => {
  it('distinguishes an empty model result from a wholly rejected nonempty batch', () => {
    expect(parseGeneratedCandidateBatch({ candidates: [] }, options)).toEqual({
      candidates: [],
      validation: {
        receivedCount: 0,
        validCount: 0,
        rejectedCount: 0,
        duplicateCount: 0,
        omittedIssueCount: 0,
        rejectionSamples: [],
      },
    });
    expect(() => parseGeneratedCandidateBatch({ candidates: [null] }, options)).toThrow(
      '"validationCode":"allCandidatesRejected"',
    );
  });

  it('bounds samples, preserves all counts and survives Workflow-style Error serialization', () => {
    const report = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      parseGeneratedCandidateBatch({ candidates: Array.from({ length: 30 }, () => null) }, options);
      expect.fail('Nonempty invalid output must fail');
    } catch (error) {
      const diagnostic = getAiDiagnostic(
        new Error(`Error: AiProviderError: ${error instanceof Error ? error.message : ''}`),
      );
      expect(diagnostic).toMatchObject({
        failureKind: 'invalidOutput',
        stage: 'outputValidation',
        validationCode: 'allCandidatesRejected',
        validationSummary: {
          receivedCount: 30,
          validCount: 0,
          rejectedCount: 30,
          duplicateCount: 0,
          omittedIssueCount: 22,
        },
      });
      expect(diagnostic?.validationSummary?.rejectionSamples).toHaveLength(8);
      expect(diagnostic?.validationSummary?.rejectionSamples[7]).toEqual({
        index: 7,
        path: ['candidates', 7],
        code: 'invalid_type',
      });
    }
    expect(report).not.toHaveBeenCalled();
  });

  it('counts valid, rejected and duplicate items separately without leaking unknown keys', () => {
    const report = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { candidates, validation } = parseGeneratedCandidateBatch(
      {
        candidates: [
          { word: 'kept', 'private-key': 'private-value' },
          { word: 'kept' },
          { word: 'kept' },
          { word: 'x' },
        ],
      },
      options,
    );
    expect(candidates).toEqual([{ word: 'kept' }]);
    expect(validation).toMatchObject({
      receivedCount: 4,
      validCount: 1,
      rejectedCount: 2,
      duplicateCount: 1,
    });
    expect(validation.receivedCount).toBe(
      validation.validCount + validation.rejectedCount + validation.duplicateCount,
    );
    expect(validation.rejectionSamples).toEqual([
      { index: 0, path: ['candidates', 0], code: 'unrecognized_keys' },
      { index: 2, path: ['candidates', 2], code: 'duplicateCandidate' },
      { index: 3, path: ['candidates', 3, 'word'], code: 'too_small' },
    ]);
    expect(report).toHaveBeenCalledOnce();
    const logged = JSON.stringify(report.mock.calls);
    for (const secret of ['private-key', 'private-value', 'kept'])
      expect(logged).not.toContain(secret);
  });

  it.each([
    null,
    [],
    {},
    { candidates: null },
    { candidates: [], extra: 'private' },
    { candidates: Array.from({ length: 31 }) },
  ])('fails malformed or oversized envelopes before parsing any items: %j', (value) => {
    const parseCandidate = vi.fn(options.parseCandidate);
    expect(() => parseGeneratedCandidateBatch(value, { ...options, parseCandidate })).toThrow(
      z.ZodError,
    );
    expect(parseCandidate).not.toHaveBeenCalled();
  });

  it('rejects explicit domain failures but propagates unexpected exceptions unchanged', () => {
    const report = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { candidates, validation } = parseGeneratedCandidateBatch(
      { candidates: ['invalid', { word: 'kept' }] },
      {
        ...options,
        parseCandidate: (value) => {
          if (value === 'invalid')
            throw new AiOutputValidationError('invalidEvidenceReference', 'private data', [
              'citations',
              0,
              'quote',
            ]);
          return options.parseCandidate(value);
        },
      },
    );
    expect(candidates).toEqual([{ word: 'kept' }]);
    expect(validation.rejectionSamples).toEqual([
      {
        index: 0,
        path: ['candidates', 0, 'citations', 0, 'quote'],
        code: 'invalidEvidenceReference',
      },
    ]);
    expect(JSON.stringify(report.mock.calls)).not.toContain('private data');
    for (const error of [
      new TypeError('program bug'),
      new Error('program bug'),
      new SyntaxError('program bug'),
    ])
      expect(() =>
        parseGeneratedCandidateBatch(
          { candidates: [null] },
          {
            ...options,
            parseCandidate: () => {
              throw error;
            },
          },
        ),
      ).toThrow(error);
  });
});
