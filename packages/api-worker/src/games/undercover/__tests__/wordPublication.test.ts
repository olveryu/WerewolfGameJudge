/** Real D1 queue recovery, exact review publication, and stable pair retirement. */
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

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
  it('resumes failed material, publishes once, and retires only after a negative review', async () => {
    const first = await reserveUndercoverWordPack(env.DB, '2026-09-01', 0);
    if (first === null) throw new Error('Expected reservation');
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
      await env.DB.prepare('SELECT COUNT(*) AS count FROM undercover_word_pairs').first(),
    ).toEqual({ count: 1 });
    await env.DB.prepare("UPDATE undercover_word_candidates SET reviewed_at = '2000-01-01'").run();
    const third = await reserveUndercoverWordPack(env.DB, '2026-09-03', 0);
    if (third === null) throw new Error('Expected review reservation');
    const rereview = await getUndercoverReviewCandidates(env.DB, third);
    expect(rereview).toHaveLength(1);
    expect(await env.DB.prepare('SELECT status FROM undercover_word_pairs').first()).toEqual({
      status: 'active',
    });
    await publishUndercoverWordPack(env.DB, third, rereview, [
      {
        ...reviewPayload,
        qualityChecks: { ...reviewPayload.qualityChecks, isPlayableBothWays: false },
      },
    ]);
    expect(await env.DB.prepare('SELECT status FROM undercover_word_pairs').first()).toEqual({
      status: 'disabled',
    });
  });
});
