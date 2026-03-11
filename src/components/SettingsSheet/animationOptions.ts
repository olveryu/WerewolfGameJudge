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
/**
 * 操作类型标签，用于 UI badge 展示
 *
 * auto=自动播放 | tap=点击 | swipe=滑动 | hold=长按 | combo=连击 | drag=拖拽
 */
export type OperationType = 'auto' | 'tap' | 'swipe' | 'hold' | 'combo' | 'drag';

export interface AnimationOptionConfig {
  readonly value: RoleRevealAnimation;
  readonly label: string;
  readonly icon: string;
  readonly shortDesc: string;
  /** 操作方式标签（badge 展示），random/none 不需要 */
  readonly operationType?: OperationType;
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
    shortDesc: '每局随机一种揭晓动画',
    isRandom: true,
  },
  {
    value: 'roulette',
    label: '轮盘',
    icon: 'radio-button-on-outline',
    shortDesc: '自动旋转，轮盘停下揭晓身份',
    operationType: 'auto',
  },
  {
    value: 'roleHunt',
    label: '猎场',
    icon: 'search-outline',
    shortDesc: '点击目标，探照灯锁定揭晓身份',
    operationType: 'tap',
  },
  {
    value: 'scratch',
    label: '刮卡',
    icon: 'hand-left-outline',
    shortDesc: '手指滑动刮开银层，揭晓身份',
    operationType: 'swipe',
  },
  {
    value: 'tarot',
    label: '塔罗',
    icon: 'moon-outline',
    shortDesc: '选一张塔罗牌翻开，揭晓身份',
    operationType: 'tap',
  },
  {
    value: 'gachaMachine',
    label: '扭蛋',
    icon: 'baseball-outline',
    shortDesc: '转动旋钮，扭蛋掉落揭晓身份',
    operationType: 'tap',
  },
  {
    value: 'cardPick',
    label: '抽牌',
    icon: 'copy-outline',
    shortDesc: '从牌堆点选一张，翻开揭晓身份',
    operationType: 'tap',
  },
  {
    value: 'sealBreak',
    label: '封印',
    icon: 'shield-outline',
    shortDesc: '长按蓄力，破除封印揭晓身份',
    operationType: 'hold',
  },
  {
    value: 'chainShatter',
    label: '锁链',
    icon: 'link-outline',
    shortDesc: '连续点击 6 次，击碎锁链揭晓身份',
    operationType: 'combo',
  },
  {
    value: 'fateGears',
    label: '齿轮',
    icon: 'cog-outline',
    shortDesc: '拖拽齿轮对准标记，揭晓身份',
    operationType: 'drag',
  },
  {
    value: 'none',
    label: '关闭',
    icon: 'close-circle-outline',
    shortDesc: '跳过动画，直接显示身份',
    isNone: true,
  },
] as const satisfies readonly AnimationOptionConfig[];

/** 操作类型 → 中文标签（badge 展示用） */
export const OPERATION_TYPE_LABELS: Record<OperationType, string> = {
  auto: '自动',
  tap: '点击',
  swipe: '滑动',
  hold: '长按',
  combo: '连击',
  drag: '拖拽',
} as const;

/** 通过 value 查找动画配置的 label（用于随机解析结果展示） */
export function getAnimationLabel(value: string): string | undefined {
  return ANIMATION_OPTIONS.find((opt) => opt.value === value)?.label;
}
