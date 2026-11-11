/** Real D1 allocation contracts for Undercover snapshots and per-account deduplication. */

import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { createRowCountingDb } from '../../../../test/rowCountingDb';
import { undercoverInventoryRoutes } from '../routes';
import {
  getOrCreateUndercoverWordSelection,
  type SelectUndercoverWordInput,
  UndercoverWordInventoryExhaustedError,
} from '../wordSelection';

const PLAYER = 'undercover-player-1';
const OTHER_PLAYER = 'undercover-player-2';

function input(
  roundId = 'round-1',
  shouldAllowRepeated = false,
  participantUserIds: readonly string[] = [PLAYER],
  db: D1Database = env.DB,
): SelectUndercoverWordInput {
  return {
    db,
    participantUserIds,
    roomIdentity: {
      roomId: 'undercover-room',
      roomCode: '9876',
      creationId: 'undercover-creation',
    },
    effect: {
      type: 'undercover.word.select',
      payload: { roundId, category: 'food', avoidWordPairIds: [], shouldAllowRepeated },
    },
  };
}

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM rooms WHERE id = 'undercover-room'").run();
  await env.DB.prepare('DELETE FROM undercover_word_pairs').run();
  await env.DB.prepare("DELETE FROM users WHERE id LIKE 'undercover-player-%'").run();
  await env.DB.prepare('INSERT INTO users (id) VALUES (?), (?)').bind(PLAYER, OTHER_PLAYER).run();
  await env.DB.prepare(
    `INSERT INTO rooms (id, code, game_type, host_user_id, creation_id, config_json, status, created_at, updated_at)
    VALUES ('undercover-room', '9876', 'undercover', 'host', 'undercover-creation', '{}', 'active', '2026-09-21', '2026-09-21')`,
  ).run();
  await env.DB.prepare(
    `INSERT INTO undercover_word_pairs (id, word_a, word_b, category, status, created_at, reviewed_at, review_json)
    VALUES ('pair-1', 'Milk', 'Soy milk', 'food', 'active', '2026-09-21', '2026-09-21', '{}')`,
  ).run();
});

describe('Undercover word selection', () => {
  it('exposes only categories with active inventory and never exposes pairs', async () => {
    const response = await undercoverInventoryRoutes.request('/categories', {}, env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ availableCategories: ['food'] });
    await env.DB.prepare("UPDATE undercover_word_pairs SET status = 'disabled'").run();
    const empty = await undercoverInventoryRoutes.request('/categories', {}, env);
    expect(await empty.json()).toEqual({ availableCategories: [] });
  });

  it('replays a round snapshot even after its source changes and retires', async () => {
    const first = await getOrCreateUndercoverWordSelection(input());
    await env.DB.prepare(
      "UPDATE undercover_word_pairs SET status = 'disabled', word_b = 'Tea' WHERE id = 'pair-1'",
    ).run();
    expect(await getOrCreateUndercoverWordSelection(input())).toEqual(first);
    await expect(getOrCreateUndercoverWordSelection(input('round-2'))).rejects.toThrow(
      'inventory exhausted',
    );
  });

  it('deduplicates allocated pairs before engine completion and only repeats explicitly', async () => {
    const first = await getOrCreateUndercoverWordSelection(input());
    await expect(getOrCreateUndercoverWordSelection(input('round-2'))).rejects.toMatchObject({
      failureCode: 'inventoryExhausted',
    });
    expect(await getOrCreateUndercoverWordSelection(input('round-3', true))).toEqual(first);
  });

  it('keeps concurrent replay at one allocation and rejects changed request identity', async () => {
    const selections = await Promise.all([
      getOrCreateUndercoverWordSelection(input()),
      getOrCreateUndercoverWordSelection(input()),
    ]);
    expect(selections[0]).toEqual(selections[1]);
    expect(
      await env.DB.prepare(
        'SELECT COUNT(*) AS count FROM undercover_round_word_selections',
      ).first(),
    ).toEqual({ count: 1 });
    await expect(getOrCreateUndercoverWordSelection(input('round-1', true))).rejects.toThrow(
      'identity conflict',
    );
  });

  it('respects category and explicit avoided pairs', async () => {
    const request = input();
    await expect(
      getOrCreateUndercoverWordSelection({
        ...request,
        effect: { ...request.effect, payload: { ...request.effect.payload, category: 'nature' } },
      }),
    ).rejects.toMatchObject({ failureCode: 'inventoryEmpty' });
    await expect(
      getOrCreateUndercoverWordSelection({
        ...request,
        effect: {
          ...request.effect,
          payload: { ...request.effect.payload, avoidWordPairIds: ['pair-1'] },
        },
      }),
    ).rejects.toThrow('inventory exhausted');
  });

  it('never deals a pair a participant has seen, whichever room they saw it in', async () => {
    await env.DB.prepare(
      `INSERT INTO undercover_word_pairs (id, word_a, word_b, category, status, created_at, reviewed_at, review_json)
      VALUES ('pair-2', 'Coffee', 'Tea', 'food', 'active', '2026-09-21', '2026-09-21', '{}')`,
    ).run();
    const alone = await getOrCreateUndercoverWordSelection(input('round-1', false, [PLAYER]));
    const together = await getOrCreateUndercoverWordSelection(
      input('round-2', false, [PLAYER, OTHER_PLAYER]),
    );
    expect(together.id).not.toBe(alone.id);
    // The other account never saw the first pair, so it is still theirs to play.
    const other = await getOrCreateUndercoverWordSelection(input('round-3', false, [OTHER_PLAYER]));
    expect(other.id).toBe(alone.id);
    await expect(
      getOrCreateUndercoverWordSelection(input('round-4', false, [OTHER_PLAYER])),
    ).rejects.toMatchObject({ failureCode: 'inventoryExhausted' });
  });

  it('draws across every category for the all category', async () => {
    await env.DB.prepare(
      `INSERT INTO undercover_word_pairs (id, word_a, word_b, category, status, created_at, reviewed_at, review_json)
      VALUES ('pair-travel', 'Bus', 'Train', 'travel', 'active', '2026-09-21', '2026-09-21', '{}')`,
    ).run();
    const request = input();
    const drawn = new Set<string>();
    for (const roundId of ['all-1', 'all-2']) {
      const pair = await getOrCreateUndercoverWordSelection({
        ...request,
        effect: {
          ...request.effect,
          payload: { ...request.effect.payload, roundId, category: 'all' },
        },
      });
      drawn.add(pair.id);
    }
    expect([...drawn].sort()).toEqual(['pair-1', 'pair-travel']);
  });
});

