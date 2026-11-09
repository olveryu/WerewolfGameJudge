/** Derive display-only pinyin for FibKing words without extending authoritative state. */

import { pinyin } from 'pinyin-pro';

const HAN_CHARACTER_PATTERN = /\p{Script=Han}/u;

/** Return tone-marked pinyin when a word contains Chinese characters. */
export function formatFibWordPinyin(word: string): string | null {
  if (!HAN_CHARACTER_PATTERN.test(word)) return null;
  return pinyin(word, { toneType: 'symbol', nonZh: 'consecutive' });
}
