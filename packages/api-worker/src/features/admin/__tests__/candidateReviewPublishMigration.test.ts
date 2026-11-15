/** Integration contract for migration 0085: the candidate manual
 * review/publish states ('reviewing', 'passed', 'rejected', 'failed',
 * 'published') are accepted by the status CHECK of all three candidate
 * tables, the fibking table-level CHECK still ties every new state to
 * "holds no claim", and undercover candidates gain a review_json column
 * holding the stored accepted review (same shape as drawguess). */

import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

const FIBKING_STATUSES = [
  'pending',
  'approved',
  'claimed',
  'reviewing',
  'passed',
  'rejected',
  'failed',
  'published',
] as const;
const PAIR_STATUSES = [
  'pending',
  'approved',
  'accepted',
  'rejected',
  'reviewing',
  'passed',
  'failed',
  'published',
] as const;

async function seedFibkingCycle(): Promise<void> {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO fib_word_generation_cycles (
       id, status, provider, model, prompt_version, request_count,
       accepted_count, rejected_count, duplicate_count, started_at, completed_at
     ) VALUES
       ('review-publish-cycle', 'completed', 'gemini', 'test-model', '10', 1,
        0, 0, 0, '2026-09-30T00:00:00.000Z', '2026-09-30T00:01:00.000Z')`,
  ).run();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO fib_word_supply_months (id, requests_reserved, published_count)
     VALUES ('2026-11', 1, 0)`,
  ).run();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO fib_word_packs (
       id, month_id, request_token, category, status, created_at, search_index
     ) VALUES ('review-publish-pack', '2026-11', 'review-publish-token',
       'niche', 'reserved', '2026-11-15T00:00:00.000Z', 0)`,
  ).run();
}

describe('migration 0085 candidate manual review/publish states', () => {
  it('accepts every manual review/publish state in all three candidate tables', async () => {
    await seedFibkingCycle();
    for (const status of FIBKING_STATUSES) {
      // 'claimed' is the one state that must carry a claim; the rest must
      // carry none, per the table-level CHECK.
      const isClaimed = status === 'claimed';
      await env.DB.prepare(
        `INSERT INTO fib_word_candidates (
           id, word, core_meaning, usage_note, category, source,
           evidence_json, generation_cycle_id, status, claimed_pack_id,
           claimed_at, created_at
         ) VALUES (?, ?, '测试含义', '测试说明', 'niche', 'gemini', '[]',
           'review-publish-cycle', ?, ?, ?, '2026-11-15T00:00:00.000Z')`,
      )
        .bind(
          `fib-${status}`,
          `词-${status}`,
          status,
          isClaimed ? 'review-publish-pack' : null,
          isClaimed ? '2026-11-15T00:00:00.000Z' : null,
        )
        .run();
    }
    for (const status of PAIR_STATUSES) {
      await env.DB.prepare(
        `INSERT INTO undercover_word_candidates (
           id, word_a, word_b, category, material_json, status, created_at
         ) VALUES (?, ?, ?, 'food', '{}', ?, '2026-11-15T00:00:00.000Z')`,
      )
        .bind(`undercover-${status}`, `词A-${status}`, `词B-${status}`, status)
        .run();
      await env.DB.prepare(
        `INSERT INTO drawguess_word_candidates (
           id, word, category, difficulty, material_json, status, created_at
         ) VALUES (?, ?, 'food', 'easy', '{}', ?, '2026-11-15T00:00:00.000Z')`,
      )
        .bind(`drawguess-${status}`, `词-${status}`, status)
        .run();
    }
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM fib_word_candidates WHERE status IN ('reviewing', 'passed', 'rejected', 'failed', 'published')",
      ).first(),
    ).toEqual({ count: 5 });
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM undercover_word_candidates WHERE status IN ('reviewing', 'passed', 'failed', 'published')",
      ).first(),
    ).toEqual({ count: 4 });
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM drawguess_word_candidates WHERE status IN ('reviewing', 'passed', 'failed', 'published')",
      ).first(),
    ).toEqual({ count: 4 });
  });

  it('rejects a status outside the CHECK in every candidate table', async () => {
    await seedFibkingCycle();
    await expect(
      env.DB.prepare(
        `INSERT INTO fib_word_candidates (
           id, word, core_meaning, usage_note, category, source,
           evidence_json, generation_cycle_id, status, created_at
         ) VALUES ('fib-bad', '坏词', '测试含义', '测试说明', 'niche', 'gemini', '[]',
           'review-publish-cycle', 'archived', '2026-11-15T00:00:00.000Z')`,
      ).run(),
    ).rejects.toThrow();
    await expect(
      env.DB.prepare(
        `INSERT INTO undercover_word_candidates (
           id, word_a, word_b, category, material_json, status, created_at
         ) VALUES ('undercover-bad', '词A-坏', '词B-坏', 'food', '{}', 'archived', '2026-11-15T00:00:00.000Z')`,
      ).run(),
    ).rejects.toThrow();
    await expect(
      env.DB.prepare(
        `INSERT INTO drawguess_word_candidates (
           id, word, category, difficulty, material_json, status, created_at
         ) VALUES ('drawguess-bad', '坏词', 'food', 'easy', '{}', 'archived', '2026-11-15T00:00:00.000Z')`,
      ).run(),
    ).rejects.toThrow();
  });

  it('keeps the fibking table-level CHECK: new states hold no claim', async () => {
    await seedFibkingCycle();
    // A 'passed' candidate that still carries a claim violates the
    // table-level CHECK even though 'passed' is in the status CHECK.
    await expect(
      env.DB.prepare(
        `INSERT INTO fib_word_candidates (
           id, word, core_meaning, usage_note, category, source,
           evidence_json, generation_cycle_id, status, claimed_pack_id,
           claimed_at, created_at
         ) VALUES ('fib-claimed-passed', '占位词', '测试含义', '测试说明',
           'niche', 'gemini', '[]', 'review-publish-cycle', 'passed',
           'review-publish-pack', '2026-11-15T00:00:00.000Z',
           '2026-11-15T00:00:00.000Z')`,
      ).run(),
    ).rejects.toThrow();
    // And 'claimed' without a claim still fails, as before.
    await expect(
      env.DB.prepare(
        `INSERT INTO fib_word_candidates (
           id, word, core_meaning, usage_note, category, source,
           evidence_json, generation_cycle_id, status, created_at
         ) VALUES ('fib-claimed-no-pack', '占位词二', '测试含义', '测试说明',
           'niche', 'gemini', '[]', 'review-publish-cycle', 'claimed',
           '2026-11-15T00:00:00.000Z')`,
      ).run(),
    ).rejects.toThrow();
  });

  it('stores the accepted review JSON on undercover candidates', async () => {
    const review = JSON.stringify({
      wordA: '词A-审',
      wordB: '词B-审',
      reason: '通过。',
      qualityChecks: { isFamiliar: true },
    });
    await env.DB.prepare(
      `INSERT INTO undercover_word_candidates (
         id, word_a, word_b, category, material_json, review_json, status,
         created_at, reviewed_at
       ) VALUES ('undercover-reviewed', '词A-审', '词B-审', 'food', '{}', ?, 'passed',
         '2026-11-15T00:00:00.000Z', '2026-11-15T00:01:00.000Z')`,
    )
      .bind(review)
      .run();
    expect(
      await env.DB.prepare(
        "SELECT review_json AS reviewJson FROM undercover_word_candidates WHERE id = 'undercover-reviewed'",
      ).first(),
    ).toEqual({ reviewJson: review });
    await expect(
      env.DB.prepare(
        `INSERT INTO undercover_word_candidates (
           id, word_a, word_b, category, material_json, review_json, status,
           created_at
         ) VALUES ('undercover-bad-json', '词A-坏', '词B-坏', 'food', '{}', '{bad',
           'passed', '2026-11-15T00:00:00.000Z')`,
      ).run(),
    ).rejects.toThrow();
  });
});
