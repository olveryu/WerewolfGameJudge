/**
 * shuffle - Fisher-Yates shuffle algorithm
 *
 * Creates a new shuffled array without modifying the original.
 *
 * ✅ 允许：纯函数数组打乱、可注入 rng
 * ❌ 禁止：import React / service / 直接调用 Math 的 random（必须用 secureRng）
 */

/**
 * Fisher-Yates shuffle algorithm
 * Creates a new shuffled array without modifying the original
 *
 * @param array - 要打乱的数组
 * @param rng - 可选的随机数生成器，默认使用 secureRng
 */
import { type Rng,secureRng } from './random';

export function shuffleArray<T>(array: T[], rng: Rng = secureRng): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
