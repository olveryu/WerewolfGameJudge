/** DrawGuess word dealing through the shared word draw; candidates come from drawguess_words only. */

import {
  DRAWGUESS_WORD_CHOICE_COUNT,
  type DrawGuessWordChoice,
} from '@game-judge/game-engine/games/drawguess/public';
import { z } from 'zod';

import {
  drawWords,
  recordSeenWords,
  WORD_DRAW_ALL_PARTITION,
} from '../../platform/wordSupply/wordDraw';

const poolWordRowSchema = z.strictObject({
  ordinal: z.int().positive(),
  word: z.string().min(1),
  pinyin_initials: z.string().min(1),
  status: z.enum(['active', 'disabled']),
});
type DrawGuessPoolWord = z.output<typeof poolWordRowSchema>;

export interface DealDrawGuessWordsInput {
  readonly db: D1Database;
  /** 本局已用题目（服务端权威 usedWords），出题时避开。 */
  readonly usedWords: readonly string[];
  /** 本桌真人账号；任一人玩过的题目排在没人玩过的之后。 */
  readonly participantUserIds: readonly string[];
}

/** 词库无可用题目：种子数据缺失或本局已把在架题目用完，需要人工介入。 */
class DrawGuessWordInventoryExhaustedError extends Error {
  constructor() {
    super('drawguess_words 词库无可用题目');
    this.name = 'DrawGuessWordInventoryExhaustedError';
  }
}

/**
 * Load active words by draw ordinal, minus the words this game already used.
 * The query filters on the ordinal alone: with a status predicate the planner
 * prefers the status index for multi-ordinal lookups and reads every active word.
 */
async function loadDrawGuessPoolWords(
  db: D1Database,
  ordinals: readonly number[],
  usedWords: ReadonlySet<string>,
): Promise<ReadonlyMap<number, DrawGuessPoolWord>> {
  const result = await db
    .prepare(
      `SELECT draw_ordinal AS ordinal, word, pinyin_initials, status FROM drawguess_words
       WHERE draw_ordinal IN (${ordinals.map(() => '?').join(', ')})`,
    )
    .bind(...ordinals)
    .all();
  const words = new Map<number, DrawGuessPoolWord>();
  for (const row of z.array(poolWordRowSchema).parse(result.results)) {
    if (row.status === 'active' && !usedWords.has(row.word)) words.set(row.ordinal, row);
  }
  return words;
}

/**
 * 随机取 {@link DRAWGUESS_WORD_CHOICE_COUNT} 个在架候选题目：优先本桌没人玩过的，
 * 不够时用玩过的补足，本局已用的始终避开。候选只是给画手看的选项，不记入已见；
 * 画手选定的那一个由 {@link recordDrawGuessWordSeen} 记录。
 *
 * @throws {DrawGuessWordInventoryExhaustedError} 词库无可用题目时抛出，effect 重试。
 */
export async function dealDrawGuessWords(
  input: DealDrawGuessWordsInput,
): Promise<DrawGuessWordChoice[]> {
  const usedWords = new Set(input.usedWords);
  const result = await drawWords({
    db: input.db,
    pool: 'drawguess',
    partition: WORD_DRAW_ALL_PARTITION,
    participantUserIds: input.participantUserIds,
    count: DRAWGUESS_WORD_CHOICE_COUNT,
    seenPolicy: 'preferUnseen',
    loadItems: (ordinals) => loadDrawGuessPoolWords(input.db, ordinals, usedWords),
  });
  if (result.kind === 'exhausted') throw new DrawGuessWordInventoryExhaustedError();
  return result.picks.map((pick) => ({
    word: pick.item.word,
    pinyinInitials: pick.item.pinyin_initials,
  }));
}

export interface RecordDrawGuessWordSeenInput {
  readonly db: D1Database;
  /** 画手选定、全桌实际玩到的题目。 */
  readonly word: string;
  readonly participantUserIds: readonly string[];
}

const ordinalRowSchema = z.strictObject({ ordinal: z.int().positive().nullable() });

/** 把本回合实际玩到的题目记入全桌真人的已见记录；重复投递不产生变化。 */
export async function recordDrawGuessWordSeen(input: RecordDrawGuessWordSeenInput): Promise<void> {
  const result = await input.db
    .prepare('SELECT draw_ordinal AS ordinal FROM drawguess_words WHERE word = ?')
    .bind(input.word)
    .all();
  const ordinal = z.array(ordinalRowSchema).parse(result.results)[0]?.ordinal;
  // The word left the bank after it was dealt: nothing can repeat, nothing to record.
  if (ordinal === undefined || ordinal === null) return;
  await recordSeenWords({
    db: input.db,
    pool: 'drawguess',
    userIds: input.participantUserIds,
    ordinals: [ordinal],
  });
}
