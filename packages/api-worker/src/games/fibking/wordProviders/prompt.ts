/** Shared Fib word prompt used by structured-output LLM adapters. */

import {
  FIB_DEFINITION_FIELD_MAX_LENGTH,
  FIB_DEFINITION_FIELD_MIN_LENGTH,
  FIB_WORD_MAX_LENGTH,
  FIB_WORD_MIN_LENGTH,
} from '@game-judge/game-engine/games/fibking/public';

import type { FibWordRequest } from './types';

const FIB_WORD_CATEGORY_INSTRUCTIONS = {
  literary: '由常用汉字组成、读音不拗口、字面能引出多种联想且真义有反差的书面或古典词',
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
        `你是瞎掰王的中文词语出题器。只返回一个候选，类别必须是 ${request.category}（${FIB_WORD_CATEGORY_INSTRUCTIONS[request.category]}）。` +
        '好题必须同时满足：普通玩家能顺口读出；只看字面或读音就能编出至少三种彼此不同且看似合理的假释义；真实含义具体、出人意料，揭晓后有讨论点。' +
        '优先选择熟字组成的冷知识词、反直觉概念和具体名物。' +
        '禁止多数玩家读不出的生僻字堆、逐字解释就能猜中的透明复合词、纯抽象学术名词、已经过时或全国皆知的网络梗。' +
        '禁止小学基础词、普通人名地名、品牌、无明确含义的字母缩写以及纯专业符号。' +
        `词语长度为${FIB_WORD_MIN_LENGTH}-${FIB_WORD_MAX_LENGTH}个汉字，不得包含字母、数字、空格或符号，` +
        `核心释义和使用提示都必须为${FIB_DEFINITION_FIELD_MIN_LENGTH}-${FIB_DEFINITION_FIELD_MAX_LENGTH}个字符。` +
        '核心释义要完整说明词义，使用提示要补充适用对象、语境或容易误解之处，不能只是换句话重复核心释义。' +
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
