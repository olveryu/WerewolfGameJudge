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
const PASSING_QUALITY_CHECKS = {
  isEstablishedTerm: true,
  isDefinitionAccurate: true,
  isEasyToReadAloud: true,
  isMeaningUnfamiliarToMostPlayers: true,
  isMeaningDistinctFromLiteralReading: true,
  hasMultiplePlausibleWrongDefinitions: true,
  hasRevealValue: true,
} as const;

interface DisabledWordRow {
  readonly status: string;
  readonly disabled_at: string | null;
  readonly status_reason: string | null;
}

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
          candidates.map((candidate, candidateIndex) => {
            const decision = reviewDecision(candidateIndex);
            return {
              word: candidate.word,
              qualityChecks: {
                ...PASSING_QUALITY_CHECKS,
                isMeaningUnfamiliarToMostPlayers: decision === 'accepted',
              },
              decision,
              reason:
                decision === 'accepted'
                  ? '真实含义不透明且适合编造错误释义。'
                  : '词义过于常见，无法形成真假释义悬念。',
            };
          }),
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

async function seedAcceptedActiveWord(word: string): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO fib_word_generation_cycles (
         id, status, provider, model, prompt_version, request_count,
         accepted_count, rejected_count, duplicate_count, started_at, completed_at
       ) VALUES (
         'historic-cycle', 'completed', 'gemini', 'test-model', '3', 1,
         1, 0, 5, '2026-08-01T00:00:00.000Z', '2026-08-01T00:01:00.000Z'
       )`,
    ),
    env.DB.prepare(
      `INSERT INTO fib_words (
         id, word, core_meaning, usage_note, category, source, status,
         selection_key, generation_cycle_id, created_at, activated_at
       ) VALUES (
         'existing-active-word', ?, '测试含义', '测试说明', 'literary', 'gemini', 'active',
         1, 'historic-cycle', '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'
       )`,
    ).bind(word),
    env.DB.prepare(
      `INSERT INTO fib_word_candidate_reviews (
         id, word, core_meaning, usage_note, category, source,
         is_established_term, is_definition_accurate, is_easy_to_read_aloud,
         is_meaning_unfamiliar_to_most_players,
         is_meaning_distinct_from_literal_reading,
         has_multiple_plausible_wrong_definitions, has_reveal_value,
         decision, reason, review_version, generation_cycle_id, reviewed_at
       ) VALUES (
         'historic-review', ?, '测试含义', '测试说明', 'literary', 'gemini',
         1, 1, 1, 1, 1, 1, 1, 'accepted',
         '审核接受该测试词。', '3', 'historic-cycle', '2026-08-01T00:00:00.000Z'
       )`,
    ).bind(word),
  ]);
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
    await seedAcceptedActiveWord('一词');
    const generated = createUniqueProvider((candidateIndex) =>
      candidateIndex === 0 ? 'rejected' : 'accepted',
    );

    await replenishFibWordPool(env, NOW_MS, {
      provider: generated.provider,
      requestIntervalMs: 0,
    });

    expect(generated.requestCount()).toBe(FIB_WORD_SUPPLY_MAX_REQUESTS_PER_INVOCATION);
    expect(generated.reviewCount()).toBe(FIB_WORD_SUPPLY_MAX_REQUESTS_PER_INVOCATION);
    const disabledWord = await env.DB.prepare(
      `SELECT status, disabled_at, status_reason FROM fib_words
       WHERE id = 'existing-active-word'`,
    ).first<DisabledWordRow>();
    if (disabledWord === null || disabledWord.disabled_at === null) {
      throw new Error('Expected the rejected word to have a disabled timestamp');
    }
    expect(disabledWord.status).toBe('disabled');
    expect(disabledWord.status_reason).toBe('quality_review: rejected');
    expect(Number.isNaN(Date.parse(disabledWord.disabled_at))).toBe(false);
    expect(
      await env.DB.prepare(
        `SELECT COUNT(*) AS count FROM fib_words WHERE status = 'active'`,
      ).first(),
    ).toEqual({ count: FIB_WORD_SUPPLY_MAX_REQUESTS_PER_INVOCATION * 5 });
    expect(
      await env.DB.prepare(
        `SELECT COUNT(*) AS count FROM fib_word_candidate_reviews
         WHERE decision = 'rejected' AND reason <> ''`,
      ).first(),
    ).toEqual({ count: FIB_WORD_SUPPLY_MAX_REQUESTS_PER_INVOCATION });
    expect(
      await env.DB.prepare(
        `SELECT request_count, accepted_count, rejected_count, duplicate_count
         FROM fib_word_generation_cycles WHERE status = 'running'`,
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

    expect(
      await env.DB.prepare(
        `SELECT COUNT(*) AS count FROM fib_words WHERE status = 'active'`,
      ).first(),
    ).toEqual({ count: FIB_WORD_SUPPLY_MAX_REQUESTS_PER_INVOCATION * 5 });
    expect(
      await env.DB.prepare(
        `SELECT COUNT(*) AS count
         FROM fib_word_candidate_reviews AS review
         INNER JOIN fib_words AS word_entry ON word_entry.word = review.word
         WHERE review.decision = 'rejected' AND word_entry.status = 'active'`,
      ).first(),
    ).toEqual({ count: 0 });
    expect(
      await env.DB.prepare(
        `SELECT decision, COUNT(*) AS review_count
         FROM fib_word_candidate_reviews
         WHERE word = '一词' AND review_version = '3'
         GROUP BY decision
         ORDER BY decision`,
      ).all(),
    ).toMatchObject({
      results: [
        { decision: 'accepted', review_count: 2 },
        { decision: 'rejected', review_count: 1 },
      ],
    });
    expect(
      await env.DB.prepare(
        `SELECT request_count, accepted_count, rejected_count, duplicate_count
         FROM fib_word_generation_cycles WHERE status = 'running'`,
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
