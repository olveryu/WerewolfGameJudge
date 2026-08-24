/** Gemini FibKing batch-provider schema and transport contracts. */

import { describe, expect, it } from 'vitest';

import {
  FIB_WORD_CANDIDATES_JSON_SCHEMA,
  FIB_WORD_JSON_SCHEMA,
  FIB_WORD_REVIEWS_JSON_SCHEMA,
  parseFibWordReviews,
  parseGeneratedFibWordCandidates,
} from '../candidate';
import { createGeminiFibWordProvider } from '../gemini';
import type { FibWordRequest } from '../types';

const TEST_GENERATION_BUDGET_MS = 60_000;
const LITERARY_DEFINITION = {
  coreMeaning: '荷花的别称，古人常在诗文中用来称呼荷花。',
  usageNote: '多见于古典诗文和书面描写，不是现代口语中的常用称呼。',
} as const;
const CANDIDATES_RESPONSE = {
  candidates: ['菡萏', '却扇', '射覆', '盘桓', '纡徐', '逡巡'].map((word) => ({
    word,
    definition: LITERARY_DEFINITION,
    category: 'literary' as const,
  })),
};
const REVIEWS_RESPONSE = {
  reviews: CANDIDATES_RESPONSE.candidates.map(({ word }) => ({
    word,
    decision: word === '菡萏' ? ('rejected' as const) : ('accepted' as const),
    reason:
      word === '菡萏'
        ? '词义已被多数玩家熟知，无法形成真假释义悬念。'
        : '真实含义不透明且便于编造可信释义。',
  })),
};

function createWordRequest(): FibWordRequest {
  return {
    category: 'literary',
    deadlineAt: Date.now() + TEST_GENERATION_BUDGET_MS,
    signal: new AbortController().signal,
  };
}

function createGeminiResponse(payload: unknown = CANDIDATES_RESPONSE): Record<string, unknown> {
  return {
    choices: [{ message: { content: JSON.stringify(payload) } }],
  };
}

describe('Fib word candidate batches', () => {
  it('returns all six strictly validated candidates', () => {
    expect(
      parseGeneratedFibWordCandidates(CANDIDATES_RESPONSE, 'gemini', createWordRequest()),
    ).toEqual(
      CANDIDATES_RESPONSE.candidates.map(({ word, definition }) => ({
        word,
        definition,
        source: 'gemini',
      })),
    );
    expect(FIB_WORD_CANDIDATES_JSON_SCHEMA.properties.candidates).toMatchObject({
      items: FIB_WORD_JSON_SCHEMA,
      minItems: 6,
      maxItems: 6,
    });
  });

  it('rejects wrong counts, duplicates, categories, and unknown fields', () => {
    expect(() =>
      parseGeneratedFibWordCandidates(
        { candidates: CANDIDATES_RESPONSE.candidates.slice(0, 5) },
        'gemini',
        createWordRequest(),
      ),
    ).toThrow();
    expect(() =>
      parseGeneratedFibWordCandidates(
        {
          candidates: [
            ...CANDIDATES_RESPONSE.candidates.slice(0, 5),
            CANDIDATES_RESPONSE.candidates[0],
          ],
        },
        'gemini',
        createWordRequest(),
      ),
    ).toThrow('duplicate candidate');
    expect(() =>
      parseGeneratedFibWordCandidates(
        {
          candidates: CANDIDATES_RESPONSE.candidates.map((candidate, index) =>
            index === 0 ? { ...candidate, category: 'internet' } : candidate,
          ),
        },
        'gemini',
        createWordRequest(),
      ),
    ).toThrow('expected literary');
    expect(() =>
      parseGeneratedFibWordCandidates(
        {
          candidates: CANDIDATES_RESPONSE.candidates.map((candidate, index) =>
            index === 0 ? { ...candidate, unexpected: true } : candidate,
          ),
        },
        'gemini',
        createWordRequest(),
      ),
    ).toThrow();
  });

  it('requires one ordered review for every generated candidate', () => {
    const candidates = parseGeneratedFibWordCandidates(
      CANDIDATES_RESPONSE,
      'gemini',
      createWordRequest(),
    );

    expect(parseFibWordReviews(REVIEWS_RESPONSE, candidates)).toEqual(REVIEWS_RESPONSE.reviews);
    expect(FIB_WORD_REVIEWS_JSON_SCHEMA.properties.reviews).toMatchObject({
      minItems: 6,
      maxItems: 6,
    });
    expect(() =>
      parseFibWordReviews({ reviews: [...REVIEWS_RESPONSE.reviews].reverse() }, candidates),
    ).toThrow('preserve candidate order');
    expect(() =>
      parseFibWordReviews(
        {
          reviews: REVIEWS_RESPONSE.reviews.map((review, index) =>
            index === 0 ? { ...review, unexpected: true } : review,
          ),
        },
        candidates,
      ),
    ).toThrow();
  });
});

