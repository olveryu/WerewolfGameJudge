/** Provider transport uses separate material, strict output, and redacted failures. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { UndercoverWordCandidate } from '../wordEditorial';
import { createUndercoverWordProvider } from '../wordProvider';

afterEach(() => vi.restoreAllMocks());

describe('Undercover provider', () => {
  it('sends shared traits and reasons before verdicts and reviews at most 5 pairs', async () => {
    const candidates = Array.from({ length: 5 }, (_, index): UndercoverWordCandidate => ({
      wordA: `冬季${index}`,
      wordB: `夏季${index}`,
      category: 'food',
      commonTraits: ['共同特点甲', '共同特点乙'],
      differences: ['不同特点甲', '不同特点乙'],
      potentialIssues: [],
    }));
    const reviews = candidates.map(({ wordA, wordB }) => ({
      wordA,
      wordB,
      qualityChecks: {
        isFamiliar: true,
        hasSimilarFamiliarity: true,
        hasSharedDescriptions: true,
        hasDistinctDescriptions: true,
        isNotSynonymOrSubset: true,
        isPlayableBothWays: true,
        isCategoryAccurate: true,
        isAppropriate: true,
        isFactuallyCertain: true,
      },
      commonTraits: ['共同特点甲', '共同特点乙'],
      differences: ['不同特点甲', '不同特点乙'],
      reason: '模拟审核，双方共性与区别明确。',
    }));
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        candidates: [
          { finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ reviews }) }] } },
        ],
      }),
    );
    const provider = createUndercoverWordProvider('test-key', fetchImpl);
    await expect(provider.reviewBatch('food', candidates)).resolves.toEqual(reviews);
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
    ).toEqual(['wordA', 'wordB', 'commonTraits', 'differences', 'reason', 'qualityChecks']);
    const payload = z
      .object({ candidates: z.array(z.strictObject({ wordA: z.string(), wordB: z.string() })) })
      .parse(JSON.parse(z.string().parse(body.contents[0]?.parts[0]?.text)));
    expect(payload.candidates).toEqual(candidates.map(({ wordA, wordB }) => ({ wordA, wordB })));
    expect(() => provider.reviewBatch('food', [...candidates, ...candidates.slice(0, 1)])).toThrow(
      'batch limit: 5',
    );
    await expect(provider.reviewBatch('food', [])).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

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
      receivedCount: 5,
      validCount: 1,
      rejectedCount: 3,
      duplicateCount: 1,
    });
    expect(result.validation.rejectionSamples.map(({ index, code }) => ({ index, code }))).toEqual([
      { index: 0, code: 'too_small' },
      { index: 2, code: 'duplicateCandidate' },
      { index: 3, code: 'identicalWords' },
      { index: 4, code: 'unrecognized_keys' },
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
