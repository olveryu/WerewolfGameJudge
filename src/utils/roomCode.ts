/**
 * roomCode - Room code generation utilities
 *
 * 统一的房间号生成入口，确保所有创建房间路径使用相同的生成逻辑
 * 全链路使用安全随机，复用 random.ts 的 secureRng
 *
 * ✅ 允许：生成 4 位房间号
 * ❌ 禁止：import React / service / Math.random() / 自建 crypto 降级逻辑
 */

import { secureRng } from './random';

/**
 * 生成 4 位房间号（1000-9999）
 *
 * 复用 secureRng（内部已处理 Web Crypto / expo-crypto 降级）
 *
 * @returns 4 位数字字符串，范围 1000-9999
 */
export function generateRoomCode(): string {
  const range = 9000; // 9999 - 1000 + 1 = 9000 种可能
  const randomValue = Math.floor(secureRng() * range);
  return (1000 + randomValue).toString();
}
