/**
 * id - Platform-agnostic unique ID generation for game-engine
 *
 * 使用标准 Web Crypto API（Node 19+ / 所有现代浏览器原生支持）。
 * 不依赖 expo-crypto。
 *
 * ✅ 允许：生成 randomHex / requestId / rejectionId
 * ❌ 禁止：import 平台依赖（expo-crypto）、Math.random()
 */

/**
 * 生成随机十六进制字符串
 * 使用 Web Crypto API（Node 19+ / 浏览器原生支持）
 */
export function randomHex(length: number): string {
  const bytes = new Uint8Array(Math.ceil(length / 2));
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, length);
}

/**
 * 生成唯一 Request ID（用于 RPC/ACK 关联）
 */
export function newRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${randomHex(12)}`;
}

/**
 * 生成唯一 Rejection ID（用于 action rejection 去重）
 *
 * 格式: `{timestamp}:{random}`
 */
export function newRejectionId(): string {
  return `${Date.now()}:${randomHex(8)}`;
}
