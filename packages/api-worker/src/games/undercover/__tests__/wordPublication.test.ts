/** Real D1 queue recovery and stable reservation. */
import { UNDERCOVER_CATEGORIES } from '@game-judge/game-engine/games/undercover/public';
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { createRowCountingDb } from '../../../../test/rowCountingDb';
import { reserveUndercoverWordPack } from '../wordPublication';

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM undercover_round_word_selections'),
    env.DB.prepare('DELETE FROM undercover_word_packs'),
    env.DB.prepare('DELETE FROM undercover_word_pairs'),
    // Delete dependents first: events reference items/actions, control
    // events and credentials reference agents.
    env.DB.prepare('DELETE FROM word_submission_events'),
    env.DB.prepare('DELETE FROM word_submission_actions'),
    env.DB.prepare('DELETE FROM word_submission_control_events'),
    env.DB.prepare('DELETE FROM word_submission_credentials'),
    env.DB.prepare('DELETE FROM word_submission_items'),
    env.DB.prepare('DELETE FROM word_submission_batches'),
    env.DB.prepare('DELETE FROM word_submission_agents'),
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
    expect(
      await reserveUndercoverWordPack(measured.db, '2026-09-01', 'bounded', 'food'),
    ).not.toBeNull();
    expect(measured.counts.rowsRead).toBeLessThan(400);
  });

  it('stores the explicitly selected category for concurrent reservations', async () => {
    const categories = UNDERCOVER_CATEGORIES.slice(0, 10);
    const packs = await Promise.all(
      categories.map((category, index) =>
        reserveUndercoverWordPack(env.DB, '2026-09-01', `parallel-${index}`, category),
      ),
    );
    expect(packs.map((pack) => pack?.category)).toEqual(categories);
  });

  it('does not replace the selected category based on stock or recent-pack cooldown', async () => {
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

    const pack = await reserveUndercoverWordPack(env.DB, '2026-09-02', 'least-stocked', 'food');
    expect(pack?.category).toBe('food');
  });

  it('keeps each run on its manually selected category even when another is queued', async () => {
    await env.DB.batch(
      UNDERCOVER_CATEGORIES.map((category) =>
        env.DB.prepare(
          `INSERT INTO undercover_word_pairs
            (id, word_a, word_b, category, status, created_at, reviewed_at, review_json)
           VALUES (?, ?, ?, ?, 'active', '2026-09-01', '2026-09-01', '{}')`,
        ).bind(`existing-${category}`, `${category}-a`, `${category}-b`, category),
      ),
    );
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO word_submission_agents (id, name, description, games_json, status, daily_quota, pending_quota, created_at)
         VALUES ('queue-agent', 'Muse', '', '["undercover"]', 'active', 1000, 1000, '2026-09-01T00:00:00.000Z')`,
      ),
      env.DB.prepare(
        `INSERT INTO word_submission_batches (id, agent_id, game, idempotency_key, request_hash, created_at)
         VALUES ('queue-batch', 'queue-agent', 'undercover', 'queue-key', 'queue-hash', '2026-09-01T00:00:00.000Z')`,
      ),
      env.DB.prepare(
        `INSERT INTO word_submission_items (id, batch_id, game, client_item_id, identity, content_hash,
           title, category, material_json, status, duplicate_of, revision)
         VALUES ('20000000-0000-4000-8000-000000000001', 'queue-batch', 'undercover', 'queue-item', '果汁/汽水',
           'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', '果汁 / 汽水', 'food',
           '{"wordA":"果汁","wordB":"汽水","category":"food","commonTraits":["饮料"],"differences":["气泡"],"potentialIssues":[]}',
           'pending', NULL, 0)`,
      ),
    ]);
    // One trigger runs one pack, and every run applies the same rule:
    // least stock first, then most queued submissions. There is no batch
    // index to alternate a "review" batch against a "replenish" batch.
    const secondCategory = UNDERCOVER_CATEGORIES.find((category) => category !== 'food');
    if (secondCategory === undefined) throw new Error('Expected another Undercover category');
    const first = await reserveUndercoverWordPack(env.DB, '2026-09-01', 'first', 'food');
    const second = await reserveUndercoverWordPack(env.DB, '2026-09-01', 'second', secondCategory);
    expect(first?.category).toBe('food');
    expect(second?.category).toBe(secondCategory);
    expect(first?.id).toBe('2026-09-01-first');
    expect(second?.id).toBe('2026-09-01-second');
  });
});

describe('Undercover run-id reservation', () => {
  it('gives each run its own pack id from the run id and refuses a replay', async () => {
    const first = await reserveUndercoverWordPack(env.DB, '2026-09-01', 'r1', 'food');
    if (first === null) throw new Error('Expected reservation');
    expect(first.id).toBe('2026-09-01-r1');
    const second = await reserveUndercoverWordPack(env.DB, '2026-09-01', 'r2', 'food');
    expect(second?.id).toBe('2026-09-01-r2');
    // The same run id replays the same pack id, which is already taken.
    await expect(reserveUndercoverWordPack(env.DB, '2026-09-01', 'r1', 'food')).resolves.toBeNull();
  });
});
