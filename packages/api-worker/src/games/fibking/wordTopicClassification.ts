/** Bounded classification of published words without altering their quality or draw identity. */
import { z } from 'zod';

import { requestStructuredOutput } from '../../platform/ai/structuredOutput';
import { GEMINI_FIB_WORD_MODEL } from './wordProviders/gemini';
import { FIB_WORD_ALL_TOPIC_IDS, FIB_WORD_TOPICS } from './wordTopics';

const CLASSIFICATION_BATCH_LIMIT = 25;
const wordSchema = z.strictObject({
  id: z.string(),
  word: z.string(),
  coreMeaning: z.string(),
  usageNote: z.string(),
});
const classificationsSchema = z.strictObject({
  classifications: z
    .array(z.strictObject({ index: z.int().min(0), topic: z.enum(FIB_WORD_ALL_TOPIC_IDS) }))
    .max(CLASSIFICATION_BATCH_LIMIT),
});
type WordToClassify = z.output<typeof wordSchema>;
type Classification = z.output<typeof classificationsSchema>['classifications'][number];

/** Load active words not yet classified; the word's definition is the classification snapshot. */
export async function getFibWordsToClassify(db: D1Database): Promise<WordToClassify[]> {
  const rows = await db
    .prepare(
      `SELECT id, word, core_meaning AS coreMeaning, usage_note AS usageNote
       FROM fib_words WHERE status = 'active' AND topic IS NULL
       ORDER BY created_at, id LIMIT ?`,
    )
    .bind(CLASSIFICATION_BATCH_LIMIT)
    .all();
  return z.array(wordSchema).parse(rows.results);
}

/** Classify exact meanings, using "other" when no topic fits. */
export async function classifyFibWords(
  apiKey: string,
  words: readonly WordToClassify[],
): Promise<Classification[]> {
  const result = await requestStructuredOutput({
    apiKey,
    model: GEMINI_FIB_WORD_MODEL,
    providerLabel: 'Fib topic classification',
    schema: classificationsSchema,
    systemPrompt:
      '根据释义选择最贴近的主题，不按词面猜测。无法归类时选 other。返回输入的零起始序号 index 和 topic；只返回 JSON。',
    payload: {
      topics: FIB_WORD_TOPICS,
      words: words.map(({ word, coreMeaning, usageNote }, index) => ({
        index,
        word,
        coreMeaning,
        usageNote,
      })),
    },
  });
  return result.classifications;
}

/** Save only uniquely matched results whose source definition is still current. */
export async function storeFibWordTopics(
  db: D1Database,
  words: readonly WordToClassify[],
  classifications: readonly Classification[],
): Promise<void> {
  const statements = classifications.flatMap((classification) => {
    const word = words[classification.index];
    if (
      word === undefined ||
      classifications.filter((item) => item.index === classification.index).length !== 1
    )
      return [];
    return [
      db
        .prepare(
          `UPDATE fib_words SET topic = ?
       WHERE id = ? AND word = ? AND core_meaning = ? AND usage_note = ?
         AND status = 'active' AND topic IS NULL`,
        )
        .bind(classification.topic, word.id, word.word, word.coreMeaning, word.usageNote),
    ];
  });
  if (statements.length > 0) await db.batch(statements);
}
