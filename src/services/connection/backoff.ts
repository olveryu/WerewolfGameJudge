/**
 * calculateBackoff — 指数退避 + jitter
 *
 * 社区标准实现：exponential backoff with full jitter。
 * 纯函数，无副作用，可穷举测试。
 *
 * @param attempt - 当前重试次数（0-based）
 * @param baseMs - 基础延迟（默认 1000ms）
 * @param maxMs - 最大延迟上限（默认 30000ms）
 * @param random - 随机数生成器（0~1），默认 Math.random，测试时可注入
 * @returns 带 jitter 的延迟毫秒数
 */
export function calculateBackoff(
  attempt: number,
  baseMs: number = 1000,
  maxMs: number = 30_000,
  random: () => number = Math.random,
): number {
  const exponential = baseMs * Math.pow(2, attempt);
  const capped = Math.min(exponential, maxMs);
  // Full jitter: uniform random in [capped * 0.5, capped]
  const jitter = capped * (0.5 + random() * 0.5);
  return Math.round(jitter);
}
