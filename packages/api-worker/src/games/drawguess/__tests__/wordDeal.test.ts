/** DrawGuess word dealing against a real D1: active filtering, used-word exclusion, unseen-first candidates, seen recording. */

import { DRAWGUESS_WORD_CHOICE_COUNT } from '@game-judge/game-engine/games/drawguess/public';
import { env } from 'cloudflare:test';
import { beforeEach, expect, it } from 'vitest';

import { createRowCountingDb } from '../../../../test/rowCountingDb';
import { dealDrawGuessWords, recordDrawGuessWordSeen } from '../wordDeal';

const WORDS = [
  { id: 'w1', word: '大熊猫', pinyin_initials: 'd x m', category: '动物', difficulty: 'easy' },
  { id: 'w2', word: '火锅', pinyin_initials: 'h g', category: '食物', difficulty: 'easy' },
  { id: 'w3', word: '风筝', pinyin_initials: 'f z', category: '日用品', difficulty: 'easy' },
  { id: 'w4', word: '自行车', pinyin_initials: 'z x c', category: '日用品', difficulty: 'medium' },
  { id: 'w5', word: '西瓜', pinyin_initials: 'x g', category: '食物', difficulty: 'easy' },
  { id: 'w6', word: '雨伞', pinyin_initials: 'y s', category: '日用品', difficulty: 'easy' },
] as const;

async function seedWords() {
  for (const word of WORDS) {
    await env.DB.prepare(
      `INSERT INTO drawguess_words (id, word, pinyin_initials, category, difficulty, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'active', datetime('now'))`,
    )
      .bind(word.id, word.word, word.pinyin_initials, word.category, word.difficulty)
      .run();
  }
}

const PLAYER = 'drawguess-player-1';
const OTHER_PLAYER = 'drawguess-player-2';

beforeEach(async () => {
  await env.DB.exec('DELETE FROM drawguess_words');
  await env.DB.prepare("DELETE FROM users WHERE id LIKE 'drawguess-player-%'").run();
  await env.DB.prepare('INSERT INTO users (id) VALUES (?), (?)').bind(PLAYER, OTHER_PLAYER).run();
});

async function seenRecords(): Promise<Record<string, string>> {
  const rows = await env.DB.prepare(
    "SELECT user_id, seen FROM word_seen WHERE pool = 'drawguess'",
  ).all<{ user_id: string; seen: string }>();
  return Object.fromEntries(rows.results.map((row) => [row.user_id, row.seen]));
}

it('throws when the word inventory is empty', async () => {
  await expect(
    dealDrawGuessWords({ db: env.DB, usedWords: [], participantUserIds: [PLAYER] }),
  ).rejects.toThrow('drawguess_words 词库无可用题目');
});

it('deals active words and excludes used ones', async () => {
  await seedWords();
  // Disable one word; it must never be dealt.
  await env.DB.prepare(
    "UPDATE drawguess_words SET status = 'disabled', disabled_at = datetime('now') WHERE id = 'w4'",
  ).run();
  const choices = await dealDrawGuessWords({
    db: env.DB,
    usedWords: ['大熊猫'],
    participantUserIds: [PLAYER],
  });
  expect(choices).toHaveLength(DRAWGUESS_WORD_CHOICE_COUNT);
  const words = choices.map((choice) => choice.word);
  expect(words).not.toContain('大熊猫');
  expect(words).not.toContain('自行车');
  for (const choice of choices) {
    expect(choice.pinyinInitials.length).toBeGreaterThan(0);
  }
});

it('deals without recording anything as seen', async () => {
  await seedWords();
  await dealDrawGuessWords({ db: env.DB, usedWords: [], participantUserIds: [PLAYER] });
  expect(await seenRecords()).toEqual({});
});

