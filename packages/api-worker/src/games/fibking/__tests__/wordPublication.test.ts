/** Real D1 publication contracts: quota, immutable ordering, and replay-safe accounting. */
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { cleanupFibWordAudit } from '../maintenance';
import {
  getFibWordReviewCandidates,
  storeFibWordCandidates,
  updateFibWordCandidateEvidence,
} from '../wordCandidatePool';
import type { FibWordEditorialCandidate } from '../wordProviders/types';
import {
  claimFibWordProviderRequest,
  failFibWordPack,
  publishFibWordPack,
  reserveFibWordPack,
} from '../wordPublication';

beforeEach(async () => {
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

describe('Fib word publication', () => {
  it('advances the search index across days and manual batches without replaying reservations', async () => {
    expect(await reserveFibWordPack(env.DB, '2026-09-01', 0)).toMatchObject({ searchIndex: 0 });
    expect(await reserveFibWordPack(env.DB, '2026-09-01', 0)).toBeNull();
    expect(await reserveFibWordPack(env.DB, '2026-09-02', 0)).toMatchObject({ searchIndex: 1 });
    expect(await reserveFibWordPack(env.DB, '2026-09-02', 4, 60)).toMatchObject({ searchIndex: 2 });
  });
  it('does not resend an uncertain external request after a restart', async () => {
    const pack = await reserveFibWordPack(env.DB, '2026-12-01', 0);
    if (pack === null) throw new Error('Expected pack reservation');
    await claimFibWordProviderRequest(env.DB, pack, 'discovery');
    await expect(claimFibWordProviderRequest(env.DB, pack, 'discovery')).rejects.toThrow(
      'already consumed',
    );
  });

  it('caps search and extraction together without spending the model reservations', async () => {
    const pack = await reserveFibWordPack(env.DB, '2026-12-01', 0);
    if (pack === null) throw new Error('Expected pack reservation');
    for (const operation of [
      'discovery',
      'extraction',
      'verification-0',
      'verification-extraction-0',
      'verification-1',
      'verification-extraction-1',
      'verification-2',
    ] as const) {
      await claimFibWordProviderRequest(env.DB, pack, operation);
    }
    await expect(
      claimFibWordProviderRequest(env.DB, pack, 'verification-extraction-2'),
    ).rejects.toThrow('budget exhausted');
    await claimFibWordProviderRequest(env.DB, pack, 'generation');
    await claimFibWordProviderRequest(env.DB, pack, 'review');
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM fib_word_provider_requests').first(),
    ).toEqual({ count: 9 });
  });

  it('publishes approved words once, including words from the former local bank', async () => {
    const pack = await reserveFibWordPack(env.DB, '2026-09-01', 0);
    if (pack === null) throw new Error('Expected pack reservation');
    expect(await reserveFibWordPack(env.DB, '2026-09-01', 0)).toBeNull();
    const candidates: FibWordEditorialCandidate[] = [
      '菡萏',
      '射覆',
      '却扇',
      '打尖',
      '测试甲',
      '测试乙',
    ].map((word) => ({
      word,
      source: 'gemini',
      category: 'literary',
      evidence: [
        {
          query: word,
          url: 'https://example.com/words',
          title: word,
          content: `${word}：用于测试的真实核心含义。`,
        },
      ],
      definition: {
        coreMeaning: '用于测试的真实核心含义。',
        usageNote: '用于测试的具体使用语境。',
      },
    }));
    const reviews = candidates.map(({ word }) => ({
      word,
      decision: 'accepted' as const,
      reason: '通过测试审核',
      evidenceIndex: 0,
      evidenceQuote: `${word}：用于测试的真实核心含义。`,
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
    await publishFibWordPack(env.DB, pack, candidates, reviews, ['https://example.com/words']);
    await publishFibWordPack(env.DB, pack, candidates, reviews, ['https://example.com/words']);
    expect(await getFibWordReviewCandidates(env.DB, pack)).toEqual([]);
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM fib_word_sequence').first()).toEqual(
      { count: 6 },
    );
    expect(
      await env.DB.prepare(
        "SELECT requests_reserved, published_count FROM fib_word_supply_months WHERE id = '2026-09'",
      ).first(),
    ).toEqual({ requests_reserved: 1, published_count: 6 });

    const sequence = await env.DB.prepare('SELECT * FROM fib_word_sequence ORDER BY id').all();
    const rejectedPack = await reserveFibWordPack(env.DB, '2026-09-02', 0);
    const correctedPack = await reserveFibWordPack(env.DB, '2026-09-03', 0);
    if (rejectedPack === null || correctedPack === null) throw new Error('Expected review packs');
    await publishFibWordPack(
      env.DB,
      rejectedPack,
      candidates,
      reviews.map((review) => ({
        ...review,
        decision: 'rejected',
        qualityChecks: { ...review.qualityChecks, isDefinitionAccurate: false },
      })),
      ['https://example.com/words'],
    );
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM fib_words WHERE status = 'active'",
      ).first(),
    ).toEqual({ count: 0 });
    await env.DB.prepare(
      "UPDATE fib_word_supply_months SET published_count = 100 WHERE id = '2026-09'",
    ).run();
    await publishFibWordPack(
      env.DB,
      correctedPack,
      candidates.map((candidate) => ({
        ...candidate,
        definition: { ...candidate.definition, coreMeaning: '重新核实后修正的核心含义。' },
      })),
      reviews,
      ['https://example.com/corrected'],
    );
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM fib_words WHERE status = 'active' AND core_meaning = '重新核实后修正的核心含义。'",
      ).first(),
    ).toEqual({ count: 6 });
    expect(
      (await env.DB.prepare('SELECT * FROM fib_word_sequence ORDER BY id').all()).results,
    ).toEqual(sequence.results);
    expect(
      await env.DB.prepare(
        "SELECT published_count FROM fib_word_supply_months WHERE id = '2026-09'",
      ).first(),
    ).toEqual({ published_count: 100 });
  });

  it('refuses new work when the monthly budget is consumed or capacity is paused', async () => {
    await env.DB.prepare(
      "INSERT INTO fib_word_supply_months (id, requests_reserved) VALUES ('2026-10', 80)",
    ).run();
    expect(await reserveFibWordPack(env.DB, '2026-10-01', 0)).toBeNull();
    await env.DB.prepare("UPDATE database_capacity SET state = 'paused' WHERE id = 1").run();
    expect(await reserveFibWordPack(env.DB, '2026-11-01', 0)).toBeNull();
  });

  it('persists overflow, replays claims, and releases failed claims without refunding quota', async () => {
    const firstPack = await reserveFibWordPack(env.DB, '2026-08-01', 0);
    const secondPack = await reserveFibWordPack(env.DB, '2026-08-01', 1);
    if (firstPack === null || secondPack === null) throw new Error('Expected editorial packs');
    const candidates: FibWordEditorialCandidate[] = [
      '甲',
      '乙',
      '丙',
      '丁',
      '戊',
      '己',
      '庚',
      '辛',
    ].map((suffix, index) => ({
      word: `测试${suffix}`,
      definition: {
        coreMeaning: '用于测试的真实核心含义。',
        usageNote: '用于测试的具体使用语境。',
      },
      source: 'gemini',
      category: index % 2 === 0 ? 'niche' : 'literary',
      evidence: [
        {
          query: '词源',
          url: 'https://example.com/words',
          title: '测试词源',
          content: `测试${suffix}：用于测试的真实核心含义。`,
        },
      ],
    }));
    await storeFibWordCandidates(env.DB, firstPack, candidates);
    await storeFibWordCandidates(env.DB, firstPack, candidates);
    const firstClaim = await getFibWordReviewCandidates(env.DB, firstPack);
    expect(firstClaim).toEqual(candidates.slice(0, 6));
    expect(await getFibWordReviewCandidates(env.DB, firstPack)).toEqual(firstClaim);
    expect(await getFibWordReviewCandidates(env.DB, secondPack)).toEqual(candidates.slice(6));
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM fib_words').first()).toEqual({
      count: 0,
    });
    await failFibWordPack(env.DB, firstPack, 'review:rateLimited');
    const thirdPack = await reserveFibWordPack(env.DB, '2026-08-01', 2);
    if (thirdPack === null) throw new Error('Expected recovery pack');
    expect(await getFibWordReviewCandidates(env.DB, thirdPack)).toEqual(firstClaim);
    expect(
      await env.DB.prepare('SELECT requests_reserved FROM fib_word_supply_months').first(),
    ).toEqual({ requests_reserved: 3 });
  });

  it('records an empty result without publishing or advancing the word sequence', async () => {
    const pack = await reserveFibWordPack(env.DB, '2026-07-01', 0);
    if (pack === null) throw new Error('Expected empty pack');
    await publishFibWordPack(env.DB, pack, [], [], []);
    expect(await env.DB.prepare('SELECT status, outcome FROM fib_word_packs').first()).toEqual({
      status: 'published',
      outcome: 'noCandidates',
    });
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM fib_word_sequence').first()).toEqual(
      { count: 0 },
    );
  });

  it('retains accepted candidates that do not fit the remaining monthly publication target', async () => {
    const pack = await reserveFibWordPack(env.DB, '2026-09-01', 0);
    if (pack === null) throw new Error('Expected limited publication pack');
    await env.DB.prepare(
      "UPDATE fib_word_supply_months SET published_count = 99 WHERE id = '2026-09'",
    ).run();
    const candidates: FibWordEditorialCandidate[] = ['测试甲', '测试乙'].map((word) => ({
      word,
      definition: {
        coreMeaning: '用于测试的真实核心含义。',
        usageNote: '用于测试的具体使用语境。',
      },
      source: 'gemini',
      category: 'niche',
      evidence: [
        {
          query: word,
          url: 'https://example.com/words',
          title: word,
          content: `${word}：用于测试的真实核心含义。`,
        },
      ],
    }));
    const reviews = candidates.map(({ word }) => ({
      word,
      decision: 'accepted' as const,
      reason: '有资料支持且符合游戏性标准。',
      evidenceIndex: 0,
      evidenceQuote: `${word}：用于测试的真实核心含义。`,
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
    await storeFibWordCandidates(env.DB, pack, candidates);
    await getFibWordReviewCandidates(env.DB, pack);
    await publishFibWordPack(env.DB, pack, candidates, reviews, ['https://example.com/words']);
    expect(
      await env.DB.prepare('SELECT published_count FROM fib_word_supply_months').first(),
    ).toEqual({ published_count: 100 });
    expect((await env.DB.prepare('SELECT word FROM fib_word_sequence').all()).results).toEqual([
      { word: '测试甲' },
    ]);
    expect(
      (await env.DB.prepare('SELECT word, status FROM fib_word_candidates').all()).results,
    ).toEqual([{ word: '测试乙', status: 'pending' }]);
  });

  it('preserves completed inventory verification after a later review failure', async () => {
    await env.DB.prepare(
      `INSERT INTO fib_words (id, word, core_meaning, usage_note, category, source,
       status, selection_key, created_at, activated_at)
       VALUES ('inventory', '测试甲', '用于测试的真实核心含义。', '用于测试的具体使用语境。',
         'literary', 'local', 'active', 0, '2026-01-01', '2026-01-01')`,
    ).run();
    const firstPack = await reserveFibWordPack(env.DB, '2026-09-01', 0);
    const secondPack = await reserveFibWordPack(env.DB, '2026-09-01', 1);
    if (firstPack === null || secondPack === null) throw new Error('Expected verification packs');
    const [candidate] = await getFibWordReviewCandidates(env.DB, firstPack);
    if (candidate === undefined) throw new Error('Expected inventory candidate');
    expect(candidate.evidence).toEqual([]);
    const verifiedCandidate = {
      ...candidate,
      evidence: [
        {
          query: candidate.word,
          url: 'https://example.com/words',
          title: candidate.word,
          content: '测试甲：用于测试的真实核心含义。',
        },
      ],
    };
    await updateFibWordCandidateEvidence(env.DB, firstPack, verifiedCandidate);
    await failFibWordPack(env.DB, firstPack, 'review:rateLimited');
    expect(await getFibWordReviewCandidates(env.DB, secondPack)).toEqual([verifiedCandidate]);
  });

  it('expires pending source snapshots without deleting claimed candidates', async () => {
    const claimedPack = await reserveFibWordPack(env.DB, '2026-06-01', 0);
    const pendingPack = await reserveFibWordPack(env.DB, '2026-06-01', 1);
    if (claimedPack === null || pendingPack === null) throw new Error('Expected retention packs');
    const candidates: FibWordEditorialCandidate[] = ['测试甲', '测试乙'].map((word) => ({
      word,
      definition: {
        coreMeaning: '用于测试的真实核心含义。',
        usageNote: '用于测试的具体使用语境。',
      },
      source: 'gemini',
      category: 'niche',
      evidence: [
        {
          query: word,
          url: 'https://example.com/words',
          title: word,
          content: `${word}：用于测试的真实核心含义。`,
        },
      ],
    }));
    await storeFibWordCandidates(env.DB, claimedPack, candidates.slice(0, 1));
    await getFibWordReviewCandidates(env.DB, claimedPack);
    await storeFibWordCandidates(env.DB, pendingPack, candidates.slice(1));
    await env.DB.prepare(
      "UPDATE fib_word_candidates SET created_at = '2026-06-01T00:00:00.000Z'",
    ).run();
    await cleanupFibWordAudit(env.DB, Date.parse('2026-09-11T00:00:00.000Z'));
    expect(
      (await env.DB.prepare('SELECT word, status FROM fib_word_candidates').all()).results,
    ).toEqual([{ word: '测试甲', status: 'claimed' }]);
  });
});
