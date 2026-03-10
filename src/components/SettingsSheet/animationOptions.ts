/**
 * animationOptions — 动画选项配置注册表
 *
 * 每个动画强制包含 value / label / icon / shortDesc，TypeScript 保证字段完整性。
 * 新增动画只需在 ANIMATION_OPTIONS 数组加一项，`satisfies` 确保缺字段编译报错。
 * "随机"和"关闭"用布尔标记区分，UI 组件据此差异化渲染。
 *
 * 纯配置文件：不含 React / service / 副作用。
 */
import type { RoleRevealAnimation } from '@werewolf/game-engine/types/RoleRevealAnimation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * 动画选项配置（label + icon + shortDesc 缺一不可）
 *
 * - value: 对应 RoleRevealAnimation 枚举值
 * - label: 中文短名（2~4 字）
 * - icon:  Ionicons 名称
 * - shortDesc: 8~14 字效果描述
 * - isRandom / isNone: UI 差异化渲染标记
 */
export interface AnimationOptionConfig {
  readonly value: RoleRevealAnimation;
  readonly label: string;
  readonly icon: string;
  readonly shortDesc: string;
  readonly isRandom?: true;
  readonly isNone?: true;
}

// ---------------------------------------------------------------------------
// Registry — 新增动画在此追加，satisfies 保证字段完整
// ---------------------------------------------------------------------------

export const ANIMATION_OPTIONS = [
  {
    value: 'random',
    label: '随机',
    icon: 'shuffle-outline',
    shortDesc: '每局随机选择一种动画',
    isRandom: true,
  },
  {
    value: 'roulette',
    label: '轮盘',
    icon: 'radio-button-on-outline',
    shortDesc: '命运轮盘旋转揭示身份',
  },
  {
    value: 'roleHunt',
    label: '猎场',
    icon: 'search-outline',
    shortDesc: '探照灯扫描锁定目标',
  },
  {
    value: 'scratch',
    label: '刮卡',
    icon: 'hand-left-outline',
    shortDesc: '手指滑动刮开隐藏身份',
  },
  {
    value: 'tarot',
    label: '塔罗',
    icon: 'moon-outline',
    shortDesc: '塔罗牌翻转揭示命运',
  },
  {
    value: 'gachaMachine',
    label: '扭蛋',
    icon: 'baseball-outline',
    shortDesc: '投币旋转扭蛋机出球',
  },
  {
    value: 'cardPick',
    label: '抽牌',
    icon: 'copy-outline',
    shortDesc: '从牌堆中抽取一张牌',
  },
  {
    value: 'sealBreak',
    label: '封印',
    icon: 'shield-outline',
    shortDesc: '长按注入能量破除封印',
  },
  {
    value: 'chainShatter',
    label: '锁链',
    icon: 'link-outline',
    shortDesc: '拉拽击碎锁链释放身份',
  },
  {
    value: 'fateGears',
    label: '齿轮',
    icon: 'cog-outline',
    shortDesc: '命运齿轮转动揭开真相',
  },
  {
    value: 'none',
    label: '关闭',
    icon: 'close-circle-outline',
    shortDesc: '无动画，直接显示身份',
    isNone: true,
  },
] as const satisfies readonly AnimationOptionConfig[];

/** 通过 value 查找动画配置的 label（用于随机解析结果展示） */
export function getAnimationLabel(value: string): string | undefined {
  return ANIMATION_OPTIONS.find((opt) => opt.value === value)?.label;
}
