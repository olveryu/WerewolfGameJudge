/**
 * 角色揭示动画的泛型数据类型。
 *
 * 与游戏无关，各游戏将自己的角色数据转为此格式。
 * 狼人杀：RoleData → RevealRoleData（适配器）
 * 阿瓦隆：AvalonRoleId → RevealRoleData（直接构造）
 */

import type { ImageSourcePropType } from 'react-native';

/**
 * 角色阵营（用于视觉主题：辉光/粒子/渐变色）
 * 狼人杀：wolf/god/villager/third
 * 阿瓦隆：evil → wolf（红），good → god（蓝）
 */
export type RevealAlignment = 'wolf' | 'god' | 'villager' | 'third';

export interface RevealRoleData {
  /** 角色唯一标识（各游戏自己的 ID，如 'merlin'、'werewolf'） */
  readonly id: string;
  /** 显示名（中文） */
  readonly name: string;
  /** 阵营（用于视觉主题） */
  readonly alignment: RevealAlignment;
  /** 立绘（可选，无图时显示阵营色卡背） */
  readonly image?: ImageSourcePropType;
  /** 角色描述（可选） */
  readonly description?: string;
  /** 阵营名（显示用，如"好人"/"坏人"） */
  readonly factionName?: string;
}
