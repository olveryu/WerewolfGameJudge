/** Real Workflows orchestration and D1 publication with only external steps replaced. */
import { env, introspectWorkflowInstance } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { FIB_WORD_CATEGORIES } from '../wordProviders/types';

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM fib_word_provider_requests'),
    env.DB.prepare('DELETE FROM fib_word_sequence'),
    env.DB.prepare('DELETE FROM fib_word_candidate_reviews'),
    env.DB.prepare('DELETE FROM fib_words'),
    env.DB.prepare('DELETE FROM fib_word_generation_cycles'),
    env.DB.prepare('DELETE FROM fib_word_packs'),
    env.DB.prepare('DELETE FROM fib_word_supply_months'),
  ]);
});

describe('Fib word supply workflow', () => {
  it.each([false, true])('publishes with inventory re-review: %s', async (hasInventory) => {
    const day = new Date().toISOString().slice(0, 10);
    const id = crypto.randomUUID();
    const words = hasInventory
      ? ['幸存者偏差', '琼浆', '觊觎', '测试甲', '测试乙', '测试丙']
      : ['射覆', '却扇', '打尖', '测试甲', '测试乙', '测试丙'];
    const candidates = words.map((word) => ({
      word,
      source: 'gemini',
      definition: {
        coreMeaning: '用于测试的准确核心含义。',
        usageNote: '用于测试的具体使用语境。',
      },
    }));
    if (hasInventory) {
      const category = FIB_WORD_CATEGORIES[Number(day.slice(-2)) % FIB_WORD_CATEGORIES.length];
      if (category === undefined) throw new Error('Expected batch category');
      for (const candidate of candidates.slice(0, 3)) {
        await env.DB.prepare(
          `INSERT INTO fib_words (id, word, core_meaning, usage_note, category, source,
           status, selection_key, created_at, activated_at)
           VALUES (?, ?, ?, ?, ?, 'local', 'active', 0, '2026-01-01', '2026-01-01')`,
        )
          .bind(
            candidate.word,
            candidate.word,
            candidate.definition.coreMeaning,
            candidate.definition.usageNote,
            category,
          )
          .run();
        await env.DB.prepare(
          "INSERT INTO fib_word_sequence (word, published_at) VALUES (?, '2026-01-01')",
        )
          .bind(candidate.word)
          .run();
      }
    }
    const reviews = words.map((word, index) => ({
      word,
      decision: hasInventory && index < 3 ? 'rejected' : 'accepted',
      reason:
        hasInventory && index < 3
          ? '常见词义或熟语已经暴露核心答案。'
          : '有资料支持且符合游戏性标准。',
      qualityChecks: {
        isEstablishedTerm: true,
        isDefinitionAccurate: true,
        isEasyToReadAloud: true,
        isMeaningUnfamiliarToMostPlayers: !(hasInventory && index < 3),
        isMeaningDistinctFromLiteralReading: true,
        hasMultiplePlausibleWrongDefinitions: true,
        hasRevealValue: true,
      },
    }));
    await using instance = await introspectWorkflowInstance(env.FIB_WORD_SUPPLY, id);
    await instance.modify(async (modifier) => {
      await modifier.disableSleeps();
      await modifier.mockStepResult({ name: 'enabled' }, true);
      await modifier.mockStepResult({ name: 'discover-0' }, [
        {
          query: '词源',
          url: 'https://example.com/words',
          title: '词源',
          content: words.join(' '),
        },
      ]);
      await modifier.mockStepResult(
        { name: 'generate-0' },
        hasInventory
          ? ['测试甲', '测试乙', '测试丙', '测试丁', '测试戊', '测试己'].map((word) => ({
              ...candidates[0],
              word,
            }))
          : candidates,
      );
      for (const [index, word] of words.entries()) {
        await modifier.mockStepResult({ name: `verify-0-${index}` }, [
          {
            query: word,
            url: `https://example.com/${index}`,
            title: word,
            content: `${word}的释义资料。`,
          },
        ]);
      }
      await modifier.mockStepResult({ name: 'review-0' }, reviews);
      await modifier.mockStepResult({ name: 'capacity-1' }, 'paused');
    });
    await env.FIB_WORD_SUPPLY.create({ id, params: { day } });
    await instance.waitForStatus('complete');
    expect(await instance.getOutput()).toEqual({ status: 'paused' });
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM fib_word_sequence').first()).toEqual(
      { count: 6 },
    );
    expect(
      await env.DB.prepare(
        'SELECT requests_reserved, published_count FROM fib_word_supply_months',
      ).first(),
    ).toEqual({ requests_reserved: 1, published_count: hasInventory ? 3 : 6 });
    if (hasInventory) {
      expect(
        (
          await env.DB.prepare(
            "SELECT word FROM fib_words WHERE status = 'disabled' ORDER BY word",
          ).all()
        ).results,
      ).toEqual(words.slice(0, 3).map((word) => ({ word })));
      expect(
        (await env.DB.prepare('SELECT word FROM fib_word_sequence ORDER BY id LIMIT 3').all())
          .results,
      ).toEqual(words.slice(0, 3).map((word) => ({ word })));
    }
  });

  it('makes a failed external call terminal without refunding the budget', async () => {
    const day = new Date().toISOString().slice(0, 10);
    const id = crypto.randomUUID();
    await using instance = await introspectWorkflowInstance(env.FIB_WORD_SUPPLY, id);
    await instance.modify(async (modifier) => {
      await modifier.mockStepResult({ name: 'enabled' }, true);
      await modifier.mockStepError({ name: 'discover-0' }, new Error('quota exhausted'));
    });
    await env.FIB_WORD_SUPPLY.create({ id, params: { day } });
    await instance.waitForStatus('errored');
    expect(await env.DB.prepare('SELECT status FROM fib_word_packs').first()).toEqual({
      status: 'failed',
    });
    expect(
      await env.DB.prepare('SELECT requests_reserved FROM fib_word_supply_months').first(),
    ).toEqual({ requests_reserved: 1 });
  });
});
