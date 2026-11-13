/** Provider transport uses separate material, strict output, and redacted failures. */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UNDERCOVER_WORD_BATCH_LIMIT } from '../wordEditorial';
import { createUndercoverWordProvider } from '../wordProvider';

afterEach(() => vi.restoreAllMocks());

describe('Undercover provider', () => {
  it('validates whole pairs, retains non-CJK words and deduplicates normalized reversed pairs', async () => {
    const candidate = {
      wordA: 'Ｍｉｌｋ',
      wordB: 'Soy milk',
      category: 'food',
      commonTraits: ['Drink', 'Breakfast'],
      differences: ['Animal versus plant', 'Different ingredients'],
      potentialIssues: [],
    };
    const candidates = [
      { ...candidate, commonTraits: ['Drink'] },
      candidate,
      { ...candidate, wordA: 'soy milk', wordB: 'milk' },
      { ...candidate, wordA: 'drink', wordB: 'ＤＲＩＮＫ' },
      { ...candidate, category: 'nature' },
      { ...candidate, 'private-key': 'private-value' },
    ];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        candidates: [
          { finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ candidates }) }] } },
        ],
      }),
    );
    const result = await createUndercoverWordProvider('test-key', fetchImpl).generateBatch(
      'food',
      [],
    );
    expect(result.candidates).toEqual([{ ...candidate, wordA: 'milk', wordB: 'soy milk' }]);
    expect(result.validation).toMatchObject({
      receivedCount: 6,
      validCount: 1,
      rejectedCount: 4,
      duplicateCount: 1,
    });
    expect(result.validation.rejectionSamples.map(({ index, code }) => ({ index, code }))).toEqual([
      { index: 0, code: 'too_small' },
      { index: 2, code: 'duplicateCandidate' },
      { index: 3, code: 'identicalWords' },
      { index: 4, code: 'categoryMismatch' },
      { index: 5, code: 'unrecognized_keys' },
    ]);
    expect(warn).toHaveBeenCalledOnce();
    expect(error).not.toHaveBeenCalled();
    for (const secret of [
      'Soy milk',
      'Ｍｉｌｋ',
      'Drink',
      'private-key',
      'private-value',
      'test-key',
    ])
      expect(JSON.stringify(warn.mock.calls)).not.toContain(secret);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('sends the new party category and its word-pair instructions to the provider', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"candidates":[]}' }] } }],
      }),
    );
    await createUndercoverWordProvider('test-key', fetchImpl).generateBatch('dating', []);
    expect(fetchImpl.mock.calls[0]?.[1]?.body).toEqual(expect.stringContaining('约会场景'));
  });

  it('submits a bounded structured request and accepts a real zero-candidate result', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"candidates":[]}' }] } }],
      }),
    );
    expect(
      await createUndercoverWordProvider('test-key', fetchImpl).generateBatch('food', []),
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
      createUndercoverWordProvider('test-key', fetchImpl).generateBatch('food', []),
    ).rejects.toMatchObject({ failureKind: 'invalidOutput' });
  });
  it.each(['word length', 'batch size', 'trait count'])(
    'still enforces local %s bounds',
    async (invalidField) => {
      const candidate = {
        wordA: invalidField === 'word length' ? 'word'.repeat(20) : 'Milk',
        wordB: 'Soy milk',
        category: 'food',
        commonTraits: invalidField === 'trait count' ? ['Drink'] : ['Drink', 'Breakfast'],
        differences: ['Animal versus plant', 'Different ingredients'],
        potentialIssues: [],
      };
      const candidates = Array.from(
        { length: invalidField === 'batch size' ? UNDERCOVER_WORD_BATCH_LIMIT + 1 : 1 },
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
        createUndercoverWordProvider('test-key', fetchImpl).generateBatch('food', []),
      ).rejects.toMatchObject({ failureKind: 'invalidOutput' });
    },
  );
  it('never exposes response bodies or retries rejected requests', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('secret provider details', { status: 429 }));
    await expect(
      createUndercoverWordProvider('test-key', fetchImpl).generateBatch('food', []),
    ).rejects.toMatchObject({ diagnostic: { httpStatus: 429 } });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('diagnoses domain review failures without exposing candidate pairs', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"reviews":[]}' }] } }],
      }),
    );
    const failure = createUndercoverWordProvider('test-key', fetchImpl).reviewBatch(
      'food',
      [
        {
          wordA: '测试甲',
          wordB: '测试乙',
          category: 'food',
          commonTraits: ['共同特点甲', '共同特点乙'],
          differences: ['不同特点甲', '不同特点乙'],
          potentialIssues: [],
        },
      ],
      { packId: 'undercover-review-pack' },
    );
    await expect(failure).rejects.toMatchObject({
      diagnostic: {
        game: 'undercover',
        operation: 'review',
        packId: 'undercover-review-pack',
        stage: 'outputValidation',
        validationCode: 'reviewCountMismatch',
      },
    });
    await expect(failure).rejects.not.toThrow('测试甲');
    await expect(failure).rejects.not.toThrow('测试乙');
  });
});
