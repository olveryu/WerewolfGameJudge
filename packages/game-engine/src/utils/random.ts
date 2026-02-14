/**
 * random - Platform-agnostic secure random utilities for game-engine
 *
 * 使用标准 Web Crypto API（Node 19+ / 所有现代浏览器原生支持）。
 * 不依赖 expo-crypto。
 *
 * ✅ 允许：secureRng / Rng 类型
 * ❌ 禁止：import 平台依赖（expo-crypto）、Math.random()
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
