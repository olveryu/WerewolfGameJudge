/** Real Workflows orchestration and D1 publication with only external steps replaced. */
import { env, introspectWorkflowInstance } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FibWordEditorialCandidate } from '../wordProviders/types';

beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unexpected external HTTP request')));
  await env.DB.batch([
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

afterEach(() => vi.unstubAllGlobals());

describe('Fib word supply workflow', () => {
  it('reviews persisted overflow without another discovery or generation request', async () => {
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
        isEasyToReadAloud: true,
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
      await modifier.mockStepResult({ name: 'discover-0' }, evidence);
      await modifier.mockStepResult({ name: 'extract-0' }, { evidence, failedUrls: [] });
      await modifier.mockStepResult({ name: 'generate-0' }, candidates);
      await modifier.mockStepResult({ name: 'review-0' }, reviews.slice(0, 6));
      await modifier.mockStepResult({ name: 'review-1' }, reviews.slice(6));
      await modifier.mockStepError(
        { name: 'discover-1' },
        new Error('Persisted candidates must not trigger discovery'),
      );
      await modifier.mockStepResult({ name: 'capacity-2' }, 'paused');
    });
    await env.FIB_WORD_SUPPLY.create({ id, params: { day } });
    await instance.waitForStatus('complete');
    expect(await instance.getOutput()).toEqual({ status: 'paused' });
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM fib_word_candidates').first(),
    ).toEqual({ count: 0 });
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM fib_word_sequence').first()).toEqual(
      { count: 8 },
    );
    expect(
      await env.DB.prepare(
        'SELECT requests_reserved, published_count FROM fib_word_supply_months',
      ).first(),
    ).toEqual({ requests_reserved: 2, published_count: 8 });
  });

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
        isEasyToReadAloud: true,
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
        new Error('[rateLimited] quota exhausted'),
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
