/** DrawGuess word dealing against a real D1: empty inventory, active filtering, used-word exclusion. */

import { DRAWGUESS_WORD_CHOICE_COUNT } from '@game-judge/game-engine/games/drawguess/public';
import { env } from 'cloudflare:test';
import { beforeEach, expect, it } from 'vitest';

import { dealDrawGuessWords } from '../wordDeal';

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

beforeEach(async () => {
  await env.DB.exec('DELETE FROM drawguess_words');
});

it('throws when the word inventory is empty', async () => {
  await expect(dealDrawGuessWords({ db: env.DB, usedWords: [] })).rejects.toThrow(
    'drawguess_words 词库无可用题目',
  );
});

it('deals active words and excludes used ones', async () => {
  await seedWords();
  // Disable one word; it must never be dealt.
  await env.DB.prepare(
    "UPDATE drawguess_words SET status = 'disabled', disabled_at = datetime('now') WHERE id = 'w4'",
  ).run();
  const choices = await dealDrawGuessWords({ db: env.DB, usedWords: ['大熊猫'] });
  expect(choices).toHaveLength(DRAWGUESS_WORD_CHOICE_COUNT);
  const words = choices.map((choice) => choice.word);
  expect(words).not.toContain('大熊猫');
  expect(words).not.toContain('自行车');
  for (const choice of choices) {
    expect(choice.pinyinInitials.length).toBeGreaterThan(0);
  }
});
