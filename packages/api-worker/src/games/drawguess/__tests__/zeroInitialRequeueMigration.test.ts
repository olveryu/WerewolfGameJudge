/** Integration contract for returning hint-only DrawGuess rejections to the review queue. */
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

const MIGRATION_NAME = '0078_drawguess_requeue_zero_initial_words.sql';
const REVIEWED_AT = '2026-11-01T00:00:00.000Z';
const PASSING_CHECKS = {
  isConcreteAndDrawable: true,
  isSimplifiedChinese: true,
  isLengthValid: true,
  isCategoryAccurate: true,
  isAppropriate: true,
  isUnambiguous: true,
};

function requireMigration() {
  const migration = env.TEST_MIGRATIONS.find(({ name }) => name === MIGRATION_NAME);
  if (migration === undefined || migration.queries.length === 0)
    throw new Error(`[FAIL-FAST] Missing test migration ${MIGRATION_NAME}`);
  return migration;
}

function insertCandidate(
  word: string,
  status: 'accepted' | 'rejected',
  pinyinInitials: string | null,
  qualityChecks: Record<string, boolean>,
) {
  return env.DB.prepare(
    `INSERT INTO drawguess_word_candidates
     (id, word, category, difficulty, material_json, review_json, status, claimed_pack_id, created_at, reviewed_at)
     VALUES (?, ?, 'animals', 'easy', '{}', ?, ?, 'reviewed-pack', ?, ?)`,
  ).bind(
    word,
    word,
    JSON.stringify({ pinyinInitials, review: { word, qualityChecks, reason: '测试审核。' } }),
    status,
    REVIEWED_AT,
    REVIEWED_AT,
  );
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM drawguess_word_candidates'),
    env.DB.prepare('DELETE FROM drawguess_word_packs'),
    env.DB.prepare(
      `INSERT INTO drawguess_word_packs
       (id, category, request_token, status, model, prompt_version, review_version, created_at, completed_at)
       VALUES ('reviewed-pack', 'animals', 'token', 'published', 'model', 'p', 'r', ?, ?)`,
    ).bind(REVIEWED_AT, REVIEWED_AT),
  ]);
});

describe('DrawGuess zero-initial requeue migration', () => {
  it('requeues only rejections whose sole cause was the missing pinyin hint', async () => {
    await env.DB.batch([
      insertCandidate('企鹅', 'rejected', null, PASSING_CHECKS),
      insertCandidate('恶霸', 'rejected', null, { ...PASSING_CHECKS, isUnambiguous: false }),
      insertCandidate('幸福', 'rejected', 'x f', {
        ...PASSING_CHECKS,
        isConcreteAndDrawable: false,
      }),
      insertCandidate('大熊猫', 'accepted', 'd x m', PASSING_CHECKS),
    ]);

    await env.DB.batch(requireMigration().queries.map((query) => env.DB.prepare(query)));

    const rows = await env.DB.prepare(
      `SELECT word, status, claimed_pack_id, reviewed_at, review_json IS NULL AS review_cleared
       FROM drawguess_word_candidates ORDER BY word`,
    ).all();
    expect(rows.results).toEqual([
      {
        word: '企鹅',
        status: 'pending',
        claimed_pack_id: null,
        reviewed_at: null,
        review_cleared: 1,
      },
      {
        word: '大熊猫',
        status: 'accepted',
        claimed_pack_id: 'reviewed-pack',
        reviewed_at: REVIEWED_AT,
        review_cleared: 0,
      },
      {
        word: '幸福',
        status: 'rejected',
        claimed_pack_id: 'reviewed-pack',
        reviewed_at: REVIEWED_AT,
        review_cleared: 0,
      },
      {
        word: '恶霸',
        status: 'rejected',
        claimed_pack_id: 'reviewed-pack',
        reviewed_at: REVIEWED_AT,
        review_cleared: 0,
      },
    ]);
  });
});
