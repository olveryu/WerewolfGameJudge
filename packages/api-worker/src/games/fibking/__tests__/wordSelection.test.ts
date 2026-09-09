/** FibKing D1 pool selection tiers and replay identity contracts. */

import type { FibSelectWordEffect } from '@game-judge/game-engine/games/fibking/public';
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { type FibWordCategory } from '../wordProviders/types';
import { getOrCreateFibWordSelection, type SelectFibWordInput } from '../wordSelection';

const ROOM_ID = 'selection-room';
const ROOM_CODE = '7654';
const CREATION_ID = 'selection-creation';
const USER_ID = 'selection-user';
const ROUND_ID = 'fib-round:selection-test';
const EFFECT_ID = 'selection-effect';

function createEffect(roundId = ROUND_ID): FibSelectWordEffect {
  return {
    type: 'fib.word.select',
    payload: { roundId, avoidWords: [], participantUserIds: [USER_ID] },
  };
}

function createInput(effect = createEffect(), effectId = EFFECT_ID): SelectFibWordInput {
  return {
    db: env.DB,
    roomIdentity: { roomId: ROOM_ID, roomCode: ROOM_CODE, creationId: CREATION_ID },
    effectId,
    effect,
  };
}

async function insertPoolWord(
  id: string,
  word: string,
  category: FibWordCategory,
  selectionKey: number,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO fib_words (
       id, word, core_meaning, usage_note, category, source, status,
       selection_key, created_at, activated_at
     ) VALUES (?, ?, '这是用于验证题库选择行为的完整核心含义。',
       '这是用于验证题库选择行为的完整使用说明。', ?, 'gemini',
       'active', ?, '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z')`,
  )
    .bind(id, word, category, selectionKey)
    .run();
  await env.DB.prepare(
    `INSERT INTO fib_word_sequence (word, published_at) VALUES (?, '2026-09-01T00:00:00.000Z')`,
  )
    .bind(word)
    .run();
}

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM fib_word_usages').run();
  await env.DB.prepare('DELETE FROM fib_round_word_selections').run();
  await env.DB.prepare('DELETE FROM fib_word_exposures').run();
  await env.DB.prepare('DELETE FROM fib_word_sequence').run();
  await env.DB.prepare('DELETE FROM fib_word_progress').run();
  await env.DB.prepare('DELETE FROM fib_words').run();
  await env.DB.prepare('DELETE FROM rooms').run();
  await env.DB.prepare("DELETE FROM users WHERE id IN (?, 'new-player')").bind(USER_ID).run();
  await env.DB.prepare(
    `INSERT INTO users (id, is_anonymous, created_at, updated_at)
     VALUES (?, 1, '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z')`,
  )
    .bind(USER_ID)
    .run();
  await env.DB.prepare(
    `INSERT INTO rooms (
       id, code, game_type, host_user_id, creation_id, config_json, status,
       created_at, updated_at, games_started
     ) VALUES (?, ?, 'fibking', ?, ?, '{"numberOfPlayers":4}', 'active',
       '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z', 0)`,
  )
    .bind(ROOM_ID, ROOM_CODE, USER_ID, CREATION_ID)
    .run();
});

describe('getOrCreateFibWordSelection', () => {
  it('migrates played accounts past the old prefix while new accounts can play approved old words', async () => {
    await env.DB.prepare("INSERT INTO users (id) VALUES ('new-player')").run();
    await insertPoolWord('old-approved', '射覆', 'literary', 1);
    await insertPoolWord('old-disabled', '却扇', 'literary', 2);
    await env.DB.prepare(
      "UPDATE fib_words SET status = 'disabled', disabled_at = '2026-08-01T00:00:00.000Z', status_reason = 'quality_review: rejected' WHERE id = 'old-disabled'",
    ).run();
    await env.DB.prepare(
      "INSERT INTO fib_word_exposures (user_id, word, last_seen_at) VALUES (?, '残存旧词', '2026-08-01T00:00:00.000Z')",
    )
      .bind(USER_ID)
      .run();
    await env.DB.prepare('DELETE FROM fib_word_sequence').run();
    const migration = env.TEST_MIGRATIONS.find(({ name }) => name === '0051_fib_word_progress.sql');
    if (migration === undefined) throw new Error('Missing word progress migration');
    const queries = migration.queries.filter((query) =>
      /^INSERT INTO fib_word_(sequence|progress)\s/.test(query.trim()),
    );
    expect(queries).toHaveLength(2);
    await env.DB.batch(queries.map((query) => env.DB.prepare(query)));
    expect(
      await env.DB.prepare('SELECT word FROM fib_word_sequence ORDER BY id').all(),
    ).toMatchObject({ results: [{ word: '却扇' }, { word: '射覆' }, { word: '残存旧词' }] });
    expect(
      await env.DB.prepare(
        'SELECT user_id, sequence_number = (SELECT MAX(id) FROM fib_word_sequence) AS is_at_end FROM fib_word_progress',
      ).all(),
    ).toMatchObject({ results: [{ user_id: USER_ID, is_at_end: 1 }] });
    await insertPoolWord('new-word', '打尖', 'literary', 3);
    expect((await getOrCreateFibWordSelection(createInput())).word).toBe('打尖');
    const effect: FibSelectWordEffect = {
      type: 'fib.word.select',
      payload: { roundId: 'new-player-round', avoidWords: [], participantUserIds: ['new-player'] },
    };
    expect((await getOrCreateFibWordSelection(createInput(effect, 'new-player-effect'))).word).toBe(
      '射覆',
    );
  });

  it('starts after the most advanced participant and advances every account', async () => {
    await env.DB.prepare("INSERT INTO users (id) VALUES ('new-player')").run();
    await insertPoolWord('first', '射覆', 'literary', 1);
    await insertPoolWord('second', '却扇', 'literary', 2);
    await insertPoolWord('third', '打尖', 'literary', 3);
    await getOrCreateFibWordSelection(createInput());
    const together: FibSelectWordEffect = {
      type: 'fib.word.select',
      payload: { roundId: 'together', avoidWords: [], participantUserIds: [USER_ID, 'new-player'] },
    };
    expect((await getOrCreateFibWordSelection(createInput(together, 'together'))).word).toBe(
      '却扇',
    );
    const alone: FibSelectWordEffect = {
      type: 'fib.word.select',
      payload: { roundId: 'alone', avoidWords: [], participantUserIds: ['new-player'] },
    };
    expect((await getOrCreateFibWordSelection(createInput(alone, 'alone'))).word).toBe('打尖');
    const exhausted: FibSelectWordEffect = {
      ...alone,
      payload: { ...alone.payload, roundId: 'exhausted' },
    };
    await expect(getOrCreateFibWordSelection(createInput(exhausted, 'exhausted'))).rejects.toThrow(
      'Fib word inventory exhausted',
    );
  });

  it('serializes simultaneous allocations for the same participant', async () => {
    await insertPoolWord('concurrent-first', '射覆', 'literary', 1);
    await insertPoolWord('concurrent-second', '却扇', 'literary', 2);
    const selections = await Promise.all([
      getOrCreateFibWordSelection(createInput(createEffect('concurrent-one'), 'concurrent-one')),
      getOrCreateFibWordSelection(createInput(createEffect('concurrent-two'), 'concurrent-two')),
    ]);
    expect(new Set(selections.map((selection) => selection.word)).size).toBe(2);
  });
  it('selects the first published question', async () => {
    await insertPoolWord('category-word', '菡萏', 'literary', 1);

    await expect(getOrCreateFibWordSelection(createInput())).resolves.toMatchObject({
      wordId: 'category-word',
      word: '菡萏',
      source: 'gemini',
      selectionTier: 'any_unseen',
    });
  });

  it('advances without a usage effect and never consumes twice on replay', async () => {
    await insertPoolWord('seen-category-word', '菡萏', 'literary', 1);
    await insertPoolWord('unseen-other-word', '却扇', 'niche', 2);
    const first = await getOrCreateFibWordSelection(createInput());
    await expect(getOrCreateFibWordSelection(createInput())).resolves.toEqual(first);
    await expect(
      getOrCreateFibWordSelection(createInput(createEffect('second-round'), 'second-effect')),
    ).resolves.toMatchObject({
      wordId: 'unseen-other-word',
      word: '却扇',
      selectionTier: 'any_unseen',
    });
  });

  it('replays the persisted snapshot after its pool word is disabled', async () => {
    await insertPoolWord('replay-word', '射覆', 'literary', 1);
    const first = await getOrCreateFibWordSelection(createInput());
    await env.DB.prepare(
      `UPDATE fib_words
       SET status = 'disabled', disabled_at = '2026-08-21T00:00:00.000Z',
           status_reason = 'test'
       WHERE id = 'replay-word'`,
    ).run();

    await expect(getOrCreateFibWordSelection(createInput())).resolves.toEqual(first);
  });

  it('rejects effect identity reuse for a different round', async () => {
    await insertPoolWord('identity-word', '射覆', 'literary', 1);
    await getOrCreateFibWordSelection(createInput());

    await expect(
      getOrCreateFibWordSelection(createInput(createEffect('fib-round:conflict'))),
    ).rejects.toThrow('identity conflict');
  });

  it('reports exhaustion instead of silently serving the local bank', async () => {
    await expect(getOrCreateFibWordSelection(createInput())).rejects.toThrow(
      'Fib word inventory exhausted',
    );
  });
});