describe('Gemini Fib word provider', () => {
  it('reviews every generated candidate in an independent structured request', async () => {
    let requestBody = '';
    const fetchImpl: typeof fetch = async (_input, init) => {
      if (typeof init?.body !== 'string') {
        throw new Error('Expected Gemini request body to be a JSON string');
      }
      requestBody = init.body;
      return Response.json(createGeminiResponse(REVIEWS_RESPONSE));
    };
    const provider = createGeminiFibWordProvider('test-key', fetchImpl);
    const candidates = parseGeneratedFibWordCandidates(
      CANDIDATES_RESPONSE,
      'gemini',
      createWordRequest(),
    );

    await expect(provider.reviewBatch(createWordRequest(), candidates)).resolves.toEqual(
      REVIEWS_RESPONSE.reviews,
    );
    expect(requestBody).toContain('独立审核');
    expect(requestBody).toContain('常见成语');
    expect(requestBody).toContain('情绪价值');
    expect(requestBody).not.toContain('previous_interaction_id');
  });

  it('uses one structured request and returns the entire candidate batch', async () => {
    let requestUrl = '';
    let requestBody = '';
    let requestAuthorization: string | null = null;
    let requestSignal: AbortSignal | null = null;
    const fetchImpl: typeof fetch = async (input, init) => {
      requestUrl =
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (typeof init?.body !== 'string') {
        throw new Error('Expected Gemini request body to be a JSON string');
      }
      requestBody = init.body;
      requestAuthorization = new Headers(init.headers).get('authorization');
      requestSignal = init.signal ?? null;
      return Response.json(createGeminiResponse());
    };
    const request = createWordRequest();

    await expect(
      createGeminiFibWordProvider('test-key', fetchImpl).generateBatch(request),
    ).resolves.toHaveLength(6);
    expect(requestUrl).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    );
    expect(requestAuthorization).toBe('Bearer test-key');
    expect(requestSignal).toBe(request.signal);
    expect(requestBody).toContain('"model":"gemini-3.5-flash-lite"');
    expect(requestBody).toContain('"type":"json_schema"');
    expect(requestBody).toContain('返回恰好6个互不重复的候选');
    expect(requestBody).toContain('多数普通玩家在揭晓前不能准确说出固定真义');
    expect(requestBody).toContain('不得用较弱候选凑满数量');
    expect(requestBody).not.toContain('本房间');
    expect(requestBody).not.toContain('google_search');
  });

  it.each([
    { status: 401, failureKind: 'authenticationFailed' },
    { status: 429, failureKind: 'rateLimited' },
    { status: 503, failureKind: 'serviceUnavailable' },
    { status: 400, failureKind: 'requestFailed' },
  ] as const)('classifies HTTP $status as $failureKind', async ({ status, failureKind }) => {
    const fetchImpl: typeof fetch = () =>
      Promise.resolve(new Response('provider failure', { status }));

    await expect(
      createGeminiFibWordProvider('test-key', fetchImpl).generateBatch(createWordRequest()),
    ).rejects.toMatchObject({ failureKind });
  });

  it('classifies malformed structured output as invalidOutput', async () => {
    const fetchImpl: typeof fetch = () =>
      Promise.resolve(Response.json(createGeminiResponse({ candidates: [] })));

    await expect(
      createGeminiFibWordProvider('test-key', fetchImpl).generateBatch(createWordRequest()),
    ).rejects.toMatchObject({ failureKind: 'invalidOutput' });
  });
});
