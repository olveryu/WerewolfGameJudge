/** Provider transport uses separate material, strict output, and redacted failures. */
import { describe, expect, it, vi } from 'vitest';

import { UNDERCOVER_WORD_BATCH_LIMIT } from '../wordEditorial';
import { createUndercoverWordProvider } from '../wordProvider';

describe('Undercover provider', () => {
  it('submits a bounded structured request and accepts a real zero-candidate result', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"candidates":[]}' }] } }],
      }),
    );
    expect(
      await createUndercoverWordProvider('test-key', fetchImpl).generateBatch('food', []),
    ).toEqual({ candidates: [] });
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
    ).rejects.toThrow('[invalidOutput]');
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
      ).rejects.toThrow('[invalidOutput]');
    },
  );
  it('never exposes response bodies or retries rejected requests', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('secret provider details', { status: 429 }));
    await expect(
      createUndercoverWordProvider('test-key', fetchImpl).generateBatch('food', []),
    ).rejects.toThrow('HTTP 429');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
