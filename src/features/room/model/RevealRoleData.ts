/**
 * 角色揭示动画的泛型数据类型。
 *
 * 与游戏无关，各游戏将自己的角色数据转为此格式。
 * 狼人杀：RoleData → RevealRoleData（适配器）
 * 阿瓦隆：AvalonRoleId → RevealRoleData（直接构造）
 */

import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ImageSourcePropType } from 'react-native';

/**
 * 角色阵营（用于视觉主题：辉光/粒子/渐变色）
 * 狼人杀：wolf/god/villager/third
 * 阿瓦隆：evil → wolf（红），good → god（蓝）
 * neutral：中立灰，用于身份本身不可见的场景（如谁是卧底的词卡），
 * 不暗示任何阵营。
 */
export type RevealAlignment = 'wolf' | 'god' | 'villager' | 'third' | 'neutral';

/**
 * 结构化描述字段（如"主动技能：..."）。
 * 狼人杀：6 字段（主动技能/被动特性/触发效果/限制条件/特殊规则/胜利条件）
 * 阿瓦隆：多字段（主动技能/被动特性/触发效果/限制条件/特殊规则/胜利条件）
 */
export interface DescriptionField {
  readonly label: string;
  readonly content: string;
  /** Ionicons 图标名（可选） */
  readonly icon?: React.ComponentProps<typeof Ionicons>['name'];
  /** 测试定位（可选）：渲染到该字段的内容行，供单测/e2e 精确定位。 */
  readonly testID?: string;
  /** 正文测试定位（可选）：渲染到包裹正文的容器，粒度比整行更细。 */
  readonly contentTestID?: string;
  /**
   * 语义色调（影响 accent bar 和标签颜色）。
   * - default: 阵营色
   * - warning: 警告色（用于"限制条件"）
   * - success: 成功色（用于"胜利条件"）
   */
  readonly tone?: 'default' | 'warning' | 'success';
}

export interface RevealRoleData {
  /** 角色唯一标识（各游戏自己的 ID，如 'merlin'、'werewolf'） */
  readonly id: string;
  /** 显示名（中文） */
  readonly name: string;
  /** 阵营（用于视觉主题） */
  readonly alignment: RevealAlignment;
  /** 立绘（可选，无图时显示阵营色卡背） */
  readonly image?: ImageSourcePropType;
  /**
   * 角色描述：结构化字段数组，或简单字符串。
   * 结构化：狼人杀/阿瓦隆多字段；简单：单段文本（居中显示）。
   */
  readonly description?: readonly DescriptionField[] | string;
  /** 阵营名（显示用，如"好人"/"坏人"） */
  readonly factionName?: string;
}
