/** FibKing scheduled word-supply persistence and lease contracts. */

import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  FIB_GENERATED_WORD_CANDIDATE_COUNT,
  FIB_WORD_CATEGORIES,
  type FibWordProvider,
  type FibWordReviewDecision,
} from '../wordProviders/types';
import {
  FIB_WORD_SUPPLY_CADENCE_MS,
  FIB_WORD_SUPPLY_MAX_REQUESTS_PER_INVOCATION,
  replenishFibWordPool,
} from '../wordSupply';

const NOW_MS = Date.parse('2026-08-21T12:00:00.000Z');

function createUniqueProvider(
  reviewDecision: (candidateIndex: number) => FibWordReviewDecision = () => 'accepted',
): {
  readonly provider: FibWordProvider;
  requestCount(): number;
  reviewCount(): number;
} {
  let requestCount = 0;
  let reviewCount = 0;
  let wordIndex = 0;
  return {
    provider: {
      async generateBatch() {
        requestCount += 1;
        return Array.from({ length: FIB_GENERATED_WORD_CANDIDATE_COUNT }, () => {
          const word = `${String.fromCodePoint(0x4e00 + wordIndex)}词`;
          wordIndex += 1;
          return {
            word,
            definition: { coreMeaning: '用于测试的核心含义。', usageNote: '用于测试的使用说明。' },
            source: 'gemini' as const,
          };
        });
      },
      reviewBatch(request, candidates) {
        if (request.signal.aborted) throw new Error('Test review request was unexpectedly aborted');
        reviewCount += 1;
        return Promise.resolve(
          candidates.map((candidate, candidateIndex) => ({
            word: candidate.word,
            decision: reviewDecision(candidateIndex),
            reason:
              reviewDecision(candidateIndex) === 'accepted'
                ? '真实含义不透明且适合编造错误释义。'
                : '词义过于常见，无法形成真假释义悬念。',
          })),
        );
      },
    },
    requestCount: () => requestCount,
    reviewCount: () => reviewCount,
  };
}

async function seedCategory(category: (typeof FIB_WORD_CATEGORIES)[number]): Promise<void> {
  await env.DB.prepare(
    `WITH RECURSIVE sequence(value) AS (
       SELECT 1 UNION ALL SELECT value + 1 FROM sequence WHERE value < 194
     )
     INSERT INTO fib_words (
       id, word, core_meaning, usage_note, category, source, status,
       selection_key, created_at, activated_at
     )
    SELECT ? || value, ? || value, '测试含义', '测试说明', ?, 'gemini', 'active', value,
            '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'
     FROM sequence`,
  )
    .bind(`seed-${category}-`, `种子-${category}-`, category)
    .run();
}

