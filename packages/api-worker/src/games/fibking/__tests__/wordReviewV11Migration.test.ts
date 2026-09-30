/** Integration contract for the FibKing review-v11 rubric CHECK constraint. */

import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

async function seedCycle(): Promise<void> {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO fib_word_generation_cycles (
       id, status, provider, model, prompt_version, request_count,
       accepted_count, rejected_count, duplicate_count, started_at, completed_at
     ) VALUES
       ('v11-check-cycle', 'completed', 'gemini', 'test-model', '10', 1,
        0, 0, 0, '2026-09-30T00:00:00.000Z', '2026-09-30T00:01:00.000Z')`,
  ).run();
}

interface ReviewChecks {
  isEstablishedTerm: number;
  isDefinitionAccurate: number;
  isMeaningUnfamiliarToMostPlayers: number;
  isMeaningDistinctFromLiteralReading: number;
  hasMultiplePlausibleWrongDefinitions: number;
  hasRevealValue: number;
}

const ALL_PASS: ReviewChecks = {
  isEstablishedTerm: 1,
  isDefinitionAccurate: 1,
  isMeaningUnfamiliarToMostPlayers: 1,
  isMeaningDistinctFromLiteralReading: 1,
  hasMultiplePlausibleWrongDefinitions: 1,
  hasRevealValue: 1,
};

async function insertReview(
  id: string,
  checks: ReviewChecks,
  decision: 'accepted' | 'rejected',
  version: string,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO fib_word_candidate_reviews (
       id, word, core_meaning, usage_note, category, source,
       is_established_term, is_definition_accurate,
       is_meaning_unfamiliar_to_most_players, is_meaning_distinct_from_literal_reading,
       has_multiple_plausible_wrong_definitions, has_reveal_value,
       decision, reason, review_version, generation_cycle_id, reviewed_at
     ) VALUES (?, ?, '测试含义', '测试说明', 'niche', 'gemini',
       ?, ?, ?, ?, ?, ?, ?, '测试理由。', ?, 'v11-check-cycle', '2026-09-30T00:00:00.000Z')`,
  )
    .bind(
      id,
      id,
      checks.isEstablishedTerm,
      checks.isDefinitionAccurate,
      checks.isMeaningUnfamiliarToMostPlayers,
      checks.isMeaningDistinctFromLiteralReading,
      checks.hasMultiplePlausibleWrongDefinitions,
      checks.hasRevealValue,
      decision,
      version,
    )
    .run();
}

describe('fib review v11 CHECK', () => {
  it('accepts a v11 accepted row with four hard gates and one fun signal', async () => {
    await seedCycle();
    await insertReview('v11-ok', { ...ALL_PASS, hasRevealValue: 0 }, 'accepted', '11');
    const row = await env.DB.prepare(
      `SELECT decision FROM fib_word_candidate_reviews WHERE id = 'v11-ok'`,
    ).first<{ decision: string }>();
    expect(row?.decision).toBe('accepted');
  });

  it('rejects a v11 accepted row with no fun signal', async () => {
    await seedCycle();
    await expect(
      insertReview(
        'v11-no-fun',
        { ...ALL_PASS, hasMultiplePlausibleWrongDefinitions: 0, hasRevealValue: 0 },
        'accepted',
        '11',
      ),
    ).rejects.toThrow();
  });

  it('rejects a v11 rejected row whose checks would accept', async () => {
    await seedCycle();
    await expect(insertReview('v11-mismatch', ALL_PASS, 'rejected', '11')).rejects.toThrow();
  });

  it('accepts a v11 rejected row failing a hard gate', async () => {
    await seedCycle();
    await insertReview(
      'v11-hard-fail',
      { ...ALL_PASS, isMeaningDistinctFromLiteralReading: 0 },
      'rejected',
      '11',
    );
    const row = await env.DB.prepare(
      `SELECT decision FROM fib_word_candidate_reviews WHERE id = 'v11-hard-fail'`,
    ).first<{ decision: string }>();
    expect(row?.decision).toBe('rejected');
  });

  it('leaves pre-v11 rows untouched by the v11 rule', async () => {
    await seedCycle();
    // A v10 accepted row with neither fun signal passes: immutable history is not re-judged.
    await insertReview(
      'v10-legacy',
      { ...ALL_PASS, hasMultiplePlausibleWrongDefinitions: 0, hasRevealValue: 0 },
      'accepted',
      '10',
    );
    const row = await env.DB.prepare(
      `SELECT decision FROM fib_word_candidate_reviews WHERE id = 'v10-legacy'`,
    ).first<{ decision: string }>();
    expect(row?.decision).toBe('accepted');
  });
});
