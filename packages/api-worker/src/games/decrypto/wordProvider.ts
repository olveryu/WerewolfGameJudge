/** Bounded Gemini editorial requests; generated words remain pending until manual review. */
import type { AiCorrelation } from '../../platform/ai/aiError';
import { AiOutputValidationError } from '../../platform/ai/aiError';
import { requestStructuredOutput } from '../../platform/ai/structuredOutput';
import { DECRYPTO_WORD_CATEGORIES, type DecryptoWordCategory } from './wordCategories';
import {
  decodeGeneratedDecryptoCandidates,
  DECRYPTO_WORD_BATCH_LIMIT,
  decryptoCandidatesSchema,
  decryptoReviewsSchema,
  type DecryptoWordCandidate,
  parseDecryptoReviews,
} from './wordEditorial';

export const DECRYPTO_WORD_MODEL = 'gemini-3.5-flash-lite';

const GENERATION_PROMPT = `你为中文聚会桌游「解码战」生成常见关键词。
关键词会印在玩家面前，并在多轮中反复用于联想线索。只生成普通中文玩家熟悉、含义明确、容易理解的具体词语；优先日常物品、地点、动物、食物、自然现象和常见活动。不要出人名、品牌、冷僻知识、时效热梗、露骨或冒犯内容，也不要复用 history 中的词。
本次分类只有 general（常用词）。每次最多生成 ${DECRYPTO_WORD_BATCH_LIMIT} 个词；想不到合格词时返回空数组。candidate 必须包含 word、category、potentialIssues。word 用 2 至 8 个简体汉字，category 原样填写输入的 general。潜在歧义请写入 potentialIssues。`;

const REVIEW_PROMPT = `你是中文桌游「解码战」关键词的独立审核员。玩家需要围绕词语给出可联想、但不会直接泄露原词的线索，因此词语应当常见、具体、含义明确且适合朋友聚会。
逐个审核输入词语，只有全部满足以下条件时才通过：普通中文玩家熟悉；具体且适合联想；没有明显歧义；适合朋友聚会且不含露骨、血腥、歧视或侮辱内容。拿不准时填 false。reviews 必须与 candidates 数量、顺序及 word 完全一致，不得增删或替换。`;

/** Provider output remains unapproved until a separate review request and publication transaction. */
export function createDecryptoWordProvider(apiKey: string, fetchImpl: typeof fetch = fetch) {
  return {
    generateBatch(
      category: DecryptoWordCategory,
      history: readonly string[],
      context: AiCorrelation = {},
    ) {
      return requestStructuredOutput({
        apiKey,
        model: DECRYPTO_WORD_MODEL,
        context: { ...context, game: 'decrypto', operation: 'generate' },
        schema: decryptoCandidatesSchema,
        systemPrompt: GENERATION_PROMPT,
        payload: { category, categories: DECRYPTO_WORD_CATEGORIES, history },
        fetchImpl,
        parseOutput: (value) =>
          decodeGeneratedDecryptoCandidates(value, category, {
            ...context,
            game: 'decrypto',
            operation: 'generate',
            model: DECRYPTO_WORD_MODEL,
          }),
      });
    },
    reviewBatch(candidates: readonly DecryptoWordCandidate[], context: AiCorrelation = {}) {
      if (candidates.length === 0) return Promise.resolve([]);
      if (candidates.length > DECRYPTO_WORD_BATCH_LIMIT)
        throw new AiOutputValidationError(
          'reviewBatchTooLarge',
          `Decrypto review exceeds batch limit: ${DECRYPTO_WORD_BATCH_LIMIT}`,
        );
      return requestStructuredOutput({
        apiKey,
        model: DECRYPTO_WORD_MODEL,
        context: { ...context, game: 'decrypto', operation: 'review' },
        schema: decryptoReviewsSchema,
        systemPrompt: REVIEW_PROMPT,
        payload: { candidates: candidates.map(({ word }) => ({ word })) },
        fetchImpl,
        parseOutput: (output) => parseDecryptoReviews(output, candidates),
      });
    },
  };
}
