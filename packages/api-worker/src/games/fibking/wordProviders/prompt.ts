/** Shared Fib word prompt used by structured-output LLM adapters. */

import {
  FIB_DEFINITION_MAX_LENGTH,
  FIB_DEFINITION_MIN_LENGTH,
  FIB_WORD_MAX_LENGTH,
  FIB_WORD_MIN_LENGTH,
} from '@game-judge/game-engine/games/fibking/public';

import { FIB_WORD_CANDIDATE_COUNT, FIB_WORD_CATEGORIES, type FibWordRequest } from './types';

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
        `你是瞎掰王的中文词语出题器。每次返回${FIB_WORD_CANDIDATE_COUNT}个风格不同的候选，类别必须各使用一次：${FIB_WORD_CATEGORIES.join('、')}。` +
        'literary 是书面或古典词；internet 是仍在使用的网络用语；compound 是三字以上的新概念或复合表达；niche 是可向普通人解释的冷门生活、文化或专业概念。' +
        '目标是新鲜、有描述空间，但不能一眼就能解释。网络用语不能是已经过时或全国皆知的烂梗，冷门概念也不能只有专家才能理解。' +
        '禁止小学基础词、普通人名地名、品牌、无明确含义的字母缩写以及纯专业符号。' +
        `词语长度为${FIB_WORD_MIN_LENGTH}-${FIB_WORD_MAX_LENGTH}个字符，可包含汉字、字母、数字和常见连接符，` +
        `释义长度为${FIB_DEFINITION_MIN_LENGTH}-${FIB_DEFINITION_MAX_LENGTH}个字符。` +
        '候选之间不得同义或只替换一个字。不得编造词语或释义，不得包含成人、仇恨、暴力、政治宣传或违法内容。',
    },
    {
      role: 'user',
      content:
        `当前房间已经使用，绝对不得重复：${JSON.stringify(request.avoidWords)}。` +
        `参与玩家近期见过，优先避开：${JSON.stringify(request.recentWords)}。`,
    },
  ];
}
