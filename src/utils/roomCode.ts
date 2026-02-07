/**
 * roomCode - Room code generation utilities
 *
 * 统一的房间号生成入口，确保所有创建房间路径使用相同的生成逻辑
 * 全链路使用安全随机，不依赖 Math.random()
 *
 * ✅ 允许：生成 4 位房间号
 * ❌ 禁止：import React / service / Math.random()
 */

import * as ExpoCrypto from 'expo-crypto';

/**
 * 生成 4 位房间号（1000-9999）
 *
 * 优先使用 Web Crypto API，降级到 expo-crypto
 * 保证随机性的同时避免 Math.random()
 *
 * @returns 4 位数字字符串，范围 1000-9999
 */
export function generateRoomCode(): string {
  const range = 9000; // 9999 - 1000 + 1 = 9000 种可能

  let randomValue: number;

  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    // Web Crypto API (现代浏览器/Node.js)
    const array = new Uint16Array(1);
    globalThis.crypto.getRandomValues(array);
    // 使用取模确保均匀分布（略有偏差但对 4 位房间号可接受）
    randomValue = array[0] % range;
  } else {
    // Fallback: expo-crypto (React Native / Expo)
    const bytes = ExpoCrypto.getRandomBytes(2);
    const value = (bytes[0] << 8) | bytes[1];
    randomValue = value % range;
  }

  return (1000 + randomValue).toString();
}
