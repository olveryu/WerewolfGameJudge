/** Manual candidate review and publish: the single road from approval to
 * the inventory. The supply workflow never reviews or publishes; a human
 * starts the independent review and confirms publication from the unified
 * library page. Model HTTP is mocked; D1 is real (migrated). */
import { DRAWGUESS_WORD_CATEGORIES } from '@game-judge/game-engine/games/drawguess/public';
import { UNDERCOVER_CATEGORIES } from '@game-judge/game-engine/games/undercover/public';
import { env } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import {
  DRAWGUESS_WORD_REVIEW_VERSION,
  getDrawGuessWordId,
} from '../../../games/drawguess/wordEditorial';
import { getUndercoverPairId } from '../../../games/undercover/wordEditorial';
import {
  CANDIDATE_MANUAL_PUBLISH_LIMIT,
  CANDIDATE_MANUAL_REVIEW_LIMIT,
  publishWordCandidates,
  publishWordCandidatesSchema,
  reviewWordCandidates,
  reviewWordCandidatesSchema,
} from '../candidateReview';

const UNDERCOVER_CATEGORY = UNDERCOVER_CATEGORIES[1] ?? 'dailyLife';
const DRAWGUESS_CATEGORY = [...DRAWGUESS_WORD_CATEGORIES].sort()[0] ?? 'animals';

const UNDERCOVER_MATERIAL = {
  wordA: '熬夜',
  wordB: '赖床',
  category: UNDERCOVER_CATEGORY,
  commonTraits: ['作息习惯', '感觉困倦'],
  differences: ['发生时间', '是否入睡'],
  potentialIssues: [],
};
const UNDERCOVER_REVIEW = {
  wordA: '熬夜',
  wordB: '赖床',
  commonTraits: ['影响精神', '影响作息'],
  differences: ['早上晚上', '睡醒睡前'],
  reason: '模拟独立审核通过。',
  qualityChecks: {
    isFamiliar: true,
    hasSimilarFamiliarity: true,
    hasSharedDescriptions: true,
    hasDistinctDescriptions: true,
    isNotSynonymOrSubset: true,
    isPlayableBothWays: true,
    isCategoryAccurate: true,
    isAppropriate: true,
    isFactuallyCertain: true,
  },
};
const DRAWGUESS_MATERIAL = {
  word: '大熊猫',
  category: DRAWGUESS_CATEGORY,
  difficulty: 'easy',
  potentialIssues: [],
};
const DRAWGUESS_REVIEW = {
  word: '大熊猫',
  qualityChecks: {
    isConcreteAndDrawable: true,
    isSimplifiedChinese: true,
    isLengthValid: true,
    isCategoryAccurate: true,
    isAppropriate: true,
    isUnambiguous: true,
  },
  reason: '模拟独立审核通过。',
};
const FIB_EVIDENCE = [
  {
    query: '词源',
    url: 'https://example.test/source',
    title: '词源资料',
    content: '菡萏：荷花的别称，古人常在诗文中用来称呼荷花。',
  },
];
const FIB_REVIEW = {
  word: '菡萏',
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
};

/** Every model call returns the same review, in the envelope each provider
 * expects (fibking uses the OpenAI-compatible endpoint, the pair games the
 * classic Gemini endpoint). */
function mockReviewModel(review: unknown): { readonly calls: () => number } {
  let calls = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>().mockImplementation(async (input) => {
      calls += 1;
      const text = JSON.stringify({ reviews: [review] });
      const url =
        typeof input === 'string' ? input : input instanceof Request ? input.url : input.href;
      if (url.includes('/v1beta/openai')) {
        return Response.json({
          choices: [{ finish_reason: 'stop', message: { content: text } }],
        });
      }
      return Response.json({
        candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }],
      });
    }),
  );
  return { calls: () => calls };
}

/** Tavily finds nothing, so a fibking candidate keeps no evidence; the
 * model review still runs (and its evidence assertion then fails). */
function mockReviewModelWithEmptyTavily(review: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url =
        typeof input === 'string' ? input : input instanceof Request ? input.url : input.href;
      if (url.startsWith('https://api.tavily.com/search')) {
        return Response.json({ results: [], usage: { credits: 1 } });
      }
      if (url.startsWith('https://api.tavily.com/extract')) {
        return Response.json({ results: [], failed_results: [], usage: { credits: 1 } });
      }
      const text = JSON.stringify({ reviews: [review] });
      return Response.json({
        choices: [{ finish_reason: 'stop', message: { content: text } }],
      });
    }),
  );
}

