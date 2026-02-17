/**
 * RoleRevealAnimation - 角色揭示动画类型定义
 *
 * 纯类型文件，无运行时代码。
 * 所有需要此类型的文件都应从此处 import。
 */

/**
 * 角色揭示动画配置类型（包含 random）
 * - roulette: 轮盘动画
 * - flip: 翻牌动画
 * - scratch: 刮刮卡动画
 * - tarot: 塔罗牌抽取动画
 * - gachaMachine: 扭蛋机动画
 * - none: 无动画（简单卡片）
 * - random: 随机选择（Host 解析后广播）
 */
export type RoleRevealAnimation =
  | 'roulette'
  | 'flip'
  | 'scratch'
  | 'tarot'
  | 'gachaMachine'
  | 'cardPick'
  | 'none'
  | 'random';

/**
 * 解析后的角色揭示动画类型（不含 random）
 * - Host 解析 random 后得到的实际动画
 * - 客户端只使用此类型渲染
 */
export type ResolvedRoleRevealAnimation =
  | 'roulette'
  | 'flip'
  | 'scratch'
  | 'tarot'
  | 'gachaMachine'
  | 'cardPick'
  | 'none';

/**
 * 可随机选择的动画类型（不含 none 和 random）
 */
export type RandomizableAnimation =
  | 'roulette'
  | 'flip'
  | 'scratch'
  | 'tarot'
  | 'gachaMachine'
  | 'cardPick';

/**
 * 可随机选择的动画数组（用于 random 解析）
 */
export const RANDOMIZABLE_ANIMATIONS: readonly RandomizableAnimation[] = [
  'roulette',
  'flip',
  'scratch',
  'tarot',
  'gachaMachine',
  'cardPick',
] as const;

/**
 * 确定性 hash 函数（用于 random 解析）
 * 使用简单的 djb2 算法，不依赖外部库
 */
export function simpleHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    const codePoint = str.codePointAt(i) ?? 0;
    hash = (hash * 33) ^ codePoint;
  }
  return hash >>> 0; // 确保为正整数
}

/**
 * 根据 seed 解析 random 为具体动画
 * @param seed 稳定的 seed 字符串（如 roomNumber:templateId:revision）
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
  return RANDOMIZABLE_ANIMATIONS[index];
}
