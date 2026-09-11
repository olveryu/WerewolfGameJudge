/** Gemini FibKing batch-provider schema and transport contracts. */

import { describe, expect, it } from 'vitest';

import {
  assertFibWordReviewEvidence,
  FIB_WORD_CANDIDATES_JSON_SCHEMA,
  FIB_WORD_JSON_SCHEMA,
  FIB_WORD_REVIEWS_JSON_SCHEMA,
  parseFibWordReviews,
  parseGeneratedFibWordCandidates,
} from '../candidate';
import { createGeminiFibWordProvider } from '../gemini';
import { FIB_WORD_GENERATION_BATCH_LIMIT, type FibWordRequest } from '../types';

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
    citations: [{ evidenceIndex: 0, quote: `${word}：${LITERARY_DEFINITION.coreMeaning}` }],
  })),
};
const PASSING_QUALITY_CHECKS = {
  isEstablishedTerm: true,
  isDefinitionAccurate: true,
  isEasyToReadAloud: true,
  isMeaningUnfamiliarToMostPlayers: true,
  isMeaningDistinctFromLiteralReading: true,
  hasMultiplePlausibleWrongDefinitions: true,
  hasRevealValue: true,
} as const;
const REVIEWS_RESPONSE = {
  reviews: CANDIDATES_RESPONSE.candidates.map(({ word }, candidateIndex) => ({
    word,
    qualityChecks: {
      ...PASSING_QUALITY_CHECKS,
      isMeaningUnfamiliarToMostPlayers: candidateIndex !== 0,
    },
    reason:
      word === '菡萏'
        ? '词义已被多数玩家熟知，无法形成真假释义悬念。'
        : '真实含义不透明且便于编造可信释义。',
    evidenceIndex: 0,
    evidenceQuote: `${word}：${LITERARY_DEFINITION.coreMeaning}`,
  })),
};

