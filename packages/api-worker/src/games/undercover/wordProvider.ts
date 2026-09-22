/** Bounded Gemini editorial requests; generation and review use separate prompts and outputs. */
import type { UndercoverCategory } from '@game-judge/game-engine/games/undercover/public';
import { z } from 'zod';

import {
  parseUndercoverReviews,
  undercoverCandidatesSchema,
  undercoverReviewsSchema,
  type UndercoverWordCandidate,
} from './wordEditorial';

export const UNDERCOVER_WORD_MODEL = 'gemini-3.5-flash-lite';
const REQUEST_TIMEOUT_MS = 120_000;
const responseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
});
const CATEGORY_TOPICS: Record<UndercoverCategory, string> = {
  food: '美食饮品：食物、饮料、烹饪与用餐习惯',
  dailyLife: '日常生活：日用品、家居、购物与日常习惯',
  school: '校园青春：课程、考试、社团与校园经历',
  work: '职场打工：职业、工作情境与办公活动',
  relationships: '社交关系：常见人际身份、交往方式与社交行为',
  actions: '动作状态：动作、情绪、作息与生活状态',
  entertainment: '影视文娱：大众作品、角色、音乐与娱乐活动',
  sportsAndGames: '运动游戏：运动项目、电子游戏与线下游戏',
  travel: '出行场景：交通、旅行、公共场所与外出经历',
  nature: '自然万物：常见动植物、天气与自然现象',
};
const GENERATION_PROMPT = `你为中文同桌聚会游戏「谁是卧底」设计词对。每组两词分别发给平民和卧底，玩家不知道阵营，还可能有一名无词的白板。
只生成指定分类，最多30组，可以零产出，不凑数量。两个词都须普通中文玩家无需解释就认识，熟悉程度接近，交换阵营仍能玩。
至少两个自然共同描述角度、两个清晰区别。不要同义词、别名、地区叫法、上下位包含关系、完全无关词或只换颜色大小的词对。
允许物品、人物身份、动作、生活场景与大众短语，不只列物品。不要反复使用相同词或区别模式。排除历史样本及交换顺序后的重复。
不复制商业题库或作品台词，不用冷僻知识。作品角色与网络用语只有普遍熟悉且事实确定才可选，不确定则舍弃。
commonTraits与differences分别给出自然共性和区别，potentialIssues记录歧义、失衡或容易泄底的风险。输出只是未审核候选，不宣称试玩或审核通过。`;
const REVIEW_PROMPT = `你独立审核中文聚会游戏「谁是卧底」词对。只凭给定词语重新思考，不接受生成者的自评。不要新增、遗漏、调序或替换词对。
每对双方必须常见、熟悉程度接近、有至少两项自然共性和两项可描述区别；不能是同义词、别名、包含关系或牵强配对，交换平民和卧底词仍应可玩，且有无词白板时不靠冷门知识。
按字段逐项判断熟悉度、对称性、共性、区别、非同义/包含、双向可玩、分类准确、内容适宜及事实确定性。常见本身不是缺点。
自己填写commonTraits、differences与具体reason。作品角色、人物、时效热梗或关键事实无法确定时isFactuallyCertain必须false，不编造检索或试玩证据。
不确定的任一质量项必须false，不能靠其他项弥补。所有词对都必须返回审核，包括不合格者。`;

async function requestStructuredOutput<Output>(
  apiKey: string,
  schema: z.ZodType<Output>,
  systemPrompt: string,
  payload: unknown,
  fetchImpl: typeof fetch,
): Promise<Output> {
  if (apiKey.length === 0) throw new Error('Undercover provider requires GEMINI_API_KEY');
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchImpl.call(
      globalThis,
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        signal,
        body: JSON.stringify({
          model: UNDERCOVER_WORD_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(payload) },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'undercover_editorial',
              strict: true,
              schema: z.toJSONSchema(schema),
            },
          },
        }),
      },
    );
  } catch {
    throw new Error(
      signal.aborted ? 'Undercover provider [timedOut]' : 'Undercover provider [requestFailed]',
    );
  }
  if (!response.ok) throw new Error(`Undercover provider HTTP ${response.status}`);
  try {
    const value: unknown = await response.json();
    const first = responseSchema.parse(value).choices[0];
    if (first === undefined) throw new Error('Missing provider choice');
    const content: unknown = JSON.parse(first.message.content);
    return schema.parse(content);
  } catch {
    throw new Error('Undercover provider [invalidOutput]');
  }
}

/** Provider output remains unapproved until a separate review request and publication transaction. */
export function createUndercoverWordProvider(apiKey: string, fetchImpl: typeof fetch = fetch) {
  return {
    generateBatch(
      category: UndercoverCategory,
      history: readonly { wordA: string; wordB: string }[],
    ) {
      return requestStructuredOutput(
        apiKey,
        undercoverCandidatesSchema,
        GENERATION_PROMPT,
        { category, topic: CATEGORY_TOPICS[category], history },
        fetchImpl,
      );
    },
    async reviewBatch(
      category: UndercoverCategory,
      candidates: readonly UndercoverWordCandidate[],
    ) {
      const output = await requestStructuredOutput(
        apiKey,
        undercoverReviewsSchema,
        REVIEW_PROMPT,
        {
          category,
          topic: CATEGORY_TOPICS[category],
          candidates: candidates.map(({ wordA, wordB }) => ({ wordA, wordB })),
        },
        fetchImpl,
      );
      return parseUndercoverReviews(output, candidates);
    },
  };
}
