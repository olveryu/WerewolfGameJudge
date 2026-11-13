/** Real D1 queue recovery, exact review publication, and stable pair retirement. */
import { UNDERCOVER_CATEGORIES } from '@game-judge/game-engine/games/undercover/public';
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { createRowCountingDb } from '../../../../test/rowCountingDb';
import type { UndercoverWordCandidate, UndercoverWordReview } from '../wordEditorial';
import {
  failUndercoverWordPack,
  getUndercoverReviewCandidates,
  publishUndercoverWordPack,
  reserveUndercoverWordPack,
  storeUndercoverWordCandidates,
} from '../wordPublication';

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM undercover_round_word_selections'),
    env.DB.prepare('DELETE FROM undercover_word_candidates'),
    env.DB.prepare('DELETE FROM undercover_word_packs'),
    env.DB.prepare('DELETE FROM undercover_word_pairs'),
    env.DB.prepare("UPDATE database_capacity SET state = 'normal' WHERE id = 1"),
  ]);
});

describe('Undercover editorial publication', () => {
  it('keeps reservation reads bounded as pack history grows', async () => {
    await env.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 1000)
       INSERT INTO undercover_word_packs (id, category, request_token, status, model, prompt_version, review_version, created_at)
       SELECT 'history-' || i, json_extract(?, '$[' || (i % 40) || ']'), 'token-' || i,
         'failed', 'test', '1', '1', '2020-01-01' FROM n`,
    )
      .bind(JSON.stringify(UNDERCOVER_CATEGORIES))
      .run();
    const measured = createRowCountingDb(env.DB);
    expect(await reserveUndercoverWordPack(measured.db, '2026-09-01', 1)).not.toBeNull();
    expect(measured.counts.rowsRead).toBeLessThan(400);
  });

  it('spreads concurrent empty-inventory reservations across categories', async () => {
    const packs = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        reserveUndercoverWordPack(env.DB, '2026-09-01', 1, {
          force: true,
          runId: `parallel-${index}`,
        }),
      ),
    );
    expect(new Set(packs.map((pack) => pack?.category)).size).toBe(10);
  });

  it('prioritizes the least stocked category over its recent-pack cooldown', async () => {
    await env.DB.batch(
      UNDERCOVER_CATEGORIES.filter((category) => category !== 'food').map((category) =>
        env.DB.prepare(
          `INSERT INTO undercover_word_pairs
            (id, word_a, word_b, category, status, created_at, reviewed_at, review_json)
           VALUES (?, ?, ?, ?, 'active', '2026-01-01', '2026-01-01', '{}')`,
        ).bind(`stock-${category}`, `${category}-a`, `${category}-b`, category),
      ),
    );
    await env.DB.prepare(
      `INSERT INTO undercover_word_packs
        (id, category, request_token, status, model, prompt_version, review_version, created_at)
       VALUES ('recent-food', 'food', 'recent-food', 'failed', 'test', '1', '1', ?)`,
    )
      .bind(new Date().toISOString())
      .run();

    const pack = await reserveUndercoverWordPack(env.DB, '2026-09-02', 1);
    expect(pack?.category).toBe('food');
  });

  it('reserves one batch for queued reviews and one for the least stocked category', async () => {
    await env.DB.batch(
      UNDERCOVER_CATEGORIES.map((category) =>
        env.DB.prepare(
          `INSERT INTO undercover_word_pairs
            (id, word_a, word_b, category, status, created_at, reviewed_at, review_json)
           VALUES (?, ?, ?, ?, 'active', '2026-09-01', '2026-09-01', '{}')`,
        ).bind(`existing-${category}`, `${category}-a`, `${category}-b`, category),
      ),
    );
    await env.DB.prepare(
      `INSERT INTO undercover_word_candidates
        (id, word_a, word_b, category, material_json, status, created_at)
       VALUES ('pending', '果汁', '汽水', 'food', '{}', 'pending', '2026-09-01')`,
    ).run();
    const review = await reserveUndercoverWordPack(env.DB, '2026-09-01', 0);
    const replenishment = await reserveUndercoverWordPack(env.DB, '2026-09-01', 1);
    expect(review?.category).toBe('food');
    expect(replenishment).not.toBeNull();
    expect(replenishment?.category).not.toBe('food');
  });

  it('resumes failed material, publishes once, and retires only after a negative review', async () => {
    const first = await reserveUndercoverWordPack(env.DB, '2026-09-01', 0);
    if (first === null) throw new Error('Expected reservation');
    await env.DB.batch(
      UNDERCOVER_CATEGORIES.filter((category) => category !== first.category).map((category) =>
        env.DB.prepare(
          `INSERT INTO undercover_word_pairs
            (id, word_a, word_b, category, status, created_at, reviewed_at, review_json)
           VALUES (?, ?, ?, ?, 'active', '2026-01-01', '2026-01-01', '{}')`,
        ).bind(`stock-${category}`, `${category}-a`, `${category}-b`, category),
      ),
    );
    expect(await reserveUndercoverWordPack(env.DB, '2026-09-01', 0)).toBeNull();
    const candidate: UndercoverWordCandidate = {
      wordA: '熬夜',
      wordB: '赖床',
      category: first.category,
      commonTraits: ['作息习惯', '感觉困倦'],
      differences: ['发生时间', '是否入睡'],
      potentialIssues: [],
    };
    await storeUndercoverWordCandidates(env.DB, first, [candidate]);
    const candidates = await getUndercoverReviewCandidates(env.DB, first);
    expect(candidates).toHaveLength(1);
    await failUndercoverWordPack(env.DB, first, 'review:timedOut');
    const second = await reserveUndercoverWordPack(env.DB, '2026-09-02', 0);
    if (second === null) throw new Error('Expected resumed reservation');
    expect(await getUndercoverReviewCandidates(env.DB, second)).toEqual(candidates);
    const reviewPayload: UndercoverWordReview = {
      wordA: candidate.wordA,
      wordB: candidate.wordB,
      commonTraits: candidate.commonTraits,
      differences: candidate.differences,
      reason: '常见且存在明确共性及差异',
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
    await publishUndercoverWordPack(env.DB, second, candidates, [reviewPayload]);
    await publishUndercoverWordPack(env.DB, second, candidates, [reviewPayload]);
    expect(
      await env.DB.prepare(
        'SELECT COUNT(*) AS count FROM undercover_word_pairs WHERE word_a = ? AND word_b = ?',
      )
        .bind(candidate.wordA, candidate.wordB)
        .first(),
    ).toEqual({ count: 1 });
    await env.DB.prepare("UPDATE undercover_word_candidates SET reviewed_at = '2000-01-01'").run();
    const third = await reserveUndercoverWordPack(env.DB, '2026-09-03', 0);
    if (third === null) throw new Error('Expected review reservation');
    const rereview = await getUndercoverReviewCandidates(env.DB, third);
    expect(rereview).toHaveLength(1);
    expect(
      await env.DB.prepare(
        'SELECT status FROM undercover_word_pairs WHERE word_a = ? AND word_b = ?',
      )
        .bind(candidate.wordA, candidate.wordB)
        .first(),
    ).toEqual({ status: 'active' });
    await publishUndercoverWordPack(env.DB, third, rereview, [
      {
        ...reviewPayload,
        qualityChecks: { ...reviewPayload.qualityChecks, isPlayableBothWays: false },
      },
    ]);
    expect(
      await env.DB.prepare(
        'SELECT status FROM undercover_word_pairs WHERE word_a = ? AND word_b = ?',
      )
        .bind(candidate.wordA, candidate.wordB)
        .first(),
    ).toEqual({ status: 'disabled' });
  });
});

describe('Undercover force reservation', () => {
  it('allows batch indexes beyond the daily limit in its own id namespace', async () => {
    const first = await reserveUndercoverWordPack(env.DB, '2026-09-01', 0);
    if (first === null) throw new Error('Expected reservation');
    // Normal mode rejects batchIndex >= daily limit.
    await expect(reserveUndercoverWordPack(env.DB, '2026-09-01', 2)).rejects.toThrow();
    // Force mode accepts it with a distinct id.
    const forced = await reserveUndercoverWordPack(env.DB, '2026-09-01', 2, {
      force: true,
      runId: 'r1',
    });
    expect(forced?.id).toBe('2026-09-01-force-r1-2');
    // A repeated manual run on the same day gets its own id.
    const forcedAgain = await reserveUndercoverWordPack(env.DB, '2026-09-01', 2, {
      force: true,
      runId: 'r2',
    });
    expect(forcedAgain?.id).toBe('2026-09-01-force-r2-2');
    // Same-day scheduled ids are untouched.
    const second = await reserveUndercoverWordPack(env.DB, '2026-09-01', 1);
    expect(second?.id).toBe('2026-09-01-1');
  });
});
