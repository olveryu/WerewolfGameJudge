/**
 * random - Platform-agnostic secure random utilities for game-engine
 *
 * 使用标准 Web Crypto API（Node 19+ / 所有现代浏览器原生支持）。
 * 不依赖 expo-crypto。导出 secureRng / randomIntInclusive / randomBool / randomPick / Rng 类型。
 * 不使用 Math.random()，不 import 平台依赖。
 */

/**
 * 随机数生成器类型
 * 返回 [0, 1) 范围的浮点数
 */
export type Rng = () => number;

/**
 * 安全随机数生成器
 * 使用 Web Crypto API（Node 19+ / 浏览器原生支持）
 *
 * @returns [0, 1) 范围的浮点数
 */
export function secureRng(): number {
  const array = new Uint32Array(1);
  globalThis.crypto.getRandomValues(array);
  return array[0] / 0x100000000;
}

/**
 * 生成指定范围内的随机整数（包含两端）
 *
 * @param min - 最小值（包含）
 * @param max - 最大值（包含）
 * @param rng - 可选的随机数生成器，默认使用 secureRng
 * @returns [min, max] 范围内的整数
 */
export function randomIntInclusive(min: number, max: number, rng: Rng = secureRng): number {
  const range = max - min + 1;
  return Math.floor(rng() * range) + min;
}

/**
 * 生成随机布尔值
 *
 * @param rng - 可选的随机数生成器，默认使用 secureRng
 * @returns true 或 false
 */
export function randomBool(rng: Rng = secureRng): boolean {
  return rng() < 0.5;
}

/**
 * 从数组中随机选取一个元素
 *
 * @param arr - 非空数组
 * @param rng - 可选的随机数生成器，默认使用 secureRng
 * @returns 数组中的随机元素
 * @throws 如果数组为空
 */
export function randomPick<T>(arr: readonly T[], rng: Rng = secureRng): T {
  if (arr.length === 0) {
    throw new Error('randomPick: array must not be empty');
  }
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Create a deterministic PRNG from a string seed (mulberry32).
 *
 * All clients given the same seed produce identical sequences, enabling
 * coordinated randomness without server round-trips.
 *
 * @param seed - Arbitrary string used as seed
 * @returns A deterministic Rng function producing [0, 1) floats
 */
export function createSeededRng(seed: string): Rng {
  // Simple string → 32-bit hash (djb2)
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h + seed.charCodeAt(i)) | 0;
  }
  // mulberry32 PRNG
  return () => {
    h |= 0;
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}