async function seedUndercoverCandidate(status: string): Promise<string> {
  const id = await getUndercoverPairId('熬夜', '赖床');
  await env.DB.prepare(
    `INSERT INTO undercover_word_candidates
       (id, word_a, word_b, category, material_json, status, created_at)
     VALUES (?, '熬夜', '赖床', ?, ?, ?, '2026-11-15T00:00:00.000Z')`,
  )
    .bind(id, UNDERCOVER_CATEGORY, JSON.stringify(UNDERCOVER_MATERIAL), status)
    .run();
  return id;
}

async function seedDrawGuessCandidate(status: string, word = '大熊猫'): Promise<string> {
  const id = await getDrawGuessWordId(word);
  await env.DB.prepare(
    `INSERT INTO drawguess_word_candidates
       (id, word, category, difficulty, material_json, status, created_at)
     VALUES (?, ?, ?, 'easy', ?, ?, '2026-11-15T00:00:00.000Z')`,
  )
    .bind(id, word, DRAWGUESS_CATEGORY, JSON.stringify({ ...DRAWGUESS_MATERIAL, word }), status)
    .run();
  return id;
}

async function seedFibkingCandidate(status: string, withEvidence: boolean): Promise<string> {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO fib_word_generation_cycles (
       id, status, provider, model, prompt_version, request_count,
       accepted_count, rejected_count, duplicate_count, started_at, completed_at
     ) VALUES ('review-cycle', 'running', 'gemini', 'test-model', '10', 0,
       0, 0, 0, '2026-11-15T00:00:00.000Z', NULL)`,
  ).run();
  const id = 'review-cycle:0';
  await env.DB.prepare(
    `INSERT INTO fib_word_candidates (
       id, word, core_meaning, usage_note, category, topic, source,
       evidence_json, generation_cycle_id, status, claimed_pack_id,
       claimed_at, created_at
     ) VALUES (?, '菡萏', '荷花的别称，古人常在诗文中用来称呼荷花。',
       '多见于古典诗文和书面描写，不是现代口语中的常用称呼。',
       'literary', 'plants', 'gemini', ?, 'review-cycle', ?, NULL, NULL,
       '2026-11-15T00:00:00.000Z')`,
  )
    .bind(id, JSON.stringify(withEvidence ? FIB_EVIDENCE : []), status)
    .run();
  return id;
}

beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unexpected external HTTP request')));
  await env.DB.batch([
    env.DB.prepare('DELETE FROM editorial_model_requests'),
    env.DB.prepare('DELETE FROM undercover_word_candidates'),
    env.DB.prepare('DELETE FROM undercover_word_pairs'),
    env.DB.prepare('DELETE FROM drawguess_word_candidates'),
    env.DB.prepare('DELETE FROM drawguess_words'),
    env.DB.prepare('DELETE FROM fib_word_candidates'),
    env.DB.prepare('DELETE FROM fib_word_candidate_reviews'),
    env.DB.prepare('DELETE FROM fib_words'),
    env.DB.prepare('DELETE FROM fib_word_sequence'),
    env.DB.prepare('DELETE FROM fib_word_generation_cycles'),
    env.DB.prepare('DELETE FROM fib_word_supply_months'),
    env.DB.prepare('DELETE FROM fib_word_provider_requests'),
  ]);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('candidate manual review', () => {
  it('reviews an approved undercover pair and publishes it to the inventory once', async () => {
    const id = await seedUndercoverCandidate('approved');
    const calls = mockReviewModel(UNDERCOVER_REVIEW);
    expect(
      await reviewWordCandidates(env.DB, env, { game: 'undercover', candidateIds: [id] }),
    ).toEqual({
      game: 'undercover',
      passedIds: [id],
      rejectedIds: [],
      failedIds: [],
      skippedIds: [],
    });
    expect(calls.calls()).toBe(1);
    expect(
      await env.DB.prepare('SELECT status FROM undercover_word_candidates WHERE id = ?')
        .bind(id)
        .first(),
    ).toEqual({ status: 'passed' });

    expect(await publishWordCandidates(env.DB, { game: 'undercover', candidateIds: [id] })).toEqual(
      { game: 'undercover', publishedIds: [id], rejectedIds: [], skippedIds: [] },
    );
    expect(
      await env.DB.prepare(
        'SELECT word_a, word_b, category, status FROM undercover_word_pairs WHERE id = ?',
      )
        .bind(id)
        .first(),
    ).toEqual({
      word_a: '熬夜',
      word_b: '赖床',
      category: UNDERCOVER_CATEGORY,
      status: 'active',
    });
    expect(
      await env.DB.prepare('SELECT status FROM undercover_word_candidates WHERE id = ?')
        .bind(id)
        .first(),
    ).toEqual({ status: 'published' });

    // Publishing twice is a no-op: the candidate is no longer 'passed'.
    expect(await publishWordCandidates(env.DB, { game: 'undercover', candidateIds: [id] })).toEqual(
      { game: 'undercover', publishedIds: [], rejectedIds: [], skippedIds: [id] },
    );
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM undercover_word_pairs').first(),
    ).toEqual({ count: 1 });
  });

  it('rejects a pair the model does not accept and keeps it out of the inventory', async () => {
    const id = await seedUndercoverCandidate('approved');
    mockReviewModel({
      ...UNDERCOVER_REVIEW,
      qualityChecks: { ...UNDERCOVER_REVIEW.qualityChecks, isPlayableBothWays: false },
    });
    expect(
      await reviewWordCandidates(env.DB, env, { game: 'undercover', candidateIds: [id] }),
    ).toEqual({
      game: 'undercover',
      passedIds: [],
      rejectedIds: [id],
      failedIds: [],
      skippedIds: [],
    });
    expect(await publishWordCandidates(env.DB, { game: 'undercover', candidateIds: [id] })).toEqual(
      { game: 'undercover', publishedIds: [], rejectedIds: [], skippedIds: [id] },
    );
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM undercover_word_pairs').first(),
    ).toEqual({ count: 0 });
  });

  it('skips candidates that are not approved and ids that do not exist', async () => {
    const pendingId = await seedUndercoverCandidate('pending');
    expect(
      await reviewWordCandidates(env.DB, env, {
        game: 'undercover',
        candidateIds: [pendingId, 'missing'],
      }),
    ).toEqual({
      game: 'undercover',
      passedIds: [],
      rejectedIds: [],
      failedIds: [],
      skippedIds: [pendingId, 'missing'],
    });
  });

  it('marks a failed model review as failed and lets a retry pass', async () => {
    const id = await seedUndercoverCandidate('approved');
    expect(
      await reviewWordCandidates(env.DB, env, { game: 'undercover', candidateIds: [id] }),
    ).toEqual({
      game: 'undercover',
      passedIds: [],
      rejectedIds: [],
      failedIds: [id],
      skippedIds: [],
    });
    expect(
      await env.DB.prepare('SELECT status FROM undercover_word_candidates WHERE id = ?')
        .bind(id)
        .first(),
    ).toEqual({ status: 'failed' });

    mockReviewModel(UNDERCOVER_REVIEW);
    expect(
      await reviewWordCandidates(env.DB, env, { game: 'undercover', candidateIds: [id] }),
    ).toEqual({
      game: 'undercover',
      passedIds: [id],
      rejectedIds: [],
      failedIds: [],
      skippedIds: [],
    });
  });

  it('reviews two approved pairs in one call, one model call each', async () => {
    const first = await seedUndercoverCandidate('approved');
    const secondId = await getUndercoverPairId('早起', '晚睡');
    await env.DB.prepare(
      `INSERT INTO undercover_word_candidates
         (id, word_a, word_b, category, material_json, status, created_at)
       VALUES (?, '早起', '晚睡', ?, ?, 'approved', '2026-11-15T00:00:00.000Z')`,
    )
      .bind(
        secondId,
        UNDERCOVER_CATEGORY,
        JSON.stringify({
          wordA: '早起',
          wordB: '晚睡',
          category: UNDERCOVER_CATEGORY,
          commonTraits: ['作息习惯', '感觉困倦'],
          differences: ['发生时间', '是否入睡'],
          potentialIssues: [],
        }),
      )
      .run();
    const calls = mockReviewModel(UNDERCOVER_REVIEW);
    // The mock returns the same review for both; the second candidate fails
    // identity validation, so only the first passes — the batch still runs.
    const result = await reviewWordCandidates(env.DB, env, {
      game: 'undercover',
      candidateIds: [first, secondId],
    });
    expect(result.passedIds).toEqual([first]);
    expect(result.failedIds).toEqual([secondId]);
    expect(calls.calls()).toBe(2);
  });

  it('refuses a stale stored review at publish and lets a re-review fix it', async () => {
    const id = await seedDrawGuessCandidate('passed');
    await env.DB.prepare(`UPDATE drawguess_word_candidates SET review_json = ? WHERE id = ?`)
      .bind(
        JSON.stringify({
          reviewVersion: 'review-v2',
          promptVersion: 'generation-v3',
          packId: null,
          review: DRAWGUESS_REVIEW,
        }),
        id,
      )
      .run();
    expect(await publishWordCandidates(env.DB, { game: 'drawguess', candidateIds: [id] })).toEqual({
      game: 'drawguess',
      publishedIds: [],
      rejectedIds: [id],
      skippedIds: [],
    });
    expect(
      await env.DB.prepare('SELECT status FROM drawguess_word_candidates WHERE id = ?')
        .bind(id)
        .first(),
    ).toEqual({ status: 'passed' });

    const calls = mockReviewModel(DRAWGUESS_REVIEW);
    expect(
      await reviewWordCandidates(env.DB, env, { game: 'drawguess', candidateIds: [id] }),
    ).toEqual({
      game: 'drawguess',
      passedIds: [id],
      rejectedIds: [],
      failedIds: [],
      skippedIds: [],
    });
    expect(calls.calls()).toBe(1);
    expect(await publishWordCandidates(env.DB, { game: 'drawguess', candidateIds: [id] })).toEqual({
      game: 'drawguess',
      publishedIds: [id],
      rejectedIds: [],
      skippedIds: [],
    });
    expect(
      await env.DB.prepare(
        'SELECT word, pinyin_initials, category, status FROM drawguess_words WHERE id = ?',
      )
        .bind(id)
        .first(),
    ).toEqual({
      word: '大熊猫',
      pinyin_initials: 'd x m',
      category: DRAWGUESS_CATEGORY,
      status: 'active',
    });
  });

  it('rejects a passed drawguess word whose pinyin cannot be computed and retires the live word', async () => {
    // '㐀' is in the candidate word range but has no pinyin initial, so
    // publishing must reject it (not fail the whole call) and retire the
    // live inventory word with the same id, as the old pack publish did.
    const id = await seedDrawGuessCandidate('passed', '㐀㐀');
    await env.DB.prepare(
      `INSERT INTO drawguess_words
         (id, word, pinyin_initials, category, difficulty, status, created_at, disabled_at)
       VALUES (?, '㐀㐀', 'x x', ?, 'easy', 'active', '2026-11-15T00:00:00.000Z', NULL)`,
    )
      .bind(id, DRAWGUESS_CATEGORY)
      .run();
    await env.DB.prepare(`UPDATE drawguess_word_candidates SET review_json = ? WHERE id = ?`)
      .bind(
        JSON.stringify({
          reviewVersion: DRAWGUESS_WORD_REVIEW_VERSION,
          promptVersion: 'generation-v3',
          packId: null,
          review: { ...DRAWGUESS_REVIEW, word: '㐀㐀' },
        }),
        id,
      )
      .run();
    expect(await publishWordCandidates(env.DB, { game: 'drawguess', candidateIds: [id] })).toEqual({
      game: 'drawguess',
      publishedIds: [],
      rejectedIds: [id],
      skippedIds: [],
    });
    expect(
      await env.DB.prepare('SELECT status FROM drawguess_word_candidates WHERE id = ?')
        .bind(id)
        .first(),
    ).toEqual({ status: 'rejected' });
    const retired = z
      .strictObject({ status: z.string(), disabled_at: z.string().nullable() })
      .parse(
        await env.DB.prepare('SELECT status, disabled_at FROM drawguess_words WHERE id = ?')
          .bind(id)
          .first(),
      );
    expect(retired.status).toBe('disabled');
    expect(retired.disabled_at).not.toBeNull();
  });

  it('reviews and publishes a fibking word with evidence, sequence, month and cycle', async () => {
    const id = await seedFibkingCandidate('approved', true);
    const calls = mockReviewModel(FIB_REVIEW);
    expect(
      await reviewWordCandidates(env.DB, env, { game: 'fibking', candidateIds: [id] }),
    ).toEqual({ game: 'fibking', passedIds: [id], rejectedIds: [], failedIds: [], skippedIds: [] });
    expect(calls.calls()).toBe(1);
    const reviewRow = z
      .object({
        decision: z.string(),
        review_version: z.string(),
        generation_cycle_id: z.string(),
        evidence_quote: z.string().nullable(),
      })
      .parse(
        await env.DB.prepare(
          `SELECT decision, review_version, generation_cycle_id, evidence_quote
           FROM fib_word_candidate_reviews WHERE word = '菡萏'`,
        ).first(),
      );
    expect(reviewRow).toEqual({
      decision: 'accepted',
      review_version: '12',
      generation_cycle_id: 'review-cycle',
      evidence_quote: '菡萏：荷花的别称，古人常在诗文中用来称呼荷花。',
    });

    expect(await publishWordCandidates(env.DB, { game: 'fibking', candidateIds: [id] })).toEqual({
      game: 'fibking',
      publishedIds: [id],
      rejectedIds: [],
      skippedIds: [],
    });
    expect(
      await env.DB.prepare(
        `SELECT word, category, status, generation_cycle_id FROM fib_words WHERE word = '菡萏'`,
      ).first(),
    ).toEqual({
      word: '菡萏',
      category: 'literary',
      status: 'active',
      generation_cycle_id: 'review-cycle',
    });
    expect(
      await env.DB.prepare('SELECT word, pack_id FROM fib_word_sequence WHERE word = ?')
        .bind('菡萏')
        .first(),
    ).toEqual({ word: '菡萏', pack_id: 'review-cycle' });
    const month = new Date().toISOString().slice(0, 7);
    expect(
      await env.DB.prepare('SELECT published_count FROM fib_word_supply_months WHERE id = ?')
        .bind(month)
        .first(),
    ).toEqual({ published_count: 1 });
    expect(
      await env.DB.prepare(
        'SELECT status, accepted_count FROM fib_word_generation_cycles WHERE id = ?',
      )
        .bind('review-cycle')
        .first(),
    ).toEqual({ status: 'completed', accepted_count: 1 });
  });

  it('reports a fibking publish with no stored review as rejected, keeping it passed', async () => {
    const id = await seedFibkingCandidate('passed', true);
    expect(await publishWordCandidates(env.DB, { game: 'fibking', candidateIds: [id] })).toEqual({
      game: 'fibking',
      publishedIds: [],
      rejectedIds: [id],
      skippedIds: [],
    });
    expect(
      await env.DB.prepare('SELECT status FROM fib_word_candidates WHERE id = ?').bind(id).first(),
    ).toEqual({ status: 'passed' });
  });

  it('reports a fibking publish with no passed candidates as empty instead of failing', async () => {
    expect(
      await publishWordCandidates(env.DB, { game: 'fibking', candidateIds: ['missing'] }),
    ).toEqual({
      game: 'fibking',
      publishedIds: [],
      rejectedIds: [],
      skippedIds: ['missing'],
    });
  });

  it('fails a fibking review whose candidate has no evidence', async () => {
    const id = await seedFibkingCandidate('approved', false);
    mockReviewModelWithEmptyTavily(FIB_REVIEW);
    expect(
      await reviewWordCandidates(env.DB, env, { game: 'fibking', candidateIds: [id] }),
    ).toEqual({
      game: 'fibking',
      passedIds: [],
      rejectedIds: [],
      failedIds: [id],
      skippedIds: [],
    });
    expect(
      await env.DB.prepare('SELECT status FROM fib_word_candidates WHERE id = ?').bind(id).first(),
    ).toEqual({ status: 'failed' });
  });

  it('caps a review call at five candidates and a publish call at thirty', () => {
    expect(CANDIDATE_MANUAL_REVIEW_LIMIT).toBe(5);
    expect(CANDIDATE_MANUAL_PUBLISH_LIMIT).toBe(30);
    expect(
      reviewWordCandidatesSchema.safeParse({
        game: 'undercover',
        candidateIds: ['a', 'b', 'c', 'd', 'e', 'f'],
      }).success,
    ).toBe(false);
    expect(
      publishWordCandidatesSchema.safeParse({
        game: 'undercover',
        candidateIds: Array.from({ length: 31 }, (_, index) => `id-${index}`),
      }).success,
    ).toBe(false);
  });
});