function createWordRequest(): FibWordRequest {
  return {
    category: 'literary',
    evidence: [
      {
        query: '词源资料',
        url: 'https://example.com/terms',
        title: '格式契约测试资料，不代表真实词义或质量',
        content: CANDIDATES_RESPONSE.candidates
          .flatMap(({ citations }) => citations.map(({ quote }) => quote))
          .join('\n'),
      },
    ],
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
      CANDIDATES_RESPONSE.candidates.map(({ word, definition, category }) => ({
        word,
        definition,
        category,
        evidence: createWordRequest().evidence,
        source: 'gemini',
      })),
    );
    expect(FIB_WORD_CANDIDATES_JSON_SCHEMA.properties.candidates).toMatchObject({
      items: FIB_WORD_JSON_SCHEMA,
      minItems: 0,
      maxItems: FIB_WORD_GENERATION_BATCH_LIMIT,
    });
  });

  it('accepts a partial or empty batch without requiring filler candidates', () => {
    expect(
      parseGeneratedFibWordCandidates(
        { candidates: CANDIDATES_RESPONSE.candidates.slice(0, 2) },
        'gemini',
        createWordRequest(),
      ),
    ).toHaveLength(2);
    expect(
      parseGeneratedFibWordCandidates({ candidates: [] }, 'gemini', createWordRequest()),
    ).toEqual([]);
  });

  it('preserves per-word categories and requires exactly the partial review batch', () => {
    const candidates = parseGeneratedFibWordCandidates(
      {
        candidates: CANDIDATES_RESPONSE.candidates.slice(0, 2).map((candidate, index) => ({
          ...candidate,
          category: index === 0 ? 'niche' : 'literary',
        })),
      },
      'gemini',
      createWordRequest(),
    );
    expect(candidates.map(({ category }) => category)).toEqual(['niche', 'literary']);
    expect(
      parseFibWordReviews({ reviews: REVIEWS_RESPONSE.reviews.slice(0, 2) }, candidates),
    ).toHaveLength(2);
    expect(() =>
      parseFibWordReviews({ reviews: REVIEWS_RESPONSE.reviews.slice(0, 1) }, candidates),
    ).toThrow('batch size mismatch');
  });

  it.each([
    { evidenceIndex: 1, quote: '菡萏：荷花的别称，古人常在诗文中用来称呼荷花。' },
    { evidenceIndex: 0, quote: '菡萏：资料中没有这段释义。' },
  ])('rejects an invented source reference or quotation', (citation) => {
    expect(() =>
      parseGeneratedFibWordCandidates(
        {
          candidates: CANDIDATES_RESPONSE.candidates.slice(0, 1).map((candidate) => ({
            ...candidate,
            citations: [citation],
          })),
        },
        'gemini',
        createWordRequest(),
      ),
    ).toThrow('invalid evidence citation');
  });

  it('accepts separate dictionary headings and preserves the original quote whitespace', () => {
    const request = createWordRequest();
    const evidenceQuote = '荷花的别称，\n古人常在诗文中用来称呼荷花。';
    const evidence = request.evidence.map((source) => ({
      ...source,
      content: `菡萏\n词目与读音\n${evidenceQuote}`,
    }));
    const candidates = parseGeneratedFibWordCandidates(
      {
        candidates: CANDIDATES_RESPONSE.candidates.slice(0, 1).map((candidate) => ({
          ...candidate,
          citations: [{ evidenceIndex: 0, quote: evidenceQuote.replace('\n', ' ') }],
        })),
      },
      'gemini',
      { ...request, evidence },
    );
    const reviews = parseFibWordReviews(
      {
        reviews: REVIEWS_RESPONSE.reviews.slice(0, 1).map((review) => ({
          ...review,
          qualityChecks: PASSING_QUALITY_CHECKS,
          evidenceQuote: evidenceQuote.replace('\n', ' '),
        })),
      },
      candidates,
    );
    expect(reviews[0]).toMatchObject({ decision: 'accepted', evidenceQuote });
    expect(() => assertFibWordReviewEvidence(candidates[0], reviews[0])).not.toThrow();
  });

  it.each([
    '荷花的别称，古人常在诗文中用来称呼莲花。',
    '荷花的别称，\n其他段落\n古人常在诗文中用来称呼荷花。',
  ])('rejects rewritten or stitched quotations: %s', (content) => {
    const request = createWordRequest();
    const candidates = parseGeneratedFibWordCandidates(
      { candidates: CANDIDATES_RESPONSE.candidates.slice(0, 1) },
      'gemini',
      request,
    ).map((candidate) => ({
      ...candidate,
      evidence: candidate.evidence.map((source) => ({ ...source, content: `菡萏\n${content}` })),
    }));
    expect(() =>
      parseFibWordReviews(
        {
          reviews: REVIEWS_RESPONSE.reviews.slice(0, 1).map((review) => ({
            ...review,
            evidenceQuote: LITERARY_DEFINITION.coreMeaning,
          })),
        },
        candidates,
      ),
    ).toThrow('invalid evidence citation');
  });

  it('rejects a definition source that does not contain the candidate word', () => {
    const request = createWordRequest();
    expect(() =>
      parseGeneratedFibWordCandidates(
        {
          candidates: CANDIDATES_RESPONSE.candidates.slice(0, 1).map((candidate) => ({
            ...candidate,
            citations: [{ evidenceIndex: 0, quote: LITERARY_DEFINITION.coreMeaning }],
          })),
        },
        'gemini',
        {
          ...request,
          evidence: request.evidence.map((source) => ({
            ...source,
            content: LITERARY_DEFINITION.coreMeaning,
          })),
        },
      ),
    ).toThrow('invalid evidence citation');
  });

  it('cannot accept without a verifiable evidence quote, but can reject missing evidence', () => {
    const candidates = parseGeneratedFibWordCandidates(
      { candidates: CANDIDATES_RESPONSE.candidates.slice(0, 1) },
      'gemini',
      createWordRequest(),
    );
    const reviews = REVIEWS_RESPONSE.reviews.slice(0, 1).map((review) => ({
      ...review,
      qualityChecks: PASSING_QUALITY_CHECKS,
      evidenceIndex: null,
      evidenceQuote: null,
    }));
    expect(() => parseFibWordReviews({ reviews }, candidates)).toThrow('invalid evidence citation');
    expect(
      parseFibWordReviews(
        {
          reviews: reviews.map((review) => ({
            ...review,
            qualityChecks: { ...review.qualityChecks, isDefinitionAccurate: false },
          })),
        },
        candidates,
      ),
    ).toMatchObject([{ decision: 'rejected', evidenceIndex: null }]);
  });

  it('rejects oversized batches, duplicates, invalid categories, and unknown fields', () => {
    expect(() =>
      parseGeneratedFibWordCandidates(
        {
          candidates: [
            ...CANDIDATES_RESPONSE.candidates,
            ...CANDIDATES_RESPONSE.candidates,
            CANDIDATES_RESPONSE.candidates[0],
          ],
        },
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
            index === 0 ? { ...candidate, category: 'invalid' } : candidate,
          ),
        },
        'gemini',
        createWordRequest(),
      ),
    ).toThrow();
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

    expect(parseFibWordReviews(REVIEWS_RESPONSE, candidates)).toEqual(
      REVIEWS_RESPONSE.reviews.map((review, candidateIndex) => ({
        ...review,
        decision: candidateIndex === 0 ? 'rejected' : 'accepted',
      })),
    );
    expect(FIB_WORD_REVIEWS_JSON_SCHEMA.properties.reviews).toMatchObject({
      minItems: 1,
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

  it.each([
    {
      failedCheck: 'isEstablishedTerm',
      qualityChecks: { ...PASSING_QUALITY_CHECKS, isEstablishedTerm: false },
    },
    {
      failedCheck: 'isDefinitionAccurate',
      qualityChecks: { ...PASSING_QUALITY_CHECKS, isDefinitionAccurate: false },
    },
    {
      failedCheck: 'isEasyToReadAloud',
      qualityChecks: { ...PASSING_QUALITY_CHECKS, isEasyToReadAloud: false },
    },
    {
      failedCheck: 'isMeaningUnfamiliarToMostPlayers',
      qualityChecks: { ...PASSING_QUALITY_CHECKS, isMeaningUnfamiliarToMostPlayers: false },
    },
    {
      failedCheck: 'isMeaningDistinctFromLiteralReading',
      qualityChecks: { ...PASSING_QUALITY_CHECKS, isMeaningDistinctFromLiteralReading: false },
    },
    {
      failedCheck: 'hasMultiplePlausibleWrongDefinitions',
      qualityChecks: { ...PASSING_QUALITY_CHECKS, hasMultiplePlausibleWrongDefinitions: false },
    },
    {
      failedCheck: 'hasRevealValue',
      qualityChecks: { ...PASSING_QUALITY_CHECKS, hasRevealValue: false },
    },
  ])('derives rejection when $failedCheck fails', ({ qualityChecks }) => {
    const candidates = parseGeneratedFibWordCandidates(
      CANDIDATES_RESPONSE,
      'gemini',
      createWordRequest(),
    );
    const response = {
      reviews: REVIEWS_RESPONSE.reviews.map((review, candidateIndex) =>
        candidateIndex === 0 ? { ...review, qualityChecks } : review,
      ),
    };

    expect(parseFibWordReviews(response, candidates)[0]).toMatchObject({
      word: '菡萏',
      decision: 'rejected',
    });
  });
});

