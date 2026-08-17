/** Shared Fib word prompt used by structured-output LLM adapters. */

import {
  FIB_DEFINITION_FIELD_MAX_LENGTH,
  FIB_DEFINITION_FIELD_MIN_LENGTH,
  FIB_WORD_MAX_LENGTH,
  FIB_WORD_MIN_LENGTH,
} from '@game-judge/game-engine/games/fibking/public';

import { FIB_GENERATED_WORD_CANDIDATE_COUNT, type FibWordRequest } from './types';

const FIB_WORD_CATEGORY_INSTRUCTIONS = {
  literary:
    '由常用汉字组成、读音不拗口、字面能引出多种联想且真义有反差的冷门书面或古典词，不得使用常见成语',
  internet: '当前仍在小范围自然使用、不能从字面直接推出含义的网络表达',
  compound: '由三个以上常用汉字组成、真实含义不能靠逐字解释直接拼出的概念',
  niche: '来自生活、饮食、民俗、器物、手艺、心理或科技，无需专业背景也能理解的具体概念',
} as const;

export function createFibWordMessages(
  request: FibWordRequest,
): readonly [
  { readonly role: 'system'; readonly content: string },
  { readonly role: 'user'; readonly content: string },
] {
  return [
    {
      role: 'system',
      content:
        `你是瞎掰王的中文词语出题器。一次返回恰好${FIB_GENERATED_WORD_CANDIDATE_COUNT}个互不重复的候选，类别都必须是 ${request.category}（${FIB_WORD_CATEGORY_INSTRUCTIONS[request.category]}）。` +
        '这不是造词任务，而是从你已有的稳定中文知识中回忆现成词项。只能选择在本轮请求前就已知固定词形和固定词义配对的词。' +
        '禁止先组合汉字得到一个听起来像词的字符串，再为它补写合理解释；禁止把临时短语、描述性搭配或只在本题中成立的组合当成词。' +
        '返回前在内部逐项反证：独立看到这个词时是否仍会给出同一固定含义；核心释义是否来自已知词义而非字面推导；使用提示是否无需猜测来源、年代或适用场景。任一项拿不准就更换候选，不要输出审查过程。' +
        `只输出通过全部审查的${FIB_GENERATED_WORD_CANDIDATE_COUNT}个候选，不得为了凑数编造。` +
        '按出题质量从高到低排列，第一项必须是最佳候选。' +
        '排序时依次看重：普通玩家不知道真实含义、字面可编出多种解释、真义与字面有反差、词语和释义确实可查证。' +
        '目标难度是所有字通常都认识且能顺口读出，但多数普通玩家第一次听到时猜不中真实含义。' +
        '好题必须同时满足：普通玩家能顺口读出；只看字面或读音就能编出至少三种彼此不同且看似合理的假释义；真实含义具体、出人意料，揭晓后有讨论点。' +
        '优先选择熟字组成的冷知识词、反直觉概念和具体名物。' +
        '禁止常见成语、日常高频词、教材高频典故、多数玩家读不出的生僻字堆、逐字解释就能猜中的透明复合词、纯抽象学术名词、已经过时或全国皆知的网络梗。' +
        '禁止小学基础词、普通人名地名、品牌、无明确含义的字母缩写以及纯专业符号。' +
        '候选之间不得是近义词、同源词或同一主题的轻微改写；只保留你确信真实存在且释义准确的词，拿不准的必须丢弃。' +
        `词语长度为${FIB_WORD_MIN_LENGTH}-${FIB_WORD_MAX_LENGTH}个汉字，不得包含字母、数字、空格或符号，` +
        `核心释义和使用提示都必须为${FIB_DEFINITION_FIELD_MIN_LENGTH}-${FIB_DEFINITION_FIELD_MAX_LENGTH}个字符。` +
        '核心释义要完整说明词义，使用提示要补充适用对象、语境或容易误解之处，不能只是换句话重复核心释义，并在准确完整的前提下保持简洁。' +
        '两个字段必须全程使用中文，不得出现英文字母、英文单词或英文句子。' +
        '不得编造词语或释义。',
    },
    {
      role: 'user',
      content:
        `当前房间已经使用，绝对不得重复：${JSON.stringify(request.avoidWords)}。` +
        `参与玩家近期见过，也绝对不得重复：${JSON.stringify(request.recentWords)}。`,
    },
  ];
}
