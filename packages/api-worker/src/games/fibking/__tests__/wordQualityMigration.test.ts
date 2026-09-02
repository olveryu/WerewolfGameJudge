/** Integration contract for the FibKing review-v3 clean-slate reset. */

import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

const MIGRATION_NAME = '0048_enforce_fib_word_quality_v3.sql';

function requireMigration() {
  const migration = env.TEST_MIGRATIONS.find(({ name }) => name === MIGRATION_NAME);
  if (migration === undefined || migration.queries.length === 0) {
    throw new Error(`[FAIL-FAST] Missing test migration ${MIGRATION_NAME}`);
  }
  return migration;
}

async function seedExistingInventory(): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO fib_word_generation_cycles (
         id, status, provider, model, prompt_version, request_count,
         accepted_count, rejected_count, duplicate_count, started_at, completed_at
       ) VALUES
         ('legacy-rejected-cycle', 'completed', 'gemini', 'test-model', '2', 1,
          0, 1, 5, '2026-08-01T00:00:00.000Z', '2026-08-01T00:01:00.000Z'),
         ('legacy-accepted-cycle', 'completed', 'gemini', 'test-model', '2', 1,
          1, 0, 5, '2026-08-01T00:02:00.000Z', '2026-08-01T00:03:00.000Z'),
         ('current-accepted-cycle', 'completed', 'gemini', 'test-model', '3', 1,
          1, 0, 5, '2026-08-01T00:04:00.000Z', '2026-08-01T00:05:00.000Z')`,
    ),
    env.DB.prepare(
      `INSERT INTO fib_words (
         id, word, core_meaning, usage_note, category, source, status,
         selection_key, generation_cycle_id, created_at, activated_at
       ) VALUES
         ('rejected-word', '云监工', '测试含义', '测试说明', 'internet', 'gemini',
          'active', 1, 'legacy-rejected-cycle', '2026-08-01T00:00:00.000Z',
          '2026-08-01T00:00:00.000Z'),
         ('obsolete-review-word', '工具箱思维', '测试含义', '测试说明', 'internet',
          'gemini', 'active', 2, 'legacy-accepted-cycle', '2026-08-01T00:00:00.000Z',
          '2026-08-01T00:00:00.000Z'),
         ('unsuitable-word', '捉刀代笔', '测试含义', '测试说明', 'compound', 'gemini',
          'active', 3, NULL, '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'),
         ('current-reviewed-word', '却扇', '测试含义', '测试说明', 'niche', 'gemini',
          'active', 4, 'current-accepted-cycle', '2026-08-01T00:00:00.000Z',
          '2026-08-01T00:00:00.000Z'),
         ('retained-legacy-word', '盘桓', '测试含义', '测试说明', 'literary', 'gemini',
          'active', 5, NULL, '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z')`,
    ),
    env.DB.prepare(
      `INSERT INTO fib_word_candidate_reviews (
         id, word, core_meaning, usage_note, category, source,
         is_established_term, is_definition_accurate, is_easy_to_read_aloud,
         is_meaning_unfamiliar_to_most_players,
         is_meaning_distinct_from_literal_reading,
         has_multiple_plausible_wrong_definitions, has_reveal_value,
         decision, reason, review_version, generation_cycle_id, reviewed_at
       ) VALUES
         ('rejected-review', '云监工', '测试含义', '测试说明', 'internet', 'gemini',
          1, 1, 1, 0, 1, 1, 1, 'rejected', '属于高频流行语。', '3',
          'legacy-rejected-cycle', '2026-08-01T00:01:00.000Z'),
         ('accepted-review', '工具箱思维', '测试含义', '测试说明', 'internet', 'gemini',
          1, 1, 1, 1, 1, 1, 1, 'accepted', '七项质量检查全部通过。', '3',
          'legacy-accepted-cycle', '2026-08-01T00:03:00.000Z'),
         ('current-review', '却扇', '测试含义', '测试说明', 'niche', 'gemini',
          1, 1, 1, 1, 1, 1, 1, 'accepted', '七项质量检查全部通过。', '3',
          'current-accepted-cycle', '2026-08-01T00:05:00.000Z')`,
    ),
    env.DB.prepare(
      `UPDATE fib_word_supply_state
       SET active_cycle_id = 'legacy-accepted-cycle',
           active_cycle_started_at = '2026-08-01T00:02:00.000Z',
           lease_owner = 'legacy-owner',
           lease_expires_at = '2026-08-01T00:12:00.000Z',
           last_completed_at = '2026-08-01T00:05:00.000Z',
           updated_at = '2026-08-01T00:05:00.000Z'
       WHERE id = 1`,
    ),
  ]);
}

async function applyQualityMigration(): Promise<void> {
  const migration = requireMigration();
  await env.DB.batch(migration.queries.map((query) => env.DB.prepare(query)));
}

describe(MIGRATION_NAME, () => {
  it('removes all legacy inventory and resets supply state', async () => {
    await seedExistingInventory();

    await applyQualityMigration();

    expect(
      await env.DB.prepare(
        `SELECT
           (SELECT COUNT(*) FROM fib_words) AS word_count,
           (SELECT COUNT(*) FROM fib_word_candidate_reviews) AS review_count,
           (SELECT COUNT(*) FROM fib_word_generation_cycles) AS cycle_count`,
      ).first(),
    ).toEqual({ word_count: 0, review_count: 0, cycle_count: 0 });
    expect(
      await env.DB.prepare(
        `SELECT active_cycle_id, active_cycle_started_at, lease_owner, lease_expires_at,
                last_completed_at
         FROM fib_word_supply_state WHERE id = 1`,
      ).first(),
    ).toEqual({
      active_cycle_id: null,
      active_cycle_started_at: null,
      lease_owner: null,
      lease_expires_at: null,
      last_completed_at: null,
    });
  });
});