describe('Gemini Fib word provider', () => {
  it('does not send a model request for an empty review batch', async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error('Empty batches must not consume external quota');
    };
    await expect(
      createGeminiFibWordProvider('test-key', fetchImpl).reviewBatch(createWordRequest(), []),
    ).resolves.toEqual([]);
  });

  it('preserves the global fetch receiver for generation and review', async () => {
    let response: unknown = CANDIDATES_RESPONSE;
    const fetchImpl: typeof fetch = async function (this: unknown) {
      expect(this === globalThis).toBe(true);
      return Response.json(createGeminiResponse(response));
    };
    const provider = createGeminiFibWordProvider('test-key', fetchImpl);
    const candidates = await provider.generateBatch(createWordRequest());
    expect(candidates).toHaveLength(CANDIDATES_RESPONSE.candidates.length);

    response = REVIEWS_RESPONSE;
    await expect(provider.reviewBatch(createWordRequest(), candidates)).resolves.toHaveLength(
      REVIEWS_RESPONSE.reviews.length,
    );
  });

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
      REVIEWS_RESPONSE.reviews.map((review, candidateIndex) => ({
        ...review,
        decision: candidateIndex === 0 ? 'rejected' : 'accepted',
      })),
    );
    expect(requestBody).toContain('独立审核');
    expect(requestBody).toContain('常见成语');
    expect(requestBody).toContain('情绪价值');
    expect(requestBody).toContain('坏题“觊觎”');
    expect(requestBody).toContain('坏题“琼浆”');
    expect(requestBody).toContain('坏题“幸存者偏差”');
    expect(requestBody).toContain('常见熟语搭配');
    expect(requestBody).toContain('reason 用八至一百字中文记录具体审核依据');
    expect(requestBody).not.toContain('接受“打尖”');
    expect(requestBody).not.toContain('接受“鸟笼效应”');
    expect(requestBody).toContain('isMeaningDistinctFromLiteralReading');
    expect(requestBody).not.toContain('"decision"');
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
    expect(requestBody).toContain('返回零到12个互不重复的候选');
    expect(requestBody).toContain('多数普通玩家在揭晓前不能准确说出固定真义');
    expect(requestBody).toContain('不得用较弱候选凑满数量');
    expect(requestBody).toContain('坏题“觊觎”');
    expect(requestBody).toContain('坏题“琼浆”');
    expect(requestBody).toContain('坏题“幸存者偏差”');
    expect(requestBody).toContain('搜索结果少不能证明冷门');
    expect(requestBody).not.toContain('好题“打尖”');
    expect(requestBody).not.toContain('好题“鸟笼效应”');
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

  it('preserves transport diagnostics without request credentials', async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new TypeError('Invalid header Bearer test-key at https://example.com/?key=test-key');
    };
    await expect(
      createGeminiFibWordProvider('test-key', fetchImpl).generateBatch(createWordRequest()),
    ).rejects.toMatchObject({
      message:
        '[requestFailed] Gemini Fib word request failed: Invalid header Bearer [REDACTED] at [URL]',
      failureKind: 'requestFailed',
    });
  });

  it('classifies malformed structured output as invalidOutput', async () => {
    const fetchImpl: typeof fetch = () =>
      Promise.resolve(Response.json(createGeminiResponse({ candidates: null })));

    await expect(
      createGeminiFibWordProvider('test-key', fetchImpl).generateBatch(createWordRequest()),
    ).rejects.toMatchObject({ failureKind: 'invalidOutput' });
  });
});
