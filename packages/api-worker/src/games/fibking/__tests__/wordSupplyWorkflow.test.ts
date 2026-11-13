/** Real Workflows orchestration and D1 publication with only external steps replaced. */
import { env, introspectWorkflowInstance } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAiDiagnostic } from '../../../platform/ai/aiError';
import { FibWordProviderError } from '../wordProviders/providerError';
import type { FibWordEditorialCandidate } from '../wordProviders/types';
import {
  FIB_WORD_DAILY_BATCH_LIMIT,
  FIB_WORD_MONTHLY_BATCH_LIMIT,
  publishFibWordPack,
  reserveFibWordPack,
} from '../wordPublication';
import { createFibWordSearchQuery, FIB_WORD_SEARCH_QUERY_COUNT } from '../wordSearchPlan';
import { getFibWordsToClassify, storeFibWordTopics } from '../wordTopicClassification';

beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unexpected external HTTP request')));
  await env.DB.batch([
    env.DB.prepare('DELETE FROM editorial_model_requests'),
    env.DB.prepare('DELETE FROM fib_word_candidates'),
    env.DB.prepare('DELETE FROM fib_word_provider_requests'),
    env.DB.prepare('DELETE FROM fib_word_sequence'),
    env.DB.prepare('DELETE FROM fib_word_candidate_reviews'),
    env.DB.prepare('DELETE FROM fib_words'),
    env.DB.prepare('DELETE FROM fib_word_generation_cycles'),
    env.DB.prepare('DELETE FROM fib_word_packs'),
    env.DB.prepare('DELETE FROM fib_word_supply_months'),
    env.DB.prepare("UPDATE database_capacity SET state = 'normal' WHERE id = 1"),
  ]);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Fib word supply workflow', () => {
  it('retains the model failure kind and safe summary across real Workflow checkpoints', async () => {
    const evidence = [
      {
        query: '词源',
        url: 'https://example.test/source',
        title: '词源资料',
        content: '候选词：用于测试的真实来源原文及其固定释义。',
      },
    ];
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(async () =>
        Response.json(
          { error: { status: 'UNAVAILABLE', message: `Model overloaded ${env.GEMINI_API_KEY}` } },
          { status: 503 },
        ),
      );
    vi.stubGlobal('fetch', fetchImpl);
    const id = crypto.randomUUID();
    const day = new Date().toISOString().slice(0, 10);
    await using instance = await introspectWorkflowInstance(env.FIB_WORD_SUPPLY, id);
    await instance.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepResult({ name: 'enabled' }, true);
      await modifier.mockStepResult({ name: 'discover-0' }, evidence);
      await modifier.mockStepResult({ name: 'extract-0' }, { evidence, failedUrls: [] });
    });
    const workflow = await env.FIB_WORD_SUPPLY.create({ id, params: { day } });
    await instance.waitForStatus('errored');
    const status = await workflow.status();
    const persistedError = new Error(status.error?.message);
    expect(getAiDiagnostic(persistedError)).toMatchObject({
      game: 'fibking',
      operation: 'generate',
      packId: `${day}-0`,
      stage: 'http',
      failureKind: 'serviceUnavailable',
      httpStatus: 503,
    });
    expect(persistedError.message).not.toContain(env.GEMINI_API_KEY);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(
      await env.DB.prepare('SELECT error_code FROM fib_word_generation_cycles').first(),
    ).toEqual({ error_code: 'generation:serviceUnavailable' });
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM editorial_model_requests').first(),
    ).toEqual({ count: 1 });
  });

  it('exits before retention, classification and reservation when budget is exhausted', async () => {
    await env.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 8)
       INSERT INTO editorial_model_requests (id, owner, model, claimed_at)
       SELECT 'budget-' || i, 'test', 'model', ? FROM n`,
    )
      .bind(new Date().toISOString())
      .run();
    const id = crypto.randomUUID();
    await using instance = await introspectWorkflowInstance(env.FIB_WORD_SUPPLY, id);
    await instance.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepResult({ name: 'enabled' }, true);
      await modifier.mockStepError({ name: 'retention' }, new Error('Retention should not run'));
    });
    await env.FIB_WORD_SUPPLY.create({
      id,
      params: { day: new Date().toISOString().slice(0, 10) },
    });
    await instance.waitForStatus('complete');
    expect(await instance.getOutput()).toEqual({ status: 'budget_exhausted' });
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM fib_word_packs').first()).toEqual({
      count: 0,
    });
  });

  it('ignores ambiguous, out-of-range and stale historical classifications', async () => {
    await env.DB.prepare(
      `INSERT INTO fib_words (id, word, core_meaning, usage_note, category, source, status, selection_key, created_at, activated_at)
       VALUES ('a', '甲词', '原释义', '提示', 'niche', 'local', 'active', 1, '2026-01-01', '2026-01-01'),
              ('b', '乙词', '原释义', '提示', 'niche', 'local', 'active', 2, '2026-01-01', '2026-01-01'),
              ('c', '丙词', '原释义', '提示', 'niche', 'local', 'active', 3, '2026-01-01', '2026-01-01'),
              ('d', '丁词', '原释义', '提示', 'niche', 'local', 'active', 4, '2026-01-01', '2026-01-01')`,
    ).run();
    const words = await getFibWordsToClassify(env.DB);
    await env.DB.prepare("UPDATE fib_words SET core_meaning = '新释义' WHERE id = 'c'").run();
    await storeFibWordTopics(env.DB, words, [
      { index: 0, topic: 'food' },
      { index: 0, topic: 'music' },
      { index: 1, topic: 'music' },
      { index: 2, topic: 'food' },
      { index: 99, topic: 'food' },
    ]);
    const rows = await env.DB.prepare('SELECT id, topic FROM fib_words ORDER BY id').all();
    expect(rows.results).toEqual([
      { id: 'a', topic: null },
      { id: 'b', topic: 'music' },
      { id: 'c', topic: null },
      { id: 'd', topic: null },
    ]);
  });

  it('continues supplying words when historical topic classification fails', async () => {
    const reportError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () =>
      Response.json(
        {
          error: {
            status: 'UNAVAILABLE',
            message: `Model overloaded ${env.GEMINI_API_KEY} 旧词`,
          },
        },
        { status: 503 },
      ),
    );
    vi.stubGlobal('fetch', fetchImpl);
    await env.DB.prepare(
      `INSERT INTO fib_words (id, word, core_meaning, usage_note, category, source, status, selection_key, created_at, activated_at)
       VALUES ('legacy', '旧词', '原本的准确释义', '原本的使用提示', 'niche', 'local', 'active', 0, '2026-01-01', '2026-01-01')`,
    ).run();
    const id = crypto.randomUUID();
    await using instance = await introspectWorkflowInstance(env.FIB_WORD_SUPPLY, id);
    await instance.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepResult({ name: 'enabled' }, true);
      await modifier.mockStepResult({ name: 'review-candidates-0' }, []);
      await modifier.mockStepResult({ name: 'discover-0' }, []);
      await modifier.mockStepResult({ name: 'capacity-1' }, 'paused');
    });
    await env.FIB_WORD_SUPPLY.create({
      id,
      params: { day: new Date().toISOString().slice(0, 10) },
    });
    await instance.waitForStatus('complete');
    expect(await instance.getOutput()).toEqual({ status: 'paused' });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining('"operation":"classify"'),
    );
    const diagnostics = JSON.stringify(reportError.mock.calls);
    expect(diagnostics).not.toContain(env.GEMINI_API_KEY);
    expect(diagnostics).not.toContain('旧词');
    expect(
      await env.DB.prepare('SELECT status, topic FROM fib_words WHERE id = ?')
        .bind('legacy')
        .first(),
    ).toEqual({ status: 'active', topic: null });
    expect(
      await env.DB.prepare('SELECT status FROM fib_word_packs WHERE id LIKE ?')
        .bind(`${new Date().toISOString().slice(0, 10)}-0`)
        .first(),
    ).toEqual({ status: 'published' });
  });
  it('classifies existing reviewed inventory without changing its playable state', async () => {
    const day = new Date().toISOString().slice(0, 10);
    const pack = await reserveFibWordPack(env.DB, day, 0, { runId: 'legacy' });
    if (pack === null) throw new Error('Expected legacy pack');
    const candidate: FibWordEditorialCandidate = {
      word: '测试旧词',
      source: 'gemini',
      category: 'niche',
      definition: {
        coreMeaning: '用于测试的准确核心含义。',
        usageNote: '用于测试的具体使用语境。',
      },
      evidence: [
        {
          query: '测试旧词',
          url: 'https://example.com/words',
          title: '测试词源',
          content: '测试旧词：用于测试的准确核心含义。',
        },
      ],
    };
    await publishFibWordPack(
      env.DB,
      pack,
      [candidate],
      [
        {
          word: candidate.word,
          decision: 'accepted',
          reason: '有资料支持且符合游戏性标准。',
          evidenceIndex: 0,
          evidenceQuote: '测试旧词：用于测试的准确核心含义。',
          qualityChecks: {
            isEstablishedTerm: true,
            isDefinitionAccurate: true,
            isMeaningUnfamiliarToMostPlayers: true,
            isMeaningDistinctFromLiteralReading: true,
            hasMultiplePlausibleWrongDefinitions: true,
            hasRevealValue: true,
          },
        },
      ],
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Response.json({
          candidates: [
            {
              finishReason: 'STOP',
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      classifications: [{ index: 0, topic: 'customs' }],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      ),
    );
    const id = crypto.randomUUID();
    await using instance = await introspectWorkflowInstance(env.FIB_WORD_SUPPLY, id);
    await instance.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepResult({ name: 'enabled' }, true);
      await modifier.mockStepResult({ name: 'discover-0' }, []);
      await modifier.mockStepResult({ name: 'capacity-1' }, 'paused');
    });
    await env.FIB_WORD_SUPPLY.create({ id, params: { day } });
    await instance.waitForStatus('complete');
    expect(await instance.getOutput()).toEqual({ status: 'paused' });
    expect(await env.DB.prepare('SELECT word, status, topic FROM fib_words').first()).toEqual({
      word: candidate.word,
      status: 'active',
      topic: 'customs',
    });
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM fib_word_sequence').first()).toEqual(
      { count: 1 },
    );
    expect(await env.DB.prepare('SELECT owner FROM editorial_model_requests').first()).toEqual({
      owner: 'fibking',
    });
    expect(
      await env.DB.prepare('SELECT topic FROM fib_word_packs WHERE id = ?')
        .bind(`${day}-0`)
        .first(),
    ).toEqual({ topic: 'agriculture' });
  });

  it('covers the entire monthly budget with distinct non-cycling searches', () => {
    const queries = Array.from({ length: FIB_WORD_MONTHLY_BATCH_LIMIT }, (_, index) =>
      createFibWordSearchQuery(index),
    );
    expect(new Set(queries).size).toBe(FIB_WORD_MONTHLY_BATCH_LIMIT);
    expect(() => createFibWordSearchQuery(FIB_WORD_SEARCH_QUERY_COUNT)).toThrow('out of range');
  });
  it.each([FIB_WORD_DAILY_BATCH_LIMIT, FIB_WORD_MONTHLY_BATCH_LIMIT])(
    'reviews persisted overflow within a %i-batch run without repeating consumed batches',
    async (batchLimit) => {
      const day = new Date().toISOString().slice(0, 10);
      const id = crypto.randomUUID();
      const batchIndex = batchLimit === FIB_WORD_DAILY_BATCH_LIMIT ? 0 : FIB_WORD_DAILY_BATCH_LIMIT;
      for (let index = 0; index < batchIndex; index += 1) {
        await reserveFibWordPack(env.DB, day, index);
      }
      const words = [
        '测试甲',
        '测试乙',
        '测试丙',
        '测试丁',
        '测试戊',
        '测试己',
        '测试庚',
        '测试辛',
      ];
      const evidence = [
        {
          query: '传统器物',
          url: 'https://example.com/words',
          title: '测试词源',
          content: words.map((word) => `${word}：用于测试的准确核心含义。`).join('\n'),
        },
      ];
      const candidates: FibWordEditorialCandidate[] = words.map((word, index) => ({
        word,
        source: 'gemini',
        category: index % 2 === 0 ? 'literary' : 'niche',
        evidence,
        definition: {
          coreMeaning: '用于测试的准确核心含义。',
          usageNote: '用于测试的具体使用语境。',
        },
      }));
      const reviews = words.map((word) => ({
        word,
        decision: 'accepted',
        reason: '有资料支持且符合游戏性标准。',
        evidenceIndex: 0,
        evidenceQuote: `${word}：用于测试的准确核心含义。`,
        qualityChecks: {
          isEstablishedTerm: true,
          isDefinitionAccurate: true,
          isMeaningUnfamiliarToMostPlayers: true,
          isMeaningDistinctFromLiteralReading: true,
          hasMultiplePlausibleWrongDefinitions: true,
          hasRevealValue: true,
        },
      }));
      await using instance = await introspectWorkflowInstance(env.FIB_WORD_SUPPLY, id);
      await instance.modify(async (modifier) => {
        await modifier.disableSleeps();
        await modifier.mockStepResult({ name: 'enabled' }, true);
        await modifier.mockStepResult({ name: `discover-${batchIndex}` }, evidence);
        await modifier.mockStepResult(
          { name: `extract-${batchIndex}` },
          { evidence, failedUrls: [] },
        );
        await modifier.mockStepResult({ name: `generate-${batchIndex}` }, candidates);
        await modifier.mockStepResult({ name: `review-${batchIndex}` }, reviews.slice(0, 6));
        await modifier.mockStepResult({ name: `review-${batchIndex + 1}` }, reviews.slice(6));
        await modifier.mockStepError(
          { name: `discover-${batchIndex + 1}` },
          new Error('Persisted candidates must not trigger discovery'),
        );
        await modifier.mockStepResult({ name: `capacity-${batchIndex + 2}` }, 'paused');
      });
      await env.FIB_WORD_SUPPLY.create({ id, params: { day, batchLimit } });
      await instance.waitForStatus('complete');
      expect(await instance.getOutput()).toEqual({ status: 'paused' });
      expect(
        await env.DB.prepare('SELECT COUNT(*) AS count FROM fib_word_candidates').first(),
      ).toEqual({ count: 0 });
      expect(
        await env.DB.prepare('SELECT COUNT(*) AS count FROM fib_word_sequence').first(),
      ).toEqual({ count: 8 });
      expect(
        await env.DB.prepare(
          'SELECT requests_reserved, published_count FROM fib_word_supply_months',
        ).first(),
      ).toEqual({ requests_reserved: batchIndex + 2, published_count: 8 });
    },
  );

  it('re-reviews three unsourced inventory words without generation or resequencing', async () => {
    const day = new Date().toISOString().slice(0, 10);
    const id = crypto.randomUUID();
    const words = ['幸存者偏差', '琼浆', '觊觎', '验证余词'];
    const candidates = words.map((word) => ({
      word,
      definition: {
        coreMeaning: '用于测试的准确核心含义。',
        usageNote: '用于测试的具体使用语境。',
      },
    }));
    for (const candidate of candidates) {
      await env.DB.prepare(
        `INSERT INTO fib_words (id, word, core_meaning, usage_note, category, source,
           status, selection_key, created_at, activated_at)
           VALUES (?, ?, ?, ?, 'literary', 'local', 'active', 0, '2026-01-01', '2026-01-01')`,
      )
        .bind(
          candidate.word,
          candidate.word,
          candidate.definition.coreMeaning,
          candidate.definition.usageNote,
        )
        .run();
      await env.DB.prepare(
        "INSERT INTO fib_word_sequence (word, published_at) VALUES (?, '2026-01-01')",
      )
        .bind(candidate.word)
        .run();
    }
    const reviews = words.slice(0, 3).map((word) => ({
      word,
      decision: 'rejected',
      reason: '常见词义或熟语已经暴露核心答案。',
      evidenceIndex: 0,
      evidenceQuote: `${word}：用于测试的准确核心含义。`,
      qualityChecks: {
        isEstablishedTerm: true,
        isDefinitionAccurate: true,
        isMeaningUnfamiliarToMostPlayers: false,
        isMeaningDistinctFromLiteralReading: true,
        hasMultiplePlausibleWrongDefinitions: true,
        hasRevealValue: true,
      },
    }));
    await using instance = await introspectWorkflowInstance(env.FIB_WORD_SUPPLY, id);
    await instance.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepResult({ name: 'enabled' }, true);
      for (const [index, word] of words.slice(0, 3).entries()) {
        const sources = [
          {
            query: word,
            url: `https://example.com/${index}`,
            title: word,
            content: '搜索摘要不作为审核证据。',
          },
        ];
        await modifier.mockStepResult({ name: `verify-0-${index}` }, sources);
        await modifier.mockStepResult(
          { name: `extract-verification-0-${index}` },
          {
            evidence: sources.map((source) => ({
              ...source,
              content: `${word}：用于测试的准确核心含义。`,
            })),
            failedUrls: [],
          },
        );
      }
      await modifier.mockStepResult({ name: 'review-0' }, reviews);
      await modifier.mockStepResult({ name: 'capacity-1' }, 'paused');
    });
    await env.FIB_WORD_SUPPLY.create({ id, params: { day } });
    await instance.waitForStatus('complete');
    expect(await instance.getOutput()).toEqual({ status: 'paused' });
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM fib_word_sequence').first()).toEqual(
      { count: 4 },
    );
    expect(
      await env.DB.prepare(
        'SELECT requests_reserved, published_count FROM fib_word_supply_months',
      ).first(),
    ).toEqual({ requests_reserved: 1, published_count: 0 });
    expect(
      (
        await env.DB.prepare(
          "SELECT word FROM fib_words WHERE status = 'disabled' ORDER BY word",
        ).all()
      ).results,
    ).toEqual(words.slice(0, 3).map((word) => ({ word })));
    expect(
      (await env.DB.prepare('SELECT word FROM fib_word_sequence ORDER BY id').all()).results,
    ).toEqual(words.map((word) => ({ word })));
    expect(await env.DB.prepare('SELECT word, status FROM fib_word_candidates').first()).toEqual({
      word: '验证余词',
      status: 'pending',
    });
  });

  it.each(['discovery', 'extraction', 'generation'])(
    'records empty %s without review or publication',
    async (failureStage) => {
      const day = new Date().toISOString().slice(0, 10);
      const id = crypto.randomUUID();
      const evidence = [
        {
          query: '词源',
          url: 'https://example.com/words',
          title: '词源',
          content: '用于测试的词源资料。',
        },
      ];
      await using instance = await introspectWorkflowInstance(env.FIB_WORD_SUPPLY, id);
      await instance.modify(async (modifier) => {
        await modifier.disableSleeps();
        await modifier.mockStepResult({ name: 'enabled' }, true);
        await modifier.mockStepResult(
          { name: 'discover-0' },
          failureStage === 'discovery' ? [] : evidence,
        );
        if (failureStage !== 'discovery') {
          await modifier.mockStepResult(
            { name: 'extract-0' },
            failureStage === 'extraction'
              ? { evidence: [], failedUrls: ['https://example.com/words'] }
              : { evidence, failedUrls: [] },
          );
        }
        if (failureStage === 'generation')
          await modifier.mockStepResult({ name: 'generate-0' }, []);
        await modifier.mockStepResult({ name: 'capacity-1' }, 'paused');
      });
      await env.FIB_WORD_SUPPLY.create({ id, params: { day } });
      await instance.waitForStatus('complete');
      expect(await env.DB.prepare('SELECT status, outcome FROM fib_word_packs').first()).toEqual({
        status: 'published',
        outcome: 'noCandidates',
      });
      expect(
        await env.DB.prepare('SELECT COUNT(*) AS count FROM fib_word_sequence').first(),
      ).toEqual({ count: 0 });
      expect(
        await env.DB.prepare('SELECT COUNT(*) AS count FROM fib_word_candidate_reviews').first(),
      ).toEqual({ count: 0 });
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it('makes a failed external call terminal without refunding the budget', async () => {
    const day = new Date().toISOString().slice(0, 10);
    const id = crypto.randomUUID();
    await using instance = await introspectWorkflowInstance(env.FIB_WORD_SUPPLY, id);
    await instance.modify(async (modifier) => {
      await modifier.mockStepResult({ name: 'enabled' }, true);
      await modifier.mockStepError(
        { name: 'discover-0' },
        new FibWordProviderError('quota exhausted', 'rateLimited'),
      );
    });
    await env.FIB_WORD_SUPPLY.create({ id, params: { day } });
    await instance.waitForStatus('errored');
    expect(await env.DB.prepare('SELECT status FROM fib_word_packs').first()).toEqual({
      status: 'failed',
    });
    expect(
      await env.DB.prepare('SELECT requests_reserved FROM fib_word_supply_months').first(),
    ).toEqual({ requests_reserved: 1 });
    expect(
      await env.DB.prepare('SELECT error_code FROM fib_word_generation_cycles').first(),
    ).toEqual({
      error_code: 'discovery:rateLimited',
    });
  });
});
