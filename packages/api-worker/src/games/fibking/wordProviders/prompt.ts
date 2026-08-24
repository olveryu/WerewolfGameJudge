/** Fib word generation and independent-review prompts for structured-output adapters. */

import {
  FIB_DEFINITION_FIELD_MAX_LENGTH,
  FIB_DEFINITION_FIELD_MIN_LENGTH,
  FIB_WORD_MAX_LENGTH,
  FIB_WORD_MIN_LENGTH,
} from '@game-judge/game-engine/games/fibking/public';

import {
  FIB_GENERATED_WORD_CANDIDATE_COUNT,
  type FibWordCandidate,
  type FibWordRequest,
} from './types';

export const FIB_WORD_PROMPT_VERSION = '2';

const FIB_WORD_CATEGORY_INSTRUCTIONS = {
  literary:
    '由常用汉字组成、读音不拗口、字面能引出多种联想且真义有反差的冷门书面或古典词，不得使用常见成语',
  internet: '当前仍在小范围自然使用、不能从字面直接推出含义的网络表达',
  compound: '由三个以上常用汉字组成、真实含义不能靠逐字解释直接拼出的概念',
  niche: '来自生活、饮食、民俗、器物、手艺、心理或科技，无需专业背景也能理解的具体概念',
} as const;

const FIB_WORD_CALIBRATION_EXAMPLES = `
<calibration_examples>
以下词语仅用于理解标准，不得作为本次候选：
- 好题“却扇”：古代婚礼中，新娘以扇遮面并在仪式中移开。汉字常见，真实含义具体且不能靠字面猜中。
- 好题“打尖”：旧时指旅途中短暂停留、休息或吃饭。容易读出，但固定旧义并不明显。
- 好题“鸟笼效应”：得到一件物品后继续添置相关配套物品的心理倾向。名称形象，真实含义有反差。
- 坏题“魑魅魍魉”：读写门槛过高。
- 坏题“情绪价值”：过于常见且字面容易理解。
- 坏题“内卷”“社恐”“躺平”：当代高频表达，多数玩家已经知道真义。
- 坏题“压岁钱”“工具箱”“白眼”：日常事物或常用词，没有释义悬念。
- 坏题“胸有成竹”“走马观花”“望梅止渴”：常见成语，标准含义广为人知。
- 坏题“云梦蝶”：无法确认是具有固定词义的现成词项。
</calibration_examples>`;

const FIB_WORD_REVIEW_CALIBRATION_EXAMPLES = `
<calibration_examples>
以下词语仅用于理解审核标准：
- 接受“却扇”：汉字容易读，固定旧义不能从字面直接推出。
- 接受“打尖”：词面熟悉，但多数玩家不知道其固定旧义。
- 接受“鸟笼效应”：名称形象，真实心理含义有反差且便于编造。
- 拒绝“情绪价值”“内卷”“社恐”“躺平”：当代高频表达，多数玩家已经知道真义。
- 拒绝“压岁钱”“工具箱”“白眼”：日常事物或常用词，词义没有悬念。
- 拒绝“胸有成竹”“走马观花”“望梅止渴”：常见成语，标准含义广为人知。
- 拒绝“魑魅魍魉”：虽然不简单，但读写门槛过高，无法自然口述。
</calibration_examples>`;

export function createFibWordMessages(
  request: FibWordRequest,
): readonly [
  { readonly role: 'system'; readonly content: string },
  { readonly role: 'user'; readonly content: string },
] {
  return [
    {
      role: 'system',
      content: `<role>
你是中文聚会游戏“瞎掰王”的出题编辑。请选择真实存在、释义准确，同时适合玩家编造假释义的中文词语。这不是造词任务。
</role>

<priority>
发生冲突时严格按以下顺序取舍：
1. 词语和释义必须真实准确，禁止编造。
2. 多数普通玩家在揭晓前不能准确说出固定真义。
3. 必须符合指定类别和 JSON Schema。
4. 在满足以上条件后追求游戏性和候选多样性。
</priority>

<good_question>
好题由多数玩家认识且容易读出的汉字组成；真实含义不能通过逐字解释直接猜中；玩家容易编出多个可信的错误释义；揭晓后有反差或讨论价值。
</good_question>

<reject>
拒绝临时短语、自造词、常见成语、日常高频词、人名、地名、品牌、生僻字堆、透明复合词和含义不确定的词。候选不得是近义词、同源词或同一主题的轻微改写。
</reject>
${FIB_WORD_CALIBRATION_EXAMPLES}

<output_rules>
返回恰好${FIB_GENERATED_WORD_CANDIDATE_COUNT}个互不重复的候选，按出题质量从高到低排列。
六个候选必须各自达到好题标准，不得用较弱候选凑满数量。
每个词为${FIB_WORD_MIN_LENGTH}-${FIB_WORD_MAX_LENGTH}个纯汉字。核心释义和使用提示分别为${FIB_DEFINITION_FIELD_MIN_LENGTH}-${FIB_DEFINITION_FIELD_MAX_LENGTH}个字符，只使用中文。
核心释义准确说明固定词义；使用提示补充适用对象、语境或容易误解之处，不得重复核心释义。
只返回 JSON Schema 要求的内容，不输出分析或审查过程。
</output_rules>`,
    },
    {
      role: 'user',
      content: `<request>
指定类别：${request.category}
类别说明：${FIB_WORD_CATEGORY_INSTRUCTIONS[request.category]}
</request>

请比较一批真实词项，再返回质量最高且彼此不同的候选。`,
    },
  ];
}

export function createFibWordReviewMessages(
  request: FibWordRequest,
  candidates: readonly FibWordCandidate[],
): readonly [
  { readonly role: 'system'; readonly content: string },
  { readonly role: 'user'; readonly content: string },
] {
  return [
    {
      role: 'system',
      content: `<role>
你是中文聚会游戏“瞎掰王”的独立审核编辑。候选来自另一名出题编辑；不得因为候选已被生成或排序就降低标准。
</role>

<accept>
只有同时满足以下条件才接受：词项和释义真实准确；由多数玩家容易认读的汉字组成；多数普通玩家在揭晓前无法准确说出固定真义；真义不能靠逐字解释直接拼出；玩家能编造至少两种可信错误释义；揭晓后有反差或讨论价值。
</accept>

<reject>
出现任一情况必须拒绝：当代高频流行语、常见成语、日常事物或动作、常用动词或形容词、字面透明的复合词、主要含义已广为人知、只靠冷僻字制造难度、需要专业知识、词义或释义不确定。不要为了凑数量而接受边缘候选，允许全部拒绝。
</reject>
${FIB_WORD_REVIEW_CALIBRATION_EXAMPLES}

<output_rules>
逐项审核输入中的全部${FIB_GENERATED_WORD_CANDIDATE_COUNT}个候选，保持原顺序且每词恰好出现一次。
decision 只能是 accepted 或 rejected；reason 用一句具体中文说明最关键的接受或拒绝依据。
只返回 JSON Schema 要求的内容，不输出额外分析。
</output_rules>`,
    },
    {
      role: 'user',
      content: `<review_batch>
指定类别：${request.category}
候选数据：${JSON.stringify(candidates.map(({ word, definition }) => ({ word, definition })))}
</review_batch>`,
    },
  ];
}