it('offers words nobody at the table has played before any played one', async () => {
  await seedWords();
  const played = ['大熊猫', '火锅', '风筝', '自行车'];
  for (const word of played) {
    // Only one of the two participants played each word; that is enough to rank it last.
    await recordDrawGuessWordSeen({ db: env.DB, word, participantUserIds: [OTHER_PLAYER] });
  }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const words = (
      await dealDrawGuessWords({
        db: env.DB,
        usedWords: [],
        participantUserIds: [PLAYER, OTHER_PLAYER],
      })
    ).map((choice) => choice.word);
    expect(words).toHaveLength(DRAWGUESS_WORD_CHOICE_COUNT);
    expect(words.slice(0, 2).sort()).toEqual(['西瓜', '雨伞'].sort());
    expect(played).toContain(words[2]);
  }
});

it('keeps this game used words out even when filling with played words', async () => {
  await seedWords();
  for (const word of WORDS.map((entry) => entry.word)) {
    await recordDrawGuessWordSeen({ db: env.DB, word, participantUserIds: [PLAYER] });
  }
  const usedWords = ['大熊猫', '火锅', '风筝', '自行车'];
  const words = (
    await dealDrawGuessWords({ db: env.DB, usedWords, participantUserIds: [PLAYER] })
  ).map((choice) => choice.word);
  expect(words.sort()).toEqual(['西瓜', '雨伞'].sort());
});

it('records the played word once per account and ignores a word that left the bank', async () => {
  await seedWords();
  const participantUserIds = [PLAYER, OTHER_PLAYER];
  await recordDrawGuessWordSeen({ db: env.DB, word: '火锅', participantUserIds });
  await recordDrawGuessWordSeen({ db: env.DB, word: '火锅', participantUserIds });
  await recordDrawGuessWordSeen({ db: env.DB, word: '不在词库', participantUserIds });
  const ordinal = await env.DB.prepare(
    "SELECT draw_ordinal FROM drawguess_words WHERE word = '火锅'",
  ).first<number>('draw_ordinal');
  expect(await seenRecords()).toEqual({
    [PLAYER]: `,${ordinal},`,
    [OTHER_PLAYER]: `,${ordinal},`,
  });
});

it('reads the same handful of rows for a small fresh pool and a large mostly played one', async () => {
  const participants = Array.from({ length: 6 }, (_, index) => `drawguess-player-budget-${index}`);
  await env.DB.prepare(`INSERT INTO users (id) VALUES ${participants.map(() => '(?)').join(', ')}`)
    .bind(...participants)
    .run();
  const seedPool = async (size: number): Promise<void> => {
    await env.DB.exec('DELETE FROM drawguess_words');
    await env.DB.prepare(
      `WITH RECURSIVE counter(position) AS (
         SELECT 1 UNION ALL SELECT position + 1 FROM counter WHERE position < ?)
       INSERT INTO drawguess_words (id, word, pinyin_initials, category, difficulty, status, created_at)
       SELECT 'budget-' || position, '题' || position, 't', '动物', 'easy', 'active', datetime('now')
       FROM counter`,
    )
      .bind(size)
      .run();
  };
  const markSeen = async (unseenCount: number): Promise<void> => {
    await env.DB.prepare("DELETE FROM word_seen WHERE pool = 'drawguess'").run();
    await env.DB.prepare(
      `INSERT INTO word_seen (user_id, pool, seen)
       SELECT account.id, 'drawguess',
         ',' || (SELECT MIN(draw_ordinal) FROM drawguess_words) || '-'
             || (SELECT MAX(draw_ordinal) - CAST(? AS INTEGER) FROM drawguess_words) || ','
       FROM users AS account WHERE account.id LIKE 'drawguess-player-budget-%'`,
    )
      .bind(unseenCount)
      .run();
  };
  const measure = async () => {
    const counting = createRowCountingDb(env.DB);
    await dealDrawGuessWords({ db: counting.db, usedWords: [], participantUserIds: participants });
    return { ...counting.counts };
  };
  await seedPool(30);
  await markSeen(20);
  const fresh = await measure();
  await seedPool(600);
  await markSeen(5);
  const mostlyPlayed = await measure();

  expect(mostlyPlayed).toEqual(fresh);
  // One index row, a seen row per participant, and the dealt words; nothing is written.
  expect(fresh.rowsRead).toBeLessThanOrEqual(
    2 * participants.length + 2 * DRAWGUESS_WORD_CHOICE_COUNT + 4,
  );
  expect(fresh.rowsWritten).toBe(0);
});
