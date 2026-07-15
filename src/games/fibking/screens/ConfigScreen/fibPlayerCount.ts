/** Parse editable FibKing player counts without imposing a product maximum. */

import { FIB_MIN_PLAYERS, isValidFibPlayerCount } from '@werewolf/game-engine/games/fibking/public';

export type FibPlayerCountInput =
  | { readonly kind: 'valid'; readonly value: number }
  | { readonly kind: 'invalid'; readonly reason: string };

export function parseFibPlayerCountInput(value: string): FibPlayerCountInput {
  if (!/^\d+$/.test(value)) {
    return { kind: 'invalid', reason: '人数必须是整数' };
  }

  const count = Number(value);
  if (!Number.isSafeInteger(count)) {
    return { kind: 'invalid', reason: '人数超出当前设备可精确表示的范围' };
  }
  if (!isValidFibPlayerCount(count)) {
    return { kind: 'invalid', reason: `至少需要 ${FIB_MIN_PLAYERS} 人` };
  }
  return { kind: 'valid', value: count };
}
