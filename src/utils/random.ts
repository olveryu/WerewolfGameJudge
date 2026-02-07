/**
 * random - Secure random utilities
 *
 * 提供可注入随机源的工具函数，用于替代 Math.random()
 * 全链路使用安全随机，支持测试时注入固定随机源
 *
 * ✅ 允许：secureRng / secureRandomInt / 可注入 Rng 类型
 * ❌ 禁止：import React / service / Math.random()（生产代码）
 */

import * as ExpoCrypto from 'expo-crypto';

/**
 * 随机数生成器类型
 * 返回 [0, 1) 范围的浮点数
 */
export type Rng = () => number;

/**
 * 安全随机数生成器
 * 优先使用 Web Crypto API，降级到 expo-crypto
 *
 * @returns [0, 1) 范围的浮点数
 */
export function secureRng(): number {
  let randomValue: number;

  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    // Web Crypto API (现代浏览器/Node.js)
    const array = new Uint32Array(1);
    globalThis.crypto.getRandomValues(array);
    // 转换为 [0, 1) 范围
    randomValue = array[0] / 0x100000000;
  } else {
    // Fallback: expo-crypto (React Native / Expo)
    const bytes = ExpoCrypto.getRandomBytes(4);
    const value = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
    // 转换为无符号整数再归一化
    randomValue = (value >>> 0) / 0x100000000;
  }

  return randomValue;
}

/**
 * 生成指定范围内的随机整数（包含两端）
 *
 * @param min - 最小值（包含）
 * @param max - 最大值（包含）
 * @param rng - 可选的随机数生成器，默认使用 secureRng
 * @returns [min, max] 范围内的整数
 *
 * @example
 * ```ts
 * // 使用默认安全随机
 * const seat = randomIntInclusive(1, 12);
 *
 * // 测试时注入固定随机
 * const seat = randomIntInclusive(1, 12, () => 0); // 总是返回 1
 * ```
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
 *
 * @example
 * ```ts
 * // 使用默认安全随机
 * const isClockwise = randomBool();
 *
 * // 测试时注入固定随机
 * const isClockwise = randomBool(() => 0.3); // 总是返回 true (< 0.5)
 * ```
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
 *
 * @example
 * ```ts
 * const role = randomPick(['seer', 'witch', 'guard']);
 *
 * // 测试时注入固定随机
 * const role = randomPick(['seer', 'witch', 'guard'], () => 0); // 总是 'seer'
 * ```
 */
export function randomPick<T>(arr: readonly T[], rng: Rng = secureRng): T {
  if (arr.length === 0) {
    throw new Error('randomPick: array must not be empty');
  }
  return arr[Math.floor(rng() * arr.length)];
}
