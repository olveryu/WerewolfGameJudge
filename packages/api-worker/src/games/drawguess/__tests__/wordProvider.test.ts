/** Provider transport uses separate material, strict output, and redacted failures. */
import { DRAWGUESS_WORD_CATEGORIES } from '@game-judge/game-engine/games/drawguess/public';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { DrawGuessWordCandidate } from '../wordEditorial';
import { createDrawGuessWordProvider } from '../wordProvider';

afterEach(() => vi.restoreAllMocks());

describe('DrawGuess provider', () => {
  it('isolates bad candidates before canonical deduplication and reports one safe warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const candidate = { word: '麵包', category: 'food', difficulty: 'easy', potentialIssues: [] };
    const candidates = [
      { ...candidate, word: 'leak!' },
      { ...candidate, category: 'animals' },
      candidate,
      { ...candidate, word: '面包' },
      { ...candidate, word: '香蕉', 'private-key': 'private-value' },
    ];
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        candidates: [
          { finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ candidates }) }] } },
        ],
      }),
    );
    const result = await createDrawGuessWordProvider('test-key', fetchImpl).generateBatch(
      'food',
      [],
      { packId: 'partial' },
    );
    expect(result.candidates).toEqual([{ ...candidate, word: '面包' }]);
    expect(result.validation).toMatchObject({
      receivedCount: 5,
      validCount: 1,
      rejectedCount: 3,
      duplicateCount: 1,
      omittedIssueCount: 0,
    });
    expect(result.validation.rejectionSamples).toEqual([
      { index: 0, path: ['candidates', 0, 'word'], code: 'invalid_format' },
      { index: 1, path: ['candidates', 1, 'category'], code: 'categoryMismatch' },
      { index: 3, path: ['candidates', 3], code: 'duplicateCandidate' },
      { index: 4, path: ['candidates', 4], code: 'unrecognized_keys' },
    ]);
    expect(warn).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('"packId":"partial"'));
    expect(error).not.toHaveBeenCalled();
    for (const secret of [
      '麵包',
      '面包',
      '香蕉',
      'leak!',
      'private-key',
      'private-value',
      'test-key',
    ])
      expect(JSON.stringify(warn.mock.calls)).not.toContain(secret);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0]?.[1]?.body).toContain('pattern');
  });

  it('supports at least 30 distinct editorial categories', () => {
    expect(new Set(DRAWGUESS_WORD_CATEGORIES).size).toBeGreaterThanOrEqual(30);
  });

  it('sends reasons before verdicts and reviews at most 5 words without extra requests', async () => {
    const candidates = Array.from({ length: 5 }, (_, index): DrawGuessWordCandidate => ({
      word: `测试${String.fromCodePoint(0x4e00 + index)}`,
      category: 'animals',
      difficulty: 'easy',
      potentialIssues: [],
    }));
    const reviews = candidates.map(({ word }) => ({
      word,
      qualityChecks: {
        isConcreteAndDrawable: true,
        isSimplifiedChinese: true,
        isLengthValid: true,
        isCategoryAccurate: true,
        isAppropriate: true,
        isUnambiguous: true,
      },
      reason: '模拟审核，画法和猜词依据明确。',
    }));
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        candidates: [
          { finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ reviews }) }] } },
        ],
      }),
    );
    const provider = createDrawGuessWordProvider('test-key', fetchImpl);
    await expect(provider.reviewBatch('animals', candidates)).resolves.toEqual(reviews);
    const body = z
      .object({
        generationConfig: z.object({
          responseJsonSchema: z.object({
            properties: z.object({
              reviews: z.object({
                items: z.object({ properties: z.record(z.string(), z.unknown()) }),
              }),
            }),
          }),
        }),
        contents: z.array(z.object({ parts: z.array(z.object({ text: z.string() })) })),
      })
      .parse(JSON.parse(z.string().parse(fetchImpl.mock.calls[0]?.[1]?.body)));
    expect(
      Object.keys(body.generationConfig.responseJsonSchema.properties.reviews.items.properties),
    ).toEqual(['word', 'reason', 'qualityChecks']);
    const payload = z
      .object({ candidates: z.array(z.strictObject({ word: z.string() })) })
      .parse(JSON.parse(z.string().parse(body.contents[0]?.parts[0]?.text)));
    expect(payload.candidates).toEqual(candidates.map(({ word }) => ({ word })));
    expect(() =>
      provider.reviewBatch('animals', [...candidates, ...candidates.slice(0, 1)]),
    ).toThrow('batch limit: 5');
    await expect(provider.reviewBatch('animals', [])).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('sends the new party category and its drawing instructions to the provider', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"candidates":[]}' }] } }],
      }),
    );
    await createDrawGuessWordProvider('test-key', fetchImpl).generateBatch('actionComedy', []);
    expect(fetchImpl.mock.calls[0]?.[1]?.body).toEqual(expect.stringContaining('动作喜剧'));
  });

  it('submits a bounded structured request and accepts a real zero-candidate result', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"candidates":[]}' }] } }],
      }),
    );
    expect(
      await createDrawGuessWordProvider('test-key', fetchImpl).generateBatch('food', []),
    ).toMatchObject({
      candidates: [],
      validation: { receivedCount: 0, validCount: 0, rejectedCount: 0, duplicateCount: 0 },
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const request = fetchImpl.mock.calls[0]?.[1];
    expect(request).toMatchObject({ method: 'POST' });
    expect(fetchImpl.mock.calls[0]?.[0]).toEqual(expect.stringContaining(':generateContent'));
    expect(request?.headers).toEqual({
      'Content-Type': 'application/json',
      'x-goog-api-key': 'test-key',
    });
    expect(request?.body).toEqual(expect.stringContaining('responseJsonSchema'));
    expect(request?.body).not.toEqual(
      expect.stringMatching(/"(?:\$schema|minLength|maxLength|minItems|maxItems)"/),
    );
  });

  it('rejects truncated output even when the partial text is valid JSON', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        candidates: [
          { finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"candidates":[]}' }] } },
        ],
      }),
    );
    await expect(
      createDrawGuessWordProvider('test-key', fetchImpl).generateBatch('food', []),
    ).rejects.toMatchObject({
      diagnostic: { failureKind: 'invalidOutput', stage: 'responseEnvelope' },
    });
  });

  it.each(['word shape', 'batch size'])('still enforces local %s bounds', async (invalidField) => {
    const candidate = {
      word: invalidField === 'word shape' ? 'word'.repeat(20) : '大熊猫',
      category: 'food',
      difficulty: 'easy',
      potentialIssues: [],
    };
    const candidates = Array.from(
      { length: invalidField === 'batch size' ? 6 : 1 },
      () => candidate,
    );
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        candidates: [
          {
            finishReason: 'STOP',
            content: { parts: [{ text: JSON.stringify({ candidates }) }] },
          },
        ],
      }),
    );
    await expect(
      createDrawGuessWordProvider('test-key', fetchImpl).generateBatch('food', []),
    ).rejects.toMatchObject({
      diagnostic: { failureKind: 'invalidOutput', stage: 'outputValidation' },
    });
  });

  it('never exposes unstructured response bodies or retries rejected requests', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('secret provider details', { status: 429 }));
    const failure = createDrawGuessWordProvider('test-key', fetchImpl).generateBatch('food', []);
    await expect(failure).rejects.toMatchObject({ diagnostic: { httpStatus: 429 } });
    await expect(failure).rejects.not.toThrow('secret provider details');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('diagnoses domain review failures inside the provider boundary with pack context', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"reviews":[]}' }] } }],
      }),
    );
    const failure = createDrawGuessWordProvider('test-key', fetchImpl).reviewBatch(
      'food',
      [{ word: '测试词', category: 'food', difficulty: 'easy', potentialIssues: [] }],
      { packId: 'review-pack' },
    );
    await expect(failure).rejects.toMatchObject({
      diagnostic: {
        game: 'drawguess',
        operation: 'review',
        packId: 'review-pack',
        stage: 'outputValidation',
        validationCode: 'reviewCountMismatch',
      },
    });
    await expect(failure).rejects.not.toThrow('测试词');
  });

  it('preserves service errors and tracing headers without exposing echoed request material', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(
        {
          error: {
            code: 503,
            status: 'UNAVAILABLE',
            message:
              'Overloaded test-key Bearer credential https://example.test?key=test-key private-word',
            debugInfo: 'private raw data',
          },
        },
        {
          status: 503,
          headers: { 'retry-after': '30', 'x-request-id': 'request-123' },
        },
      ),
    );
    const failure = createDrawGuessWordProvider('test-key', fetchImpl).generateBatch('food', [
      'private-word',
    ]);
    await expect(failure).rejects.toMatchObject({ diagnostic: { httpStatus: 503 } });
    await expect(failure).rejects.toThrow('UNAVAILABLE');
    await expect(failure).rejects.toThrow('Overloaded');
    await expect(failure).rejects.toThrow('"retryAfter":"30"');
    await expect(failure).rejects.toThrow('"providerRequestId":"request-123"');
    for (const secret of ['test-key', 'credential', 'https://', 'private-word', 'private raw data'])
      await expect(failure).rejects.not.toThrow(secret);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('includes only allowlisted quota and retry details from rate-limit errors', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(
        {
          error: {
            status: 'RESOURCE_EXHAUSTED',
            message: 'Quota exceeded',
            details: [
              {
                '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
                violations: [
                  {
                    quotaMetric: 'generate_content_requests',
                    quotaId: 'RequestsPerMinute',
                    quotaValue: '15',
                    description: 'private-word',
                    quotaDimensions: { project: 'private-project' },
                  },
                ],
              },
              { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '45s' },
              { '@type': 'debug', content: 'private-debug' },
            ],
          },
        },
        { status: 429, headers: { 'x-goog-request-id': 'google-request-123' } },
      ),
    );
    const failure = createDrawGuessWordProvider('test-key', fetchImpl).generateBatch('food', []);
    for (const detail of [
      'RESOURCE_EXHAUSTED',
      'generate_content_requests',
      'RequestsPerMinute',
      'quotaValue=15',
      '"retryDelay":"45s"',
      'google-request-123',
    ])
      await expect(failure).rejects.toThrow(detail);
    for (const secret of ['private-word', 'private-project', 'private-debug'])
      await expect(failure).rejects.not.toThrow(secret);
  });

  it('bounds error body reads while retaining HTTP status and retry headers', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('sensitive'.repeat(3_000), {
        status: 503,
        headers: { 'retry-after': '60' },
      }),
    );
    const failure = createDrawGuessWordProvider('test-key', fetchImpl).generateBatch('food', []);
    await expect(failure).rejects.toMatchObject({ diagnostic: { httpStatus: 503 } });
    await expect(failure).rejects.toThrow('"errorBody":"tooLarge"');
    await expect(failure).rejects.toThrow('"retryAfter":"60"');
    await expect(failure).rejects.not.toThrow('sensitive');
  });

  it('retains the HTTP error when reading its response body fails', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.error(new Error('private transport detail'));
          },
        }),
        { status: 503, headers: { 'x-request-id': 'request-456' } },
      ),
    );
    const failure = createDrawGuessWordProvider('test-key', fetchImpl).generateBatch('food', []);
    await expect(failure).rejects.toMatchObject({ diagnostic: { httpStatus: 503 } });
    await expect(failure).rejects.toThrow('"errorBody":"unreadable"');
    await expect(failure).rejects.toThrow('request-456');
    await expect(failure).rejects.not.toThrow('private transport detail');
  });
});
