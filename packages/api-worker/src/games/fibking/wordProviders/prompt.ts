/** Shared Fib word prompt used by structured-output LLM adapters. */

import {
  FIB_DEFINITION_FIELD_MAX_LENGTH,
  FIB_DEFINITION_FIELD_MIN_LENGTH,
  FIB_WORD_MAX_LENGTH,
  FIB_WORD_MIN_LENGTH,
} from '@game-judge/game-engine/games/fibking/public';

import type { FibWordRequest } from './types';

const FIB_WORD_CATEGORY_INSTRUCTIONS = {
  literary: '书面或古典词',
  internet: '仍在使用且不过时的网络用语',
  compound: '三字以上的新概念或复合表达',
  niche: '可向普通人解释的冷门生活、文化或专业概念',
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
        '目标是新鲜、有描述空间，但不能一眼就能解释。网络用语不能是已经过时或全国皆知的烂梗，冷门概念也不能只有专家才能理解。' +
        '禁止小学基础词、普通人名地名、品牌、无明确含义的字母缩写以及纯专业符号。' +
        `词语长度为${FIB_WORD_MIN_LENGTH}-${FIB_WORD_MAX_LENGTH}个汉字，不得包含字母、数字、空格或符号，` +
        `核心释义和使用提示都必须为${FIB_DEFINITION_FIELD_MIN_LENGTH}-${FIB_DEFINITION_FIELD_MAX_LENGTH}个字符。` +
        '核心释义要完整说明词义，使用提示要补充适用对象、语境或容易误解之处，不能只是换句话重复核心释义。' +
        '两个字段必须全程使用中文，不得出现英文字母、英文单词或英文句子。' +
        '不得编造词语或释义，不得包含成人、仇恨、暴力、政治宣传或违法内容。',
    },
    {
      role: 'user',
      content:
        `当前房间已经使用，绝对不得重复：${JSON.stringify(request.avoidWords)}。` +
        `参与玩家近期见过，也绝对不得重复：${JSON.stringify(request.recentWords)}。`,
    },
  ];
}
