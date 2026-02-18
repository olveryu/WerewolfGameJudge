/**
 * shuffle - Fisher-Yates shuffle for game-engine
 *
 * Platform-agnostic, uses game-engine's own secureRng.
 * 提供纯函数数组打乱，支持可注入 rng。不依赖任何平台模块。
 */

import { type Rng, secureRng } from './random';

/**
 * Fisher-Yates shuffle algorithm
 * Creates a new shuffled array without modifying the original
 */
export function shuffleArray<T>(array: T[], rng: Rng = secureRng): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
