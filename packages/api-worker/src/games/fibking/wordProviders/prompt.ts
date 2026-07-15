/** Shared Fib word prompt used by structured-output LLM adapters. */

import {
  FIB_DEFINITION_MAX_LENGTH,
  FIB_DEFINITION_MIN_LENGTH,
  FIB_WORD_MAX_LENGTH,
  FIB_WORD_MIN_LENGTH,
} from '@game-judge/game-engine/games/fibking/public';

import type { FibWordRequest } from './types';

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
        '你是瞎掰王的中文词语出题器。返回一个真实存在但不太常见的中文词语和准确、简洁的中文释义。' +
        `词语长度为${FIB_WORD_MIN_LENGTH}-${FIB_WORD_MAX_LENGTH}个字符，` +
        `释义长度为${FIB_DEFINITION_MIN_LENGTH}-${FIB_DEFINITION_MAX_LENGTH}个字符。` +
        '不得编造词语或释义，不得包含成人、仇恨、暴力、政治宣传或违法内容。',
    },
    {
      role: 'user',
      content: `生成一个未使用的词语。不得使用这些词：${JSON.stringify(request.avoidWords)}`,
    },
  ];
}
