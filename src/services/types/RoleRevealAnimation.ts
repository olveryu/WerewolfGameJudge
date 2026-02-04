/**
 * RoleRevealAnimation - 角色揭示动画类型定义
 *
 * 纯类型文件，无运行时代码。
 * 所有需要此类型的文件都应从此处 import。
 */

/**
 * 角色揭示动画类型
 * - roulette: 轮盘动画
 * - flip: 翻牌动画
 * - scratch: 刮刮卡动画
 * - fragment: 碎片聚合动画
 * - fog: 迷雾消散动画
 * - none: 无动画（简单卡片）
 */
export type RoleRevealAnimation =
  | 'roulette'
  | 'flip'
  | 'scratch'
  | 'fragment'
  | 'fog'
  | 'none';
