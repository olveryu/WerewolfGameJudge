/** Bounded Gemini editorial requests; generation and review use separate prompts and outputs. */
import type { DrawGuessWordCategory } from '@game-judge/game-engine/games/drawguess/public';
import { z } from 'zod';

import {
  DRAWGUESS_WORD_BATCH_LIMIT,
  drawGuessCandidatesSchema,
  drawGuessReviewsSchema,
  parseDrawGuessReviews,
  type DrawGuessWordCandidate,
} from './wordEditorial';

export const DRAWGUESS_WORD_MODEL = 'gemini-3.5-flash-lite';
const REQUEST_TIMEOUT_MS = 120_000;
const responseSchema = z.object({
  candidates: z
    .array(
      z.object({
        finishReason: z.literal('STOP'),
        content: z.object({
          parts: z.array(z.object({ text: z.string(), thought: z.boolean().optional() })).min(1),
        }),
      }),
    )
    .length(1),
});
const CATEGORY_TOPICS: Record<DrawGuessWordCategory, string> = {
  animals: '动物：常见动物、昆虫、水生动物，家养野生都可以',
  food: '食物：常见食物、菜品、水果、零食，一看就知道长什么样的',
  dailyObjects: '日用品：家里办公室常见的具体物品，形状明确好画的',
  plants: '植物：常见花草树木、蔬菜水果的植物本体，特征明显的',
  vehicles: '交通工具：常见车辆船只飞机，外形有辨识度的',
  places: '建筑场所：常见建筑物、场馆、自然地标，轮廓好画的',
  sports: '运动：常见运动项目、器材，一看就知道怎么画的',
  people: '人物身份：常见职业或身份，外形特征明显的（如消防员、医生）',
  idioms: '成语：有典故画面感的四字成语，能画出故事场景的（如守株待兔、画蛇添足）',
  internetMemes: '网络热梗：年轻人熟知的流行语，有标志性画面的（如躺平、内卷），选经久不衰不过时的',
};
const GENERATION_PROMPT = `你为中文聚会游戏「你画我猜」设计题目词。玩家一人作画、众人猜词，词必须好画、好猜。
只生成指定分类，目标是完整提供${DRAWGUESS_WORD_BATCH_LIMIT}个不同的词，而不是几个示例；上限${DRAWGUESS_WORD_BATCH_LIMIT}个。确实找不到足够合格的词时可少于目标或零产出，不凑数量。
每个词都必须是普通中文玩家无需解释就认识、有明确画法的内容：名词看外形、成语看典故场景、热梗看标志性画面；2至8个简体汉字。不要纯抽象词（如幸福、时间）、专有名词（人名地名品牌名）。
difficulty 按绘画难度打分：easy 是人人会画的常见物，medium 是需要一点技巧的，hard 是形状复杂但仍可画的；再难就直接舍弃。
potentialIssues 为0至4项，记录多音字、易混淆、难画部位等风险；词语2至8字，每项说明2至180字。排除历史样本中的重复词。输出只是未审核候选，不宣称试玩或审核通过。`;
const REVIEW_PROMPT = `你独立审核中文聚会游戏「你画我猜」的题目词。只凭给定词语重新思考，不接受生成者的自评。不要新增、遗漏、调序或替换词语。
每个词必须同时满足：有明确画法（isConcreteAndDrawable：名词看外形、成语看典故场景、热梗看标志性画面）、简体中文（isSimplifiedChinese）、2至8个汉字（isLengthValid）、分类准确（isCategoryAccurate）、内容适宜无冒犯（isAppropriate）、无严重歧义不会导致猜词死局（isUnambiguous）。
先找拒绝证据，再逐项判断，不要因为词常见就全填true。纯抽象词、专有名词，isConcreteAndDrawable 必须 false。字数含标点或非汉字时 isLengthValid 必须 false。
不确定的任一质量项必须 false，不能靠其他项弥补。所有词都必须返回审核，包括不合格者。自己填写具体 reason（2至180字），说明通过或拒绝的依据。`;

async function requestStructuredOutput<Output>(
  apiKey: string,
  schema: z.ZodType<Output>,
  systemPrompt: string,
  payload: unknown,
  fetchImpl: typeof fetch,
): Promise<Output> {
  if (apiKey.length === 0) throw new Error('DrawGuess provider requires GEMINI_API_KEY');
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchImpl.call(
      globalThis,
      `https://generativelanguage.googleapis.com/v1beta/models/${DRAWGUESS_WORD_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload) }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseJsonSchema: z.toJSONSchema(schema, {
              target: 'openapi-3.0',
              override: ({ jsonSchema }) => {
                delete jsonSchema.minLength;
                delete jsonSchema.maxLength;
                delete jsonSchema.minItems;
                delete jsonSchema.maxItems;
              },
            }),
          },
        }),
      },
    );
  } catch {
    throw new Error(
      signal.aborted ? 'DrawGuess provider [timedOut]' : 'DrawGuess provider [requestFailed]',
    );
  }
  if (!response.ok) throw new Error(`DrawGuess provider HTTP ${response.status}`);
  try {
    const value: unknown = await response.json();
    const first = responseSchema.parse(value).candidates[0];
    if (first === undefined) throw new Error('Missing provider candidate');
    const content: unknown = JSON.parse(
      first.content.parts
        .filter((part) => part.thought !== true)
        .map((part) => part.text)
        .join(''),
    );
    return schema.parse(content);
  } catch {
    throw new Error('DrawGuess provider [invalidOutput]');
  }
}

/** Provider output remains unapproved until a separate review request and publication transaction. */
export function createDrawGuessWordProvider(apiKey: string, fetchImpl: typeof fetch = fetch) {
  return {
    generateBatch(category: DrawGuessWordCategory, history: readonly string[]) {
      return requestStructuredOutput(
        apiKey,
        drawGuessCandidatesSchema,
        GENERATION_PROMPT,
        { category, topic: CATEGORY_TOPICS[category], history },
        fetchImpl,
      );
    },
    async reviewBatch(
      category: DrawGuessWordCategory,
      candidates: readonly DrawGuessWordCandidate[],
    ) {
      const output = await requestStructuredOutput(
        apiKey,
        drawGuessReviewsSchema,
        REVIEW_PROMPT,
        {
          category,
          topic: CATEGORY_TOPICS[category],
          candidates: candidates.map(({ word }) => ({ word })),
        },
        fetchImpl,
      );
      return parseDrawGuessReviews(output, candidates);
    },
  };
}