async function seedRunningCycle(): Promise<void> {
  const startedAt = new Date(NOW_MS).toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO fib_word_generation_cycles (
         id, status, provider, model, prompt_version, request_count,
         accepted_count, duplicate_count, started_at
       ) VALUES ('seed-cycle', 'running', 'gemini', 'test-model', 'test-prompt', 0, 0, 0, ?)`,
    ).bind(startedAt),
    env.DB.prepare(
      `UPDATE fib_word_supply_state
       SET active_cycle_id = 'seed-cycle', active_cycle_started_at = ?, updated_at = ?
       WHERE id = 1`,
    ).bind(startedAt, startedAt),
  ]);
}

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM fib_word_usages').run();
  await env.DB.prepare('DELETE FROM fib_round_word_selections').run();
  await env.DB.prepare('DELETE FROM fib_word_candidate_reviews').run();
  await env.DB.prepare('DELETE FROM fib_words').run();
  await env.DB.prepare('DELETE FROM fib_word_generation_cycles').run();
  await env.DB.prepare(
    `UPDATE fib_word_supply_state
     SET active_cycle_id = NULL, active_cycle_started_at = NULL, lease_owner = NULL,
         lease_expires_at = NULL, last_completed_at = NULL,
         updated_at = '1970-01-01T00:00:00.000Z'
     WHERE id = 1`,
  ).run();
});

describe('replenishFibWordPool', () => {
  it('records rejections and never reactivates them after a later acceptance', async () => {
    const generated = createUniqueProvider((candidateIndex) =>
      candidateIndex === 0 ? 'rejected' : 'accepted',
    );

    await replenishFibWordPool(env, NOW_MS, {
      provider: generated.provider,
      requestIntervalMs: 0,
    });

    expect(generated.requestCount()).toBe(FIB_WORD_SUPPLY_MAX_REQUESTS_PER_INVOCATION);
    expect(generated.reviewCount()).toBe(FIB_WORD_SUPPLY_MAX_REQUESTS_PER_INVOCATION);
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM fib_words').first()).toEqual({
      count: FIB_WORD_SUPPLY_MAX_REQUESTS_PER_INVOCATION * 5,
    });
    expect(
      await env.DB.prepare(
        `SELECT COUNT(*) AS count FROM fib_word_candidate_reviews
         WHERE decision = 'rejected' AND reason <> ''`,
      ).first(),
    ).toEqual({ count: FIB_WORD_SUPPLY_MAX_REQUESTS_PER_INVOCATION });
    expect(
      await env.DB.prepare(
        `SELECT request_count, accepted_count, rejected_count, duplicate_count
         FROM fib_word_generation_cycles`,
      ).first(),
    ).toEqual({
      request_count: FIB_WORD_SUPPLY_MAX_REQUESTS_PER_INVOCATION,
      accepted_count: FIB_WORD_SUPPLY_MAX_REQUESTS_PER_INVOCATION * 5,
      rejected_count: FIB_WORD_SUPPLY_MAX_REQUESTS_PER_INVOCATION,
      duplicate_count: 0,
    });

    const acceptingRetry = createUniqueProvider();
    await replenishFibWordPool(env, NOW_MS + 60 * 1_000, {
      provider: acceptingRetry.provider,
      requestIntervalMs: 0,
    });

    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM fib_words').first()).toEqual({
      count: FIB_WORD_SUPPLY_MAX_REQUESTS_PER_INVOCATION * 5,
    });
    expect(
      await env.DB.prepare(
        `SELECT COUNT(*) AS count
         FROM fib_word_candidate_reviews AS review
         INNER JOIN fib_words AS word_entry ON word_entry.word = review.word
         WHERE review.decision = 'rejected'`,
      ).first(),
    ).toEqual({ count: 0 });
    expect(
      await env.DB.prepare(
        `SELECT request_count, accepted_count, rejected_count, duplicate_count
         FROM fib_word_generation_cycles`,
      ).first(),
    ).toEqual({
      request_count: 2 * FIB_WORD_SUPPLY_MAX_REQUESTS_PER_INVOCATION,
      accepted_count: FIB_WORD_SUPPLY_MAX_REQUESTS_PER_INVOCATION * 5,
      rejected_count: FIB_WORD_SUPPLY_MAX_REQUESTS_PER_INVOCATION,
      duplicate_count: FIB_WORD_SUPPLY_MAX_REQUESTS_PER_INVOCATION * 6,
    });
  });

  it('continues one generation cycle across bounded daily invocations', async () => {
    const generated = createUniqueProvider();

    await replenishFibWordPool(env, NOW_MS, {
      provider: generated.provider,
      requestIntervalMs: 0,
    });
    const firstState = await env.DB.prepare(
      'SELECT active_cycle_id, lease_owner, last_completed_at FROM fib_word_supply_state WHERE id = 1',
    ).first();
    const firstCycle = await env.DB.prepare(
      'SELECT id, status, request_count FROM fib_word_generation_cycles',
    ).first();

    expect(firstState).toMatchObject({ lease_owner: null, last_completed_at: null });
    expect(firstState?.active_cycle_id).toEqual(firstCycle?.id);
    expect(firstCycle).toMatchObject({
      status: 'running',
      request_count: FIB_WORD_SUPPLY_MAX_REQUESTS_PER_INVOCATION,
    });
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM fib_words').first()).toEqual({
      count: FIB_WORD_SUPPLY_MAX_REQUESTS_PER_INVOCATION * FIB_GENERATED_WORD_CANDIDATE_COUNT,
    });

    await replenishFibWordPool(env, NOW_MS + 60 * 1_000, {
      provider: generated.provider,
      requestIntervalMs: 0,
    });

    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM fib_words').first()).toEqual({
      count: 2 * FIB_WORD_SUPPLY_MAX_REQUESTS_PER_INVOCATION * FIB_GENERATED_WORD_CANDIDATE_COUNT,
    });
    expect(
      await env.DB.prepare(
        'SELECT id, status, request_count FROM fib_word_generation_cycles',
      ).first(),
    ).toMatchObject({
      id: firstCycle?.id,
      status: 'running',
      request_count: 2 * FIB_WORD_SUPPLY_MAX_REQUESTS_PER_INVOCATION,
    });
  });

  it('completes only after every category reaches target and then enforces cadence', async () => {
    await Promise.all(FIB_WORD_CATEGORIES.map(seedCategory));
    await seedRunningCycle();
    const generated = createUniqueProvider();

    await replenishFibWordPool(env, NOW_MS, {
      provider: generated.provider,
      requestIntervalMs: 0,
    });

    expect(generated.requestCount()).toBe(FIB_WORD_CATEGORIES.length);
    const completedState = await env.DB.prepare(
      'SELECT active_cycle_id, lease_owner, last_completed_at FROM fib_word_supply_state WHERE id = 1',
    ).first<{
      readonly active_cycle_id: string | null;
      readonly lease_owner: string | null;
      readonly last_completed_at: string | null;
    }>();
    expect(completedState).toMatchObject({
      active_cycle_id: null,
      lease_owner: null,
    });
    expect(typeof completedState?.last_completed_at).toBe('string');
    expect(
      await env.DB.prepare(
        'SELECT status, request_count, completed_at FROM fib_word_generation_cycles',
      ).first(),
    ).toMatchObject({ status: 'completed', request_count: FIB_WORD_CATEGORIES.length });

    await env.DB.prepare('DELETE FROM fib_words WHERE selection_key > 70').run();
    await replenishFibWordPool(env, NOW_MS + FIB_WORD_SUPPLY_CADENCE_MS - 1, {
      provider: generated.provider,
      requestIntervalMs: 0,
    });
    expect(generated.requestCount()).toBe(FIB_WORD_CATEGORIES.length);
  });

  it('grants a concurrent supply lease to only one invocation', async () => {
    const generated = createUniqueProvider();

    await Promise.all([
      replenishFibWordPool(env, NOW_MS, {
        provider: generated.provider,
        requestIntervalMs: 0,
      }),
      replenishFibWordPool(env, NOW_MS, {
        provider: generated.provider,
        requestIntervalMs: 0,
      }),
    ]);

    expect(generated.requestCount()).toBe(FIB_WORD_SUPPLY_MAX_REQUESTS_PER_INVOCATION);
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM fib_word_generation_cycles').first(),
    ).toEqual({ count: 1 });
  });
});
