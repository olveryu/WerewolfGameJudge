/** Real D1 publication contracts: quota, immutable ordering, and replay-safe accounting. */
import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import type { FibWordCandidate } from '../wordProviders/types';
import {
  claimFibWordProviderRequest,
  getFibWordReviewCandidates,
  publishFibWordPack,
  reserveFibWordPack,
} from '../wordPublication';

describe('Fib word publication', () => {
  it('does not resend an uncertain external request after a restart', async () => {
    const pack = await reserveFibWordPack(env.DB, '2026-12-01', 0);
    if (pack === null) throw new Error('Expected pack reservation');
    await claimFibWordProviderRequest(env.DB, pack, 'discovery');
    await expect(claimFibWordProviderRequest(env.DB, pack, 'discovery')).rejects.toThrow(
      'already consumed',
    );
  });
  it('publishes approved words once, including words from the former local bank', async () => {
    const pack = await reserveFibWordPack(env.DB, '2026-09-01', 0);
    if (pack === null) throw new Error('Expected pack reservation');
    expect(await reserveFibWordPack(env.DB, '2026-09-01', 0)).toBeNull();
    const candidates: FibWordCandidate[] = ['菡萏', '射覆', '却扇', '打尖', '测试甲', '测试乙'].map(
      (word) => ({
        word,
        source: 'gemini',
        definition: {
          coreMeaning: '用于测试的真实核心含义。',
          usageNote: '用于测试的具体使用语境。',
        },
      }),
    );
    const reviews = candidates.map(({ word }) => ({
      word,
      decision: 'accepted' as const,
      reason: '通过测试审核',
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
    expect(await getFibWordReviewCandidates(env.DB, pack, [...candidates].reverse())).toEqual(
      [...candidates].reverse(),
    );
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
});
