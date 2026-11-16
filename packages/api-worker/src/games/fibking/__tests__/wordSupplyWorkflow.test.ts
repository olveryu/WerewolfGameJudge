/** Real Workflows orchestration and D1 generation with only external steps replaced. */
import { env, introspectWorkflowInstance } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAiDiagnostic } from '../../../platform/ai/aiError';
import { getFibWordsToClassify, storeFibWordCategories } from '../wordCategoryClassification';
import { FibWordProviderError } from '../wordProviders/providerError';
import type { FibWordEditorialCandidate } from '../wordProviders/types';
import { createFibWordSearchQuery, FIB_WORD_SEARCH_QUERY_COUNT } from '../wordSearchPlan';

beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unexpected external HTTP request')));
  await env.DB.batch([
    env.DB.prepare('DELETE FROM editorial_model_requests'),
    env.DB.prepare('DELETE FROM fib_word_provider_requests'),
    env.DB.prepare('DELETE FROM fib_word_sequence'),
    env.DB.prepare('DELETE FROM fib_words'),
    env.DB.prepare('DELETE FROM fib_word_generation_cycles'),
    env.DB.prepare('DELETE FROM fib_word_packs'),
    env.DB.prepare('DELETE FROM fib_word_supply_months'),
    env.DB.prepare('DELETE FROM word_submission_items'),
    env.DB.prepare('DELETE FROM word_submission_batches'),
    env.DB.prepare("UPDATE database_capacity SET state = 'normal' WHERE id = 1"),
  ]);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Fib word supply workflow', () => {
  it.each([false, true])(
    'persists generation validation without extra calls or unreviewed inventory (allRejected=%s)',
    async (allRejected) => {
      const reportError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const candidate = {
        word: '菡萏',
        category: 'plants',
        definition: {
          coreMeaning: '荷花的别称，古人常在诗文中用来称呼荷花。',
          usageNote: '多见于古典诗文和书面描写，不是现代口语中的常用称呼。',
        },
        citations: [{ evidenceIndex: 0, quote: 'source0quote0' }],
      };
      const invalid = {
        ...candidate,
        citations: [{ evidenceIndex: 0, quote: 'private-reference' }],
      };
      const evidence = [
        {
          query: '词源',
          url: 'https://example.test/source',
          title: '词源资料',
          content: '菡萏：荷花的别称，古人常在诗文中用来称呼荷花。',
        },
      ];
      const candidates = [allRejected ? invalid : candidate];
      const reviews = [
        {
          word: candidate.word,
          reason: '有资料支持且符合游戏性标准。',
          evidenceIndex: 0,
          evidenceQuote: 'source0quote0',
          qualityChecks: {
            isEstablishedTerm: true,
            isDefinitionAccurate: true,
            isMeaningUnfamiliarToMostPlayers: true,
            isMeaningDistinctFromLiteralReading: true,
            hasMultiplePlausibleWrongDefinitions: true,
            hasRevealValue: true,
          },
        },
      ];
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockImplementationOnce(async () =>
          Response.json({
            choices: [
              { finish_reason: 'stop', message: { content: JSON.stringify({ candidates }) } },
            ],
          }),
        )
        .mockImplementationOnce(async () =>
          Response.json({
            choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ reviews }) } }],
          }),
        );
      vi.stubGlobal('fetch', fetchImpl);
      const id = crypto.randomUUID();
      const day = new Date().toISOString().slice(0, 10);
      await using instance = await introspectWorkflowInstance(env.FIB_WORD_SUPPLY, id);
      await instance.modify(async (modifier) => {
        await modifier.disableSleeps();
        await modifier.mockStepResult({ name: 'enabled' }, true);
        await modifier.mockStepResult({ name: 'discover' }, evidence);
        await modifier.mockStepResult({ name: 'extract' }, { evidence, failedUrls: [] });
      });
      const validRunId = crypto.randomUUID();
      const workflow = await env.FIB_WORD_SUPPLY.create({
        id,
        params: { day, runId: validRunId, category: 'plants' },
      });
      await instance.waitForStatus(allRejected ? 'errored' : 'complete');
      const validation = {
        receivedCount: 1,
        validCount: allRejected ? 0 : 1,
        rejectedCount: allRejected ? 1 : 0,
        duplicateCount: 0,
      };
      if (allRejected) {
        const status = await workflow.status();
        expect(getAiDiagnostic(new Error(status.error?.message))).toMatchObject({
          game: 'fibking',
          operation: 'generate',
          packId: `${day}-${validRunId}`,
          stage: 'outputValidation',
          failureKind: 'invalidOutput',
          validationCode: 'allCandidatesRejected',
          validationSummary: {
            ...validation,
            omittedIssueCount: 0,
            rejectionSamples: Array.from({ length: 1 }, (_, index) => ({
              index,
              path: ['candidates', index, 'citations', 0, 'quote'],
              code: 'invalidEvidenceReference',
            })),
          },
        });
        expect(
          await env.DB.prepare('SELECT error_code FROM fib_word_generation_cycles').first(),
        ).toEqual({ error_code: 'generation:invalidOutput' });
        expect(
          await env.DB.prepare('SELECT COUNT(*) AS count FROM word_submission_items').first(),
        ).toEqual({ count: 0 });
      } else {
        expect(await instance.getOutput()).toEqual({ status: 'complete', stored: 1 });
        expect(await instance.waitForStepResult({ name: 'generate' })).toMatchObject({
          candidates: [{ word: candidate.word, evidence }],
          validation,
        });
        expect(
          await env.DB.prepare('SELECT title, status FROM word_submission_items').first(),
        ).toEqual({ title: candidate.word, status: 'pending' });
        expect(await env.DB.prepare('SELECT status FROM fib_word_packs').first()).toEqual({
          status: 'reserved',
        });
      }
      const expectedCalls = 1;
      expect(fetchImpl).toHaveBeenCalledTimes(expectedCalls);
      expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM fib_words').first()).toEqual({
        count: 0,
      });
      expect(
        await env.DB.prepare('SELECT COUNT(*) AS count FROM editorial_model_requests').first(),
      ).toEqual({ count: expectedCalls });
      expect(
        await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM fib_word_provider_requests WHERE operation IN ('generation', 'review')",
        ).first(),
      ).toEqual({ count: expectedCalls });
      expect(reportError).toHaveBeenCalledTimes(allRejected ? 1 : 0);
      expect(JSON.stringify(reportError.mock.calls)).not.toContain('private-reference');
    },
  );

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
      await modifier.mockStepResult({ name: 'discover' }, evidence);
      await modifier.mockStepResult({ name: 'extract' }, { evidence, failedUrls: [] });
    });
    const modelFailRunId = crypto.randomUUID();
    const workflow = await env.FIB_WORD_SUPPLY.create({
      id,
      params: { day, runId: modelFailRunId, category: 'plants' },
    });
    await instance.waitForStatus('errored');
    const status = await workflow.status();
    const persistedError = new Error(status.error?.message);
    expect(getAiDiagnostic(persistedError)).toMatchObject({
      game: 'fibking',
      operation: 'generate',
      packId: `${day}-${modelFailRunId}`,
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

  it('runs even when the editorial log already holds requests: there is no budget', async () => {
    await env.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 8)
       INSERT INTO editorial_model_requests (id, owner, model, claimed_at)
       SELECT 'budget-' || i, 'test', 'model', ? FROM n`,
    )
      .bind(new Date().toISOString())
      .run();
    const evidence = [
      {
        query: '词源',
        url: 'https://example.test/source',
        title: '词源资料',
        content: '菡萏：荷花的别称，古人常在诗文中用来称呼荷花。',
      },
    ];
    const candidate = {
      word: '菡萏',
      category: 'plants',
      definition: {
        coreMeaning: '荷花的别称，古人常在诗文中用来称呼荷花。',
        usageNote: '多见于古典诗文和书面描写，不是现代口语中的常用称呼。',
      },
      citations: [{ evidenceIndex: 0, quote: 'source0quote0' }],
    };
    const reviews = [
      {
        word: candidate.word,
        reason: '有资料支持且符合游戏性标准。',
        evidenceIndex: 0,
        evidenceQuote: 'source0quote0',
        qualityChecks: {
          isEstablishedTerm: true,
          isDefinitionAccurate: true,
          isMeaningUnfamiliarToMostPlayers: true,
          isMeaningDistinctFromLiteralReading: true,
          hasMultiplePlausibleWrongDefinitions: true,
          hasRevealValue: true,
        },
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockImplementationOnce(async () =>
          Response.json({
            choices: [
              {
                finish_reason: 'stop',
                message: { content: JSON.stringify({ candidates: [candidate] }) },
              },
            ],
          }),
        )
        .mockImplementationOnce(async () =>
          Response.json({
            choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ reviews }) } }],
          }),
        ),
    );
    const id = crypto.randomUUID();
    await using instance = await introspectWorkflowInstance(env.FIB_WORD_SUPPLY, id);
    await instance.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepResult({ name: 'enabled' }, true);
      await modifier.mockStepResult({ name: 'discover' }, evidence);
      await modifier.mockStepResult({ name: 'extract' }, { evidence, failedUrls: [] });
    });
    await env.FIB_WORD_SUPPLY.create({
      id,
      params: {
        day: new Date().toISOString().slice(0, 10),
        runId: crypto.randomUUID(),
        category: 'plants',
      },
    });
    await instance.waitForStatus('complete');
    expect(await instance.getOutput()).toEqual({ status: 'complete', stored: 1 });
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM fib_word_packs').first()).toEqual({
      count: 1,
    });
    expect(
      await env.DB.prepare(
        "SELECT title, status FROM word_submission_items WHERE title = '菡萏'",
      ).first(),
    ).toEqual({ title: '菡萏', status: 'pending' });
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM editorial_model_requests').first(),
    ).toEqual({ count: 9 });
  });

  it('ignores ambiguous, out-of-range and stale historical classifications', async () => {
    await env.DB.prepare(
      `INSERT INTO fib_words (id, word, core_meaning, usage_note, source, status, selection_key, created_at, activated_at)
       VALUES ('a', '甲词', '原释义', '提示', 'local', 'active', 1, '2026-01-01', '2026-01-01'),
              ('b', '乙词', '原释义', '提示', 'local', 'active', 2, '2026-01-01', '2026-01-01'),
              ('c', '丙词', '原释义', '提示', 'local', 'active', 3, '2026-01-01', '2026-01-01'),
              ('d', '丁词', '原释义', '提示', 'local', 'active', 4, '2026-01-01', '2026-01-01')`,
    ).run();
    const words = await getFibWordsToClassify(env.DB);
    await env.DB.prepare("UPDATE fib_words SET core_meaning = '新释义' WHERE id = 'c'").run();
    await storeFibWordCategories(env.DB, words, [
      { index: 0, category: 'food' },
      { index: 0, category: 'music' },
      { index: 1, category: 'music' },
      { index: 2, category: 'food' },
      { index: 99, category: 'food' },
    ]);
    const rows = await env.DB.prepare('SELECT id, category FROM fib_words ORDER BY id').all();
    expect(rows.results).toEqual([
      { id: 'a', category: null },
      { id: 'b', category: 'music' },
      { id: 'c', category: null },
      { id: 'd', category: null },
    ]);
  });

  it('continues supplying words when historical category classification fails', async () => {
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
      `INSERT INTO fib_words (id, word, core_meaning, usage_note, source, status, selection_key, created_at, activated_at)
       VALUES ('legacy', '旧词', '原本的准确释义', '原本的使用提示', 'local', 'active', 0, '2026-01-01', '2026-01-01')`,
    ).run();
    const id = crypto.randomUUID();
    const day = new Date().toISOString().slice(0, 10);
    await using instance = await introspectWorkflowInstance(env.FIB_WORD_SUPPLY, id);
    await instance.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepResult({ name: 'enabled' }, true);
      await modifier.mockStepResult({ name: 'discover' }, []);
    });
    const classifyFailRunId = crypto.randomUUID();
    await env.FIB_WORD_SUPPLY.create({
      id,
      params: { day, runId: classifyFailRunId, category: 'plants' },
    });
    await instance.waitForStatus('complete');
    // Empty discovery: nothing new to store, the pack stays reserved, and
    // the run completes with nothing stored.
    expect(await instance.getOutput()).toEqual({ status: 'complete', stored: 0 });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining('"operation":"classify"'),
    );
    const diagnostics = JSON.stringify(reportError.mock.calls);
    expect(diagnostics).not.toContain(env.GEMINI_API_KEY);
    expect(diagnostics).not.toContain('旧词');
    expect(
      await env.DB.prepare('SELECT status, category FROM fib_words WHERE id = ?')
        .bind('legacy')
        .first(),
    ).toEqual({ status: 'active', category: null });
    expect(
      await env.DB.prepare('SELECT status FROM fib_word_packs WHERE id = ?')
        .bind(`${day}-${classifyFailRunId}`)
        .first(),
    ).toEqual({ status: 'reserved' });
  });

  it('classifies existing reviewed inventory without changing its playable state', async () => {
    const day = new Date().toISOString().slice(0, 10);
    const candidate: FibWordEditorialCandidate = {
      word: '测试旧词',
      source: 'gemini',
      category: 'plants',
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
    // Seed the reviewed inventory directly: the word is active and sequenced,
    // so the workflow's classify-history step picks it up.
    await env.DB.prepare(
      `INSERT INTO fib_words (id, word, core_meaning, usage_note, source,
         status, selection_key, created_at, activated_at)
       VALUES ('legacy-word', ?, '用于测试的准确核心含义。', '用于测试的具体使用语境。',
         'gemini', 'active', 0, '2026-01-01', '2026-01-01')`,
    )
      .bind(candidate.word)
      .run();
    await env.DB.prepare(
      "INSERT INTO fib_word_sequence (word, published_at) VALUES (?, '2026-01-01')",
    )
      .bind(candidate.word)
      .run();
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
                      classifications: [{ index: 0, category: 'customs' }],
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
      await modifier.mockStepResult({ name: 'discover' }, []);
    });
    const classifyRunId = crypto.randomUUID();
    await env.FIB_WORD_SUPPLY.create({
      id,
      params: { day, runId: classifyRunId, category: 'plants' },
    });
    await instance.waitForStatus('complete');
    expect(await instance.getOutput()).toEqual({ status: 'complete', stored: 0 });
    expect(await env.DB.prepare('SELECT word, status, category FROM fib_words').first()).toEqual({
      word: candidate.word,
      status: 'active',
      category: 'customs',
    });
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM fib_word_sequence').first()).toEqual(
      { count: 1 },
    );
    expect(await env.DB.prepare('SELECT owner FROM editorial_model_requests').first()).toEqual({
      owner: 'fibking',
    });
    expect(
      await env.DB.prepare('SELECT category FROM fib_word_packs WHERE id = ?')
        .bind(`${day}-${classifyRunId}`)
        .first(),
    ).toEqual({ category: 'plants' });
  });

  it('covers the whole search space with distinct non-cycling searches', () => {
    const queries = Array.from({ length: FIB_WORD_SEARCH_QUERY_COUNT }, (_, index) =>
      createFibWordSearchQuery(index),
    );
    expect(new Set(queries).size).toBe(FIB_WORD_SEARCH_QUERY_COUNT);
    expect(() => createFibWordSearchQuery(FIB_WORD_SEARCH_QUERY_COUNT)).toThrow('out of range');
  });

  it('stores one pack of generated words as pending submissions, then stops', async () => {
    const day = new Date().toISOString().slice(0, 10);
    const id = crypto.randomUUID();
    const words = ['测试甲', '测试乙', '测试丙', '测试丁', '测试戊', '测试己', '测试庚', '测试辛'];
    const evidence = [
      {
        query: '传统器物',
        url: 'https://example.com/words',
        title: '测试词源',
        content: words.map((word) => `${word}：用于测试的准确核心含义。`).join('\n'),
      },
    ];
    const candidates: FibWordEditorialCandidate[] = words.map((word) => ({
      word,
      source: 'gemini',
      category: 'plants',
      evidence,
      definition: {
        coreMeaning: '用于测试的准确核心含义。',
        usageNote: '用于测试的具体使用语境。',
      },
    }));
    await using instance = await introspectWorkflowInstance(env.FIB_WORD_SUPPLY, id);
    await instance.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepResult({ name: 'enabled' }, true);
      await modifier.mockStepResult({ name: 'discover' }, evidence);
      await modifier.mockStepResult({ name: 'extract' }, { evidence, failedUrls: [] });
      await modifier.mockStepResult({ name: 'generate' }, candidates);
    });
    const firstRunId = crypto.randomUUID();
    await env.FIB_WORD_SUPPLY.create({
      id,
      params: { day, runId: firstRunId, category: 'plants' },
    });
    await instance.waitForStatus('complete');
    // Newly generated words stop as pending submissions: no review, no
    // publish, and the run ends with the stored count.
    expect(await instance.getOutput()).toEqual({ status: 'complete', stored: 8 });
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM word_submission_items WHERE status = 'pending'",
      ).first(),
    ).toEqual({ count: 8 });
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM fib_word_sequence').first()).toEqual(
      { count: 0 },
    );
    expect(
      await env.DB.prepare(
        'SELECT requests_reserved, published_count FROM fib_word_supply_months',
      ).first(),
    ).toEqual({ requests_reserved: 0, published_count: 0 });

    // A second run generating the same words stores them again, marked
    // duplicate: the ingestion dedup — not a second review or publish —
    // is what keeps them out of the inventory.
    const resumeId = crypto.randomUUID();
    await using resume = await introspectWorkflowInstance(env.FIB_WORD_SUPPLY, resumeId);
    await resume.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepResult({ name: 'enabled' }, true);
      await modifier.mockStepResult({ name: 'discover' }, evidence);
      await modifier.mockStepResult({ name: 'extract' }, { evidence, failedUrls: [] });
      await modifier.mockStepResult({ name: 'generate' }, candidates);
    });
    await env.FIB_WORD_SUPPLY.create({
      id: resumeId,
      params: { day, runId: crypto.randomUUID(), category: 'plants' },
    });
    await resume.waitForStatus('complete');
    expect(await resume.getOutput()).toEqual({ status: 'complete', stored: 8 });
    expect(
      (
        await env.DB.prepare(
          'SELECT status, COUNT(*) AS count FROM word_submission_items GROUP BY status ORDER BY status',
        ).all()
      ).results,
    ).toEqual([
      { status: 'duplicate', count: 8 },
      { status: 'pending', count: 8 },
    ]);
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM fib_word_sequence').first()).toEqual(
      { count: 0 },
    );
    expect(
      await env.DB.prepare(
        'SELECT requests_reserved, published_count FROM fib_word_supply_months',
      ).first(),
    ).toEqual({ requests_reserved: 0, published_count: 0 });
  });

  it.each(['discovery', 'extraction', 'generation'])(
    'leaves the pack reserved on empty %s without review or publication',
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
          { name: 'discover' },
          failureStage === 'discovery' ? [] : evidence,
        );
        if (failureStage !== 'discovery') {
          await modifier.mockStepResult(
            { name: 'extract' },
            failureStage === 'extraction'
              ? { evidence: [], failedUrls: ['https://example.com/words'] }
              : { evidence, failedUrls: [] },
          );
        }
        if (failureStage === 'generation') await modifier.mockStepResult({ name: 'generate' }, []);
      });
      await env.FIB_WORD_SUPPLY.create({
        id,
        params: { day, runId: crypto.randomUUID(), category: 'plants' },
      });
      await instance.waitForStatus('complete');
      // No publish step exists anymore: the empty pack stays reserved with
      // no outcome, and the run completes with nothing stored.
      expect(await instance.getOutput()).toEqual({ status: 'complete', stored: 0 });
      expect(await env.DB.prepare('SELECT status, outcome FROM fib_word_packs').first()).toEqual({
        status: 'reserved',
        outcome: null,
      });
      expect(
        await env.DB.prepare('SELECT COUNT(*) AS count FROM fib_word_sequence').first(),
      ).toEqual({ count: 0 });
      expect(
        await env.DB.prepare('SELECT COUNT(*) AS count FROM word_submission_items').first(),
      ).toEqual({ count: 0 });
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it('makes a failed external call terminal without refunding the provider claim', async () => {
    const day = new Date().toISOString().slice(0, 10);
    const id = crypto.randomUUID();
    await using instance = await introspectWorkflowInstance(env.FIB_WORD_SUPPLY, id);
    await instance.modify(async (modifier) => {
      await modifier.mockStepResult({ name: 'enabled' }, true);
      await modifier.mockStepError(
        { name: 'discover' },
        new FibWordProviderError('quota exhausted', 'rateLimited'),
      );
    });
    await env.FIB_WORD_SUPPLY.create({
      id,
      params: { day, runId: crypto.randomUUID(), category: 'plants' },
    });
    await instance.waitForStatus('errored');
    expect(await env.DB.prepare('SELECT status FROM fib_word_packs').first()).toEqual({
      status: 'failed',
    });
    expect(
      await env.DB.prepare('SELECT requests_reserved FROM fib_word_supply_months').first(),
    ).toEqual({ requests_reserved: 0 });
    expect(
      await env.DB.prepare('SELECT error_code FROM fib_word_generation_cycles').first(),
    ).toEqual({
      error_code: 'discovery:rateLimited',
    });
  });
});