describe('Undercover word selection row budget', () => {
  const PARTICIPANTS = Array.from({ length: 6 }, (_, index) => `undercover-player-budget-${index}`);

  beforeEach(async () => {
    await env.DB.prepare(
      `INSERT INTO users (id) VALUES ${PARTICIPANTS.map(() => '(?)').join(', ')}`,
    )
      .bind(...PARTICIPANTS)
      .run();
  });

  /** Replace the pool with `size` food pairs whose ids are `budget-1` … `budget-<size>`. */
  async function seedPairs(size: number): Promise<void> {
    // Selections reference their pair (ON DELETE RESTRICT), so they go first.
    await env.DB.prepare('DELETE FROM undercover_round_word_selections').run();
    await env.DB.prepare('DELETE FROM undercover_word_pairs').run();
    await env.DB.prepare(
      `WITH RECURSIVE counter(position) AS (
         SELECT 1 UNION ALL SELECT position + 1 FROM counter WHERE position < ?)
       INSERT INTO undercover_word_pairs (id, word_a, word_b, category, status, created_at, reviewed_at, review_json)
       SELECT 'budget-' || position, 'A' || position, 'B' || position, 'food', 'active',
         '2026-09-21', '2026-09-21', '{}' FROM counter`,
    )
      .bind(size)
      .run();
  }

  /** Give every participant a seen record covering all but the newest `unseenCount` pairs. */
  async function markAllSeenExceptNewest(unseenCount: number): Promise<void> {
    await env.DB.prepare('DELETE FROM word_seen').run();
    await env.DB.prepare(
      `INSERT INTO word_seen (user_id, pool, seen)
       SELECT account.id, 'undercover',
         ',' || (SELECT MIN(draw_ordinal) FROM undercover_word_pairs) || '-'
             || (SELECT MAX(draw_ordinal) - CAST(? AS INTEGER) FROM undercover_word_pairs) || ','
       FROM users AS account WHERE account.id LIKE 'undercover-player-budget-%'`,
    )
      .bind(unseenCount)
      .run();
  }

  async function measure(
    roundId: string,
    avoidWordPairIds: readonly string[] = [],
  ): Promise<{ rowsRead: number; rowsWritten: number; failureCode: string | null }> {
    const counting = createRowCountingDb(env.DB);
    const request = input(roundId, false, PARTICIPANTS, counting.db);
    let failureCode: string | null = null;
    try {
      await getOrCreateUndercoverWordSelection({
        ...request,
        effect: {
          ...request.effect,
          payload: { ...request.effect.payload, avoidWordPairIds: [...avoidWordPairIds] },
        },
      });
    } catch (error) {
      if (!(error instanceof UndercoverWordInventoryExhaustedError)) throw error;
      failureCode = error.failureCode;
    }
    return { ...counting.counts, failureCode };
  }

  it('reads the same handful of rows for a small fresh pool and a large nearly exhausted one', async () => {
    // Each measurement follows a warm-up round, so every participant already has a seen record.
    await seedPairs(30);
    await measure('budget-fresh-warm-up');
    const fresh = await measure('budget-fresh');

    await seedPairs(600);
    await markAllSeenExceptNewest(2);
    await measure('budget-nearly-exhausted-warm-up');
    const nearlyExhausted = await measure('budget-nearly-exhausted');

    expect(fresh.failureCode).toBeNull();
    expect(nearlyExhausted).toEqual(fresh);
    // Independent of pool size and seen share: a few rows per participant plus a constant.
    expect(fresh.rowsRead).toBeLessThanOrEqual(8 * PARTICIPANTS.length + 16);
    expect(fresh.rowsWritten).toBeLessThanOrEqual(PARTICIPANTS.length + 4);
  });

  it('reads the same handful of rows when every unseen pair is rejected and the draw ends exhausted', async () => {
    // Three unseen pairs, all avoided: the draw looks up one candidate, then two
    // at once, then gives up. Multi-candidate lookups must not scan the pool.
    const measureExhausted = async (size: number) => {
      await seedPairs(size);
      await markAllSeenExceptNewest(3);
      const avoided = [size - 2, size - 1, size].map((position) => `budget-${position}`);
      return measure(`budget-rejected-${size}`, avoided);
    };
    const small = await measureExhausted(30);
    const large = await measureExhausted(600);

    expect(small.failureCode).toBe('inventoryExhausted');
    expect(large).toEqual(small);
    expect(small.rowsRead).toBeLessThanOrEqual(4 * PARTICIPANTS.length + 16);
    expect(small.rowsWritten).toBe(0);
  });
});
