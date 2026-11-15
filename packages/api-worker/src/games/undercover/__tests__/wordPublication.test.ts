/** Real D1 queue recovery and stable reservation. */
import { UNDERCOVER_CATEGORIES } from '@game-judge/game-engine/games/undercover/public';
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { createRowCountingDb } from '../../../../test/rowCountingDb';
import { reserveUndercoverWordPack } from '../wordPublication';

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
