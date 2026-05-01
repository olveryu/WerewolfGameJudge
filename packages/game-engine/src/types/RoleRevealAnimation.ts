/**
 * RoleRevealAnimation - 角色揭示动画类型定义
 *
 * 类型 + resolveRandomAnimation 工具函数。
 * 权威 ID 列表来自 `rewardCatalog.ts`（ROLE_REVEAL_EFFECT_IDS），本文件派生类型。
 */

import { ROLE_REVEAL_EFFECT_IDS, type RoleRevealEffectId } from '../growth/rewardCatalog';

/**
 * 可随机选择的动画类型（不含 none 和 random）。
 * 从 rewardCatalog 的 ROLE_REVEAL_EFFECT_IDS 派生，保证单一权威来源。
 */
export type RandomizableAnimation = RoleRevealEffectId;

/** 角色揭示动画配置类型（包含 random / none） */
export type RoleRevealAnimation = RandomizableAnimation | 'none' | 'random';

/** 解析后的角色揭示动画类型（不含 random） */
export type ResolvedRoleRevealAnimation = RandomizableAnimation | 'none';

/**
 * 可随机选择的动画数组（用于 random 解析）。
 * 从 ROLE_REVEAL_EFFECT_IDS 派生，不再独立维护。
 */
export const RANDOMIZABLE_ANIMATIONS: readonly RandomizableAnimation[] = ROLE_REVEAL_EFFECT_IDS;

/**
 * 确定性 hash 函数（用于 random 解析）
 * 使用简单的 djb2 算法，不依赖外部库
 */
function simpleHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    const codePoint = str.codePointAt(i) ?? 0;
    hash = (hash * 33) ^ codePoint;
  }
  return hash >>> 0; // 确保为正整数
}

/**
 * 根据 seed 解析 random 为具体动画
 * @param seed 稳定的 seed 字符串（如 roomCode:templateId:revision）
 * @param previous 上一次使用的动画，若命中则 +1 跳过（仍然确定性）
 * @returns 解析后的动画类型
 */
export function resolveRandomAnimation(
  seed: string,
  previous?: RandomizableAnimation,
): RandomizableAnimation {
  const len = RANDOMIZABLE_ANIMATIONS.length;
  let index = simpleHash(seed) % len;
  if (previous != null && RANDOMIZABLE_ANIMATIONS[index] === previous) {
    index = (index + 1) % len;
  }
  return RANDOMIZABLE_ANIMATIONS[index]!;
}
