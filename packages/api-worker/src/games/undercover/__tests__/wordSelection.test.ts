/** Real D1 allocation contracts for Undercover snapshots and room-level deduplication. */

import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { undercoverInventoryRoutes } from '../routes';
import {
  getOrCreateUndercoverWordSelection,
  type SelectUndercoverWordInput,
} from '../wordSelection';

function input(roundId = 'round-1', shouldAllowRepeated = false): SelectUndercoverWordInput {
  return {
    db: env.DB,
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
});
