/** FibKing D1 pool selection tiers and replay identity contracts. */

import type { FibSelectWordEffect } from '@game-judge/game-engine/games/fibking/public';
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { FIB_WORD_CATEGORIES, type FibWordCategory } from '../wordProviders/types';
import {
  getOrCreateFibWordSelection,
  selectFibWordCategory,
  type SelectFibWordInput,
} from '../wordSelection';

const ROOM_ID = 'selection-room';
const ROOM_CODE = '7654';
const CREATION_ID = 'selection-creation';
const USER_ID = 'selection-user';
const ROUND_ID = 'fib-round:selection-test';
const EFFECT_ID = 'selection-effect';

function createEffect(roundId = ROUND_ID): FibSelectWordEffect {
  return { type: 'fib.word.select', payload: { roundId, avoidWords: [] } };
}

function createInput(effect = createEffect(), effectId = EFFECT_ID): SelectFibWordInput {
  return {
    db: env.DB,
    roomIdentity: { roomId: ROOM_ID, roomCode: ROOM_CODE, creationId: CREATION_ID },
    effectId,
    effect,
    participantUserIds: [USER_ID],
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
}

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM fib_word_usages').run();
  await env.DB.prepare('DELETE FROM fib_round_word_selections').run();
  await env.DB.prepare('DELETE FROM fib_word_exposures').run();
  await env.DB.prepare('DELETE FROM fib_words').run();
  await env.DB.prepare('DELETE FROM rooms').run();
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(USER_ID).run();
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
  it('selects an unseen word from the deterministic category first', async () => {
    const category = await selectFibWordCategory(ROUND_ID);
    await insertPoolWord('category-word', '菡萏', category, 1);

    await expect(getOrCreateFibWordSelection(createInput())).resolves.toMatchObject({
      wordId: 'category-word',
      word: '菡萏',
      source: 'gemini',
      selectionTier: 'category_unseen',
    });
  });

  it('falls back to any unseen category before reusing an exposed category word', async () => {
    const category = await selectFibWordCategory(ROUND_ID);
    const otherCategory = FIB_WORD_CATEGORIES.find((candidate) => candidate !== category);
    if (otherCategory === undefined) throw new Error('Expected another Fib word category');
    await insertPoolWord('seen-category-word', '菡萏', category, 1);
    await insertPoolWord('unseen-other-word', '却扇', otherCategory, 2);
    await env.DB.prepare(
      `INSERT INTO fib_word_exposures (user_id, word, last_seen_at)
       VALUES (?, '菡萏', '2026-08-20T00:00:00.000Z')`,
    )
      .bind(USER_ID)
      .run();

    await expect(getOrCreateFibWordSelection(createInput())).resolves.toMatchObject({
      wordId: 'unseen-other-word',
      word: '却扇',
      selectionTier: 'any_unseen',
    });
  });

  it('replays the persisted snapshot after its pool word is disabled', async () => {
    const category = await selectFibWordCategory(ROUND_ID);
    await insertPoolWord('replay-word', '射覆', category, 1);
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
    await getOrCreateFibWordSelection(createInput());

    await expect(
      getOrCreateFibWordSelection(createInput(createEffect('fib-round:conflict'))),
    ).rejects.toThrow('identity conflict');
  });

  it('uses the deterministic local bank only when the active pool is empty', async () => {
    await expect(getOrCreateFibWordSelection(createInput())).resolves.toMatchObject({
      wordId: null,
      source: 'local',
      selectionTier: 'local_fallback',
    });
  });
});
