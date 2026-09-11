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

const CANDIDATE_REFERENCES_RESPONSE = {
  candidates: CANDIDATES_RESPONSE.candidates.map((candidate, index) => ({
    ...candidate,
    citations: [{ evidenceIndex: 0, quote: `source0quote${index}` }],
  })),
};
const REVIEW_REFERENCES_RESPONSE = {
  reviews: REVIEWS_RESPONSE.reviews.map((review, index) => ({
    ...review,
    evidenceQuote: `source0quote${index}`,
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

function createGeminiResponse(
  payload: unknown = CANDIDATE_REFERENCES_RESPONSE,
): Record<string, unknown> {
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
    { word: '关扑', heading: '關撲' },
    { word: '關撲', heading: '关扑' },
  ])('matches $word against $heading without rewriting evidence', ({ word, heading }) => {
    const request = createWordRequest();
    const evidenceQuote = '我們或可將它稱之為贏錢賭物的遊戲。';
    const evidence = request.evidence.map((source) => ({
      ...source,
      content: `${heading}\n${evidenceQuote}`,
    }));
    const candidates = parseGeneratedFibWordCandidates(
      {
        candidates: [
          {
            word,
            definition: LITERARY_DEFINITION,
            category: 'literary',
            citations: [{ evidenceIndex: 0, quote: evidenceQuote }],
          },
        ],
      },
      'gemini',
      { ...request, evidence },
    );
    const payload = {
      reviews: [
        {
          word,
          qualityChecks: PASSING_QUALITY_CHECKS,
          reason: '此测试仅验证引用格式，不代表词义质量。',
          evidenceIndex: 0,
          evidenceQuote,
        },
      ],
    };
    const reviews = parseFibWordReviews(payload, candidates);
    expect(candidates[0]).toMatchObject({ word, evidence });
    expect(reviews[0]).toMatchObject({ decision: 'accepted', evidenceQuote });
    expect(() => assertFibWordReviewEvidence(candidates[0], reviews[0])).not.toThrow();
    expect(() =>
      parseFibWordReviews(
        {
          reviews: payload.reviews.map((review) => ({
            ...review,
            evidenceQuote: '我们或可将它称之为赢钱赌物的游戏。',
          })),
        },
        candidates,
      ),
    ).toThrow('invalid evidence citation');
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
  it('binds reordered reviews to each candidate before resolving local quote references', async () => {
    const request = createWordRequest();
    const candidates = parseGeneratedFibWordCandidates(CANDIDATES_RESPONSE, 'gemini', request).map(
      (candidate) => ({
        ...candidate,
        evidence: candidate.evidence.map((source) => ({
          ...source,
          content: `${candidate.word}：${LITERARY_DEFINITION.coreMeaning}`,
        })),
      }),
    );
    const fetchImpl: typeof fetch = async () =>
      Response.json(
        createGeminiResponse({
          reviews: [...REVIEW_REFERENCES_RESPONSE.reviews]
            .reverse()
            .map((review) => ({ ...review, evidenceQuote: 'source0quote0' })),
        }),
      );

    await expect(
      createGeminiFibWordProvider('test-key', fetchImpl).reviewBatch(request, candidates),
    ).resolves.toEqual(
      REVIEWS_RESPONSE.reviews.map((review, index) => ({
        ...review,
        decision: index === 0 ? 'rejected' : 'accepted',
      })),
    );
  });

  it.each(['missing', 'duplicate', 'unknown'] as const)(
    'rejects %s candidate identities instead of guessing a match',
    async (failureKind) => {
      const reviews = REVIEW_REFERENCES_RESPONSE.reviews.map((review, index) => ({
        ...review,
        word:
          index === 2 && failureKind !== 'missing'
            ? failureKind === 'duplicate'
              ? '菡萏'
              : '未知词'
            : review.word,
      }));
      const fetchImpl: typeof fetch = async () =>
        Response.json(
          createGeminiResponse({
            reviews: failureKind === 'missing' ? reviews.slice(1) : reviews,
          }),
        );
      const candidates = parseGeneratedFibWordCandidates(
        CANDIDATES_RESPONSE,
        'gemini',
        createWordRequest(),
      );

      await expect(
        createGeminiFibWordProvider('test-key', fetchImpl).reviewBatch(
          createWordRequest(),
          candidates,
        ),
      ).rejects.toThrow(
        failureKind === 'missing'
          ? 'Fib word review batch size mismatch'
          : `Fib word review returned ${failureKind === 'unknown' ? 'an unknown' : 'a duplicate'} candidate`,
      );
    },
  );

  it.each(['unknown-reference', LITERARY_DEFINITION.coreMeaning])(
    'rejects invalid or rewritten evidence references: %s',
    async (quote) => {
      const response = {
        candidates: CANDIDATE_REFERENCES_RESPONSE.candidates.map((candidate) => ({
          ...candidate,
          citations: [{ evidenceIndex: 0, quote }],
        })),
      };
      const fetchImpl: typeof fetch = async () => Response.json(createGeminiResponse(response));
      await expect(
        createGeminiFibWordProvider('test-key', fetchImpl).generateBatch(createWordRequest()),
      ).rejects.toMatchObject({ failureKind: 'invalidOutput' });
    },
  );

  it('rejects a valid quote reference paired with a different source', async () => {
    const response = {
      reviews: REVIEW_REFERENCES_RESPONSE.reviews.map((review) => ({
        ...review,
        evidenceIndex: 1,
      })),
    };
    const fetchImpl: typeof fetch = async () => Response.json(createGeminiResponse(response));
    const candidates = parseGeneratedFibWordCandidates(
      CANDIDATES_RESPONSE,
      'gemini',
      createWordRequest(),
    );
    await expect(
      createGeminiFibWordProvider('test-key', fetchImpl).reviewBatch(
        createWordRequest(),
        candidates,
      ),
    ).rejects.toThrow(
      '[invalidOutput] Gemini Fib word response was invalid (outputValidation): Invalid Fib word evidence reference: source0quote0',
    );
  });

  it('does not generate without bounded source sentences and can reject unsourced reviews', async () => {
    const request = { ...createWordRequest(), evidence: [] };
    const candidates = parseGeneratedFibWordCandidates(
      CANDIDATES_RESPONSE,
      'gemini',
      createWordRequest(),
    ).map((candidate) => ({ ...candidate, evidence: [] }));
    let requestCount = 0;
    const fetchImpl: typeof fetch = async () => {
      requestCount += 1;
      return Response.json(
        createGeminiResponse({
          reviews: REVIEW_REFERENCES_RESPONSE.reviews.map((review) => ({
            ...review,
            evidenceIndex: null,
            evidenceQuote: null,
            qualityChecks: { ...review.qualityChecks, isDefinitionAccurate: false },
          })),
        }),
      );
    };
    const provider = createGeminiFibWordProvider('test-key', fetchImpl);
    await expect(provider.generateBatch(request)).resolves.toEqual([]);
    expect(requestCount).toBe(0);
    expect(
      (await provider.reviewBatch(request, candidates)).every(
        (review) => review.decision === 'rejected',
      ),
    ).toBe(true);
    expect(requestCount).toBe(1);
  });

  it('does not send a model request for an empty review batch', async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error('Empty batches must not consume external quota');
    };
    await expect(
      createGeminiFibWordProvider('test-key', fetchImpl).reviewBatch(createWordRequest(), []),
    ).resolves.toEqual([]);
  });

  it('preserves the global fetch receiver for generation and review', async () => {
    let response: unknown = CANDIDATE_REFERENCES_RESPONSE;
    const fetchImpl: typeof fetch = async function (this: unknown) {
      expect(this === globalThis).toBe(true);
      return Response.json(createGeminiResponse(response));
    };
    const provider = createGeminiFibWordProvider('test-key', fetchImpl);
    const candidates = await provider.generateBatch(createWordRequest());
    expect(candidates).toHaveLength(CANDIDATES_RESPONSE.candidates.length);

    response = REVIEW_REFERENCES_RESPONSE;
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
      return Response.json(createGeminiResponse(REVIEW_REFERENCES_RESPONSE));
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
    expect(requestBody).toContain('游戏界面提供带声调拼音');
    expect(requestBody).toContain('不得仅因生僻字、不会认字或原本不会读而设为 false');
    expect(requestBody).not.toContain('仅认读困难时 isEasyToReadAloud 设为 false');
    expect(
      FIB_WORD_REVIEWS_JSON_SCHEMA.properties.reviews.items.properties.qualityChecks.properties
        .isEasyToReadAloud.description,
    ).toBe('多数普通玩家是否能借助界面提供的拼音口述词面，不要求原先认识汉字或知道读音');
    expect(requestBody).toContain(
      `"word":{"type":"string","enum":${JSON.stringify(candidates.map(({ word }) => word))}}`,
    );
    expect(requestBody).toContain('常见成语');
    expect(requestBody).toContain('情绪价值');
    expect(requestBody).toContain('坏题“觊觎”');
    expect(requestBody).toContain('坏题“琼浆”');
    expect(requestBody).toContain('坏题“幸存者偏差”');
    expect(requestBody).toContain('常见熟语搭配');
    expect(requestBody).toContain('七项人工逐项标注');
    expect(requestBody).toContain('不是来源证据或自动放行名单');
    for (const word of [
      '步障',
      '关扑',
      '料器',
      '汤婆子',
      '青精饭',
      '合生',
      '竹夫人',
      '虎子',
      '转席',
      '青庐',
      '障车',
      '催妆',
      '撒帐',
      '合髻',
      '却扇',
    ]) {
      expect(requestBody).toContain(`${word}：`);
    }
    expect(requestBody).toContain('仅猜到所属大类、材料或大致场景，不等于猜中');
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
    expect(requestBody).toContain('游戏性由后续独立审核统一判断');
    expect(requestBody).toContain('词项真实性、释义与证据对应、候选多样性');
    expect(requestBody).toContain('没有支持释义的片段就不输出该候选');
    expect(requestBody).toContain('按证据明确程度和概念多样性排列');
    expect(requestBody).not.toContain('按出题质量从高到低排列');
    expect(requestBody).not.toContain('多数普通玩家在揭晓前不能准确说出固定真义');
    expect(requestBody).not.toContain('<difficulty_rejection>');
    expect(requestBody).not.toContain('<calibration_examples>');
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
    ).rejects.toThrow(/\[invalidOutput\][\s\S]*outputValidation[\s\S]*candidates/);
  });

  it('redacts credentials from invalid-output diagnostics', async () => {
    const fetchImpl: typeof fetch = async () =>
      Response.json(
        createGeminiResponse({
          candidates: [
            {
              ...CANDIDATE_REFERENCES_RESPONSE.candidates[0],
              citations: [{ evidenceIndex: 0, quote: 'test-key' }],
            },
          ],
        }),
      );

    await expect(
      createGeminiFibWordProvider('test-key', fetchImpl).generateBatch(createWordRequest()),
    ).rejects.toMatchObject({
      message:
        '[invalidOutput] Gemini Fib word response was invalid (outputValidation): Invalid Fib word evidence reference: [REDACTED]',
    });
  });
});
