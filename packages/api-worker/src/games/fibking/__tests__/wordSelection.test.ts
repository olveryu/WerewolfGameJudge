/** FibKing question allocation: random, never repeated per account, replayed by identity. */

import type { FibSelectWordEffect } from '@game-judge/game-engine/games/fibking/public';
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { createRowCountingDb } from '../../../../test/rowCountingDb';
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
    type: 'fibking.word.select',
    payload: { roundId, avoidWords: [], participantUserIds: [USER_ID] },
  };
}

function createInput(
  effect = createEffect(),
  effectId = EFFECT_ID,
  db: D1Database = env.DB,
): SelectFibWordInput {
  return {
    db,
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
  await env.DB.prepare('DELETE FROM word_seen').run();
  await env.DB.prepare('DELETE FROM fib_words').run();
  await env.DB.prepare('DELETE FROM rooms').run();
  await env.DB.prepare("DELETE FROM users WHERE id = ? OR id = 'new-player' OR id LIKE 'budget-%'")
    .bind(USER_ID)
    .run();
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

function selectEffect(roundId: string, participantUserIds: string[]): FibSelectWordEffect {
  return { type: 'fibking.word.select', payload: { roundId, avoidWords: [], participantUserIds } };
}

async function selectWord(roundId: string, participantUserIds: string[]): Promise<string> {
  const selection = await getOrCreateFibWordSelection(
    createInput(selectEffect(roundId, participantUserIds), roundId),
  );
  return selection.word;
}

describe('getOrCreateFibWordSelection', () => {
  it('keeps played accounts past the old prefix through both migrations while new accounts can play approved old words', async () => {
    await env.DB.prepare("INSERT INTO users (id) VALUES ('new-player')").run();
    await insertPoolWord('old-approved', '射覆', 'literary', 1);
    await insertPoolWord('old-disabled', '却扇', 'literary', 2);
    await env.DB.prepare(
      "UPDATE fib_words SET status = 'disabled', disabled_at = '2026-08-01T00:00:00.000Z', status_reason = 'quality_review: rejected' WHERE id = 'old-disabled'",
    ).run();
    await env.DB.prepare('DELETE FROM fib_word_sequence').run();
    const findQueries = (name: string, pattern: RegExp): string[] => {
      const migration = env.TEST_MIGRATIONS.find((candidate) => candidate.name === name);
      if (migration === undefined) throw new Error(`Missing migration ${name}`);
      return migration.queries.filter((query) => pattern.test(query.trim()));
    };
    const watermarkQueries = findQueries(
      '0051_fib_word_progress.sql',
      /^INSERT INTO fib_word_(sequence|progress)\s/,
    );
    const seenQueries = findQueries(
      '0067_shared_word_draw.sql',
      /^INSERT INTO word_seen\s[\s\S]*FROM fib_word_progress/,
    );
    expect(watermarkQueries).toHaveLength(2);
    expect(seenQueries).toHaveLength(1);
    // Replay 0051 (exposures to watermark), then 0067 (watermark to seen record) on its output.
    await env.DB.prepare(
      "INSERT INTO fib_word_exposures (user_id, word, last_seen_at) VALUES (?, '残存旧词', '2026-08-01T00:00:00.000Z')",
    )
      .bind(USER_ID)
      .run();
    await env.DB.batch(watermarkQueries.map((query) => env.DB.prepare(query)));
    expect(
      await env.DB.prepare('SELECT word FROM fib_word_sequence ORDER BY id').all(),
    ).toMatchObject({ results: [{ word: '却扇' }, { word: '射覆' }, { word: '残存旧词' }] });
    expect(
      await env.DB.prepare(
        'SELECT user_id, sequence_number = (SELECT MAX(id) FROM fib_word_sequence) AS is_at_end FROM fib_word_progress',
      ).all(),
    ).toMatchObject({ results: [{ user_id: USER_ID, is_at_end: 1 }] });
    await env.DB.batch(seenQueries.map((query) => env.DB.prepare(query)));
    await insertPoolWord('new-word', '打尖', 'literary', 3);
    expect(await selectWord('played-round', [USER_ID])).toBe('打尖');
    await expect(selectWord('played-exhausted', [USER_ID])).rejects.toThrow(
      'Fib word inventory exhausted',
    );
    const newPlayerWords = [
      await selectWord('new-player-first', ['new-player']),
      await selectWord('new-player-second', ['new-player']),
    ];
    expect(newPlayerWords.sort()).toEqual(['射覆', '打尖'].sort());
  });

  it('draws only questions no participant has seen and marks them seen for everyone', async () => {
    await env.DB.prepare("INSERT INTO users (id) VALUES ('new-player')").run();
    await insertPoolWord('first', '射覆', 'literary', 1);
    await insertPoolWord('second', '却扇', 'literary', 2);
    await insertPoolWord('third', '打尖', 'literary', 3);
    const alone = await selectWord('alone', [USER_ID]);
    const together = await selectWord('together', [USER_ID, 'new-player']);
    expect(together).not.toBe(alone);
    // The newer account is not skipped past the question only the other one saw.
    const newPlayerWords = [
      await selectWord('new-player-first', ['new-player']),
      await selectWord('new-player-second', ['new-player']),
    ];
    expect(newPlayerWords).not.toContain(together);
    expect(newPlayerWords).toContain(alone);
    expect(new Set([together, ...newPlayerWords]).size).toBe(3);
    await expect(selectWord('new-player-exhausted', ['new-player'])).rejects.toThrow(
      'Fib word inventory exhausted',
    );
    const seen = await env.DB.prepare(
      "SELECT user_id, seen FROM word_seen WHERE pool = 'fibking' ORDER BY user_id",
    ).all<{ user_id: string; seen: string }>();
    expect(seen.results.map((row) => row.user_id)).toEqual(['new-player', USER_ID].sort());
    const seenCounts = Object.fromEntries(
      seen.results.map((row) => [row.user_id, row.seen.split(',').filter(Boolean).length]),
    );
    expect(seenCounts).toEqual({ [USER_ID]: 2, 'new-player': 3 });
  });

  it('never repeats a question for an account across many rounds', async () => {
    const words = ['射覆', '却扇', '打尖', '菡萏', '觊觎', '饕餮'];
    for (const [index, word] of words.entries()) {
      await insertPoolWord(`repeat-${index}`, word, 'literary', index);
    }
    const drawn: string[] = [];
    for (let round = 0; round < words.length; round += 1) {
      drawn.push(await selectWord(`repeat-round-${round}`, [USER_ID]));
    }
    expect([...drawn].sort()).toEqual([...words].sort());
    await expect(selectWord('repeat-exhausted', [USER_ID])).rejects.toThrow(
      'Fib word inventory exhausted',
    );
  });

  it('skips avoided words', async () => {
    await insertPoolWord('avoided', '射覆', 'literary', 1);
    await insertPoolWord('allowed', '却扇', 'literary', 2);
    const effect: FibSelectWordEffect = {
      type: 'fibking.word.select',
      payload: { roundId: 'avoid-round', avoidWords: ['射覆'], participantUserIds: [USER_ID] },
    };
    await expect(
      getOrCreateFibWordSelection(createInput(effect, 'avoid-effect')),
    ).resolves.toMatchObject({ wordId: 'allowed', word: '却扇' });
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

  it('selects an unseen published question', async () => {
    await insertPoolWord('category-word', '菡萏', 'literary', 1);

    await expect(getOrCreateFibWordSelection(createInput())).resolves.toMatchObject({
      wordId: 'category-word',
      word: '菡萏',
      source: 'gemini',
      selectionTier: 'any_unseen',
    });
  });

  it('marks the question seen without a usage effect and never consumes twice on replay', async () => {
    await insertPoolWord('seen-category-word', '菡萏', 'literary', 1);
    await insertPoolWord('unseen-other-word', '却扇', 'niche', 2);
    const first = await getOrCreateFibWordSelection(createInput());
    await expect(getOrCreateFibWordSelection(createInput())).resolves.toEqual(first);
    const second = await getOrCreateFibWordSelection(
      createInput(createEffect('second-round'), 'second-effect'),
    );
    expect(second.selectionTier).toBe('any_unseen');
    expect([first.wordId, second.wordId].sort()).toEqual([
      'seen-category-word',
      'unseen-other-word',
    ]);
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

  it('rejects a participant without an account', async () => {
    await insertPoolWord('ghost-word', '射覆', 'literary', 1);
    await expect(selectWord('ghost-round', [USER_ID, 'missing-account'])).rejects.toThrow(
      'requires a live room and participants',
    );
  });
});

describe('getOrCreateFibWordSelection row budget', () => {
  const PARTICIPANTS = Array.from({ length: 6 }, (_, index) => `budget-${index}`);

  /** Seed `size` distinct two-character questions (generated from CJK code points). */
  async function seedPool(size: number): Promise<{ first: number; last: number }> {
    await env.DB.prepare(
      `WITH RECURSIVE counter(position) AS (
         SELECT 1 UNION ALL SELECT position + 1 FROM counter WHERE position < ?)
       INSERT INTO fib_words (id, word, core_meaning, usage_note, category, source, status,
         selection_key, created_at, activated_at)
       SELECT 'budget-' || position,
         char(19968 + (position - 1) / 40) || char(20100 + (position - 1) % 40),
         '用于验证读行数的核心含义。',
         '用于验证读行数的使用说明。', 'literary', 'gemini', 'active', 0,
         '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z' FROM counter`,
    )
      .bind(size)
      .run();
    await env.DB.prepare(
      `INSERT INTO fib_word_sequence (word, published_at)
       SELECT word, '2026-09-01T00:00:00.000Z' FROM fib_words ORDER BY id`,
    ).run();
    const range = await env.DB.prepare(
      'SELECT MIN(id) AS first, MAX(id) AS last FROM fib_word_sequence',
    ).first<{ first: number; last: number }>();
    if (range === null) throw new Error('Budget pool was not seeded');
    return range;
  }

  async function measure(roundId: string): Promise<{ rowsRead: number; rowsWritten: number }> {
    const counting = createRowCountingDb(env.DB);
    await getOrCreateFibWordSelection(
      createInput(selectEffect(roundId, PARTICIPANTS), roundId, counting.db),
    );
    return { ...counting.counts };
  }

  beforeEach(async () => {
    await env.DB.prepare(
      `INSERT INTO users (id) VALUES ${PARTICIPANTS.map(() => '(?)').join(', ')}`,
    )
      .bind(...PARTICIPANTS)
      .run();
  });

  it('reads the same handful of rows for a small fresh pool and a large nearly exhausted one', async () => {
    // Each measurement follows a warm-up round, so every participant already
    // has a seen record: a first-ever draw reads fewer rows and would hide growth.
    await seedPool(30);
    await measure('budget-fresh-warm-up');
    const fresh = await measure('budget-fresh');

    await env.DB.batch(
      [
        'DELETE FROM fib_round_word_selections',
        'DELETE FROM fib_words',
        'DELETE FROM fib_word_sequence',
        'DELETE FROM word_seen',
      ].map((query) => env.DB.prepare(query)),
    );
    const range = await seedPool(600);
    // Everyone at the table has seen all but the last two questions.
    await env.DB.prepare(
      `INSERT INTO word_seen (user_id, pool, seen)
       SELECT id, 'fibking', ',' || ? || '-' || ? || ',' FROM users WHERE id LIKE 'budget-%'`,
    )
      .bind(String(range.first), String(range.last - 2))
      .run();
    await measure('budget-nearly-exhausted-warm-up');
    const nearlyExhausted = await measure('budget-nearly-exhausted');

    expect(nearlyExhausted).toEqual(fresh);
    // Independent of pool size and seen share: a few rows per participant plus a constant.
    expect(fresh.rowsRead).toBeLessThanOrEqual(8 * PARTICIPANTS.length + 16);
    expect(fresh.rowsWritten).toBeLessThanOrEqual(PARTICIPANTS.length + 4);
  });

  it('reads the same handful of rows when every unseen question is rejected and the draw ends exhausted', async () => {
    // Three unseen questions, all avoided: the draw looks up one candidate, then
    // two at once, then gives up. Multi-candidate lookups must not scan the pool.
    const measureExhausted = async (size: number, roundId: string) => {
      await env.DB.batch(
        [
          'DELETE FROM fib_round_word_selections',
          'DELETE FROM fib_words',
          'DELETE FROM fib_word_sequence',
          'DELETE FROM word_seen',
        ].map((query) => env.DB.prepare(query)),
      );
      const range = await seedPool(size);
      await env.DB.prepare(
        `INSERT INTO word_seen (user_id, pool, seen)
         SELECT id, 'fibking', ',' || ? || '-' || ? || ',' FROM users WHERE id LIKE 'budget-%'`,
      )
        .bind(String(range.first), String(range.last - 3))
        .run();
      const unseen = await env.DB.prepare(
        'SELECT word FROM fib_word_sequence ORDER BY id DESC LIMIT 3',
      ).all<{ word: string }>();
      const effect: FibSelectWordEffect = {
        type: 'fibking.word.select',
        payload: {
          roundId,
          avoidWords: unseen.results.map((row) => row.word),
          participantUserIds: PARTICIPANTS,
        },
      };
      const counting = createRowCountingDb(env.DB);
      await expect(
        getOrCreateFibWordSelection(createInput(effect, roundId, counting.db)),
      ).rejects.toThrow('Fib word inventory exhausted');
      return { ...counting.counts };
    };
    const small = await measureExhausted(30, 'budget-rejected-small');
    const large = await measureExhausted(600, 'budget-rejected-large');

    expect(large).toEqual(small);
    expect(small.rowsRead).toBeLessThanOrEqual(4 * PARTICIPANTS.length + 16);
    expect(small.rowsWritten).toBe(0);
  });
});
