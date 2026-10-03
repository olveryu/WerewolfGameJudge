/** DrawGuess word dealing: fetch unused words from the D1 drawguess_words table. */

import {
  DRAWGUESS_WORD_CHOICE_COUNT,
  type DrawGuessWordChoice,
} from '@game-judge/game-engine/games/drawguess/public';
import { z } from 'zod';

const wordRowSchema = z.strictObject({
  word: z.string().min(1),
  pinyin_initials: z.string().min(1),
});

export interface DealDrawGuessWordsInput {
  readonly db: D1Database;
  /** 本局已用题目（服务端权威 usedWords），出题时避开。 */
  readonly usedWords: readonly string[];
}

/** 词库无可用题目：种子数据缺失或全部用完，需要人工介入。 */
class DrawGuessWordInventoryExhaustedError extends Error {
  constructor() {
    super('drawguess_words 词库无可用题目');
    this.name = 'DrawGuessWordInventoryExhaustedError';
  }
}

/**
 * 从 D1 随机取 {@link DRAWGUESS_WORD_CHOICE_COUNT} 个未用过的在架题目。
 *
 * @throws {DrawGuessWordInventoryExhaustedError} 词库无可用题目时抛出，effect 重试。
 */
export async function dealDrawGuessWords(
  input: DealDrawGuessWordsInput,
): Promise<DrawGuessWordChoice[]> {
  const usedWords = [...new Set(input.usedWords)];
  let query = `SELECT word, pinyin_initials FROM drawguess_words WHERE status = 'active'`;
  if (usedWords.length > 0) {
    query += ` AND word NOT IN (${usedWords.map(() => '?').join(', ')})`;
  }
  query += ' ORDER BY RANDOM() LIMIT ?';
  const result = await input.db
    .prepare(query)
    .bind(...usedWords, DRAWGUESS_WORD_CHOICE_COUNT)
    .all();
  const rows = z.array(wordRowSchema).parse(result.results);
  if (rows.length === 0) throw new DrawGuessWordInventoryExhaustedError();
  return rows.map((row) => ({ word: row.word, pinyinInitials: row.pinyin_initials }));
}
