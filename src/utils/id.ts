/**
 * Unique ID generation utilities
 *
 * 提供安全的唯一 ID 生成，全链路不依赖 Math.random()
 *
 * 优先级：
 * 1. crypto.randomUUID() - 如果可用（现代浏览器/Node.js）
 * 2. crypto.getRandomValues() - Web Crypto API
 * 3. expo-crypto - React Native / Expo 环境
 */

import * as ExpoCrypto from 'expo-crypto';

/**
 * 生成随机十六进制字符串
 * 优先使用 Web Crypto API，降级到 expo-crypto
 * 全链路不使用 Math.random()
 */
export function randomHex(length: number): string {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = new Uint8Array(Math.ceil(length / 2));
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, length);
  }

  // Final fallback for RN/Expo: expo-crypto.
  // NOTE: This keeps us off Math.random() even in runtimes without Web Crypto.
  const byteLength = Math.ceil(length / 2);
  const bytes = ExpoCrypto.getRandomBytes(byteLength);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, length);
}

/**
 * 生成唯一 Request ID（用于 RPC/ACK 关联）
 *
 * 格式: `{timestamp}-{random}`
 * 例如: `1706123456789-a1b2c3d4e5f6`
 */
export function newRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  // 降级：时间戳 + 随机
  return `${Date.now()}-${randomHex(12)}`;
}

/**
 * 生成唯一 Rejection ID（用于 action rejection 去重）
 *
 * 格式: `{timestamp}:{random}`
 * 例如: `1706123456789:a1b2c3d4`
 */
export function newRejectionId(): string {
  return `${Date.now()}:${randomHex(8)}`;
}
