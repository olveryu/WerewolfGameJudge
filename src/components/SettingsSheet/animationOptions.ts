/**
 * animationOptions — animation option config registry
 *
 * Each animation requires value / label / icon / shortDesc; TypeScript enforces completeness.
 * To add an animation, append one entry to the ANIMATION_OPTIONS array; `satisfies` raises a compile error on missing fields.
 * "Random" and "Off" are distinguished via boolean flags; UI components render differently based on them.
 *
 * Pure config file: no React / service / side effects.
 */
import type { RoleRevealAnimation } from '@werewolf/game-engine/types/RoleRevealAnimation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AnimationOptionConfig {
  readonly value: RoleRevealAnimation;
  readonly label: string;
  readonly icon: string;
  readonly shortDesc: string;
  readonly operationType?: string;
  /** Pet name shown at the seat after equipping (none / random have no pet) */
  readonly petName?: string;
  readonly isRandom?: true;
  readonly isNone?: true;
}

// ---------------------------------------------------------------------------
// Registry — append new animations here; satisfies enforces required fields
// ---------------------------------------------------------------------------

const ANIMATION_OPTIONS = [
  {
    value: 'random',
    label: '随机',
    icon: 'shuffle-outline',
    shortDesc: '每局随机一种揭晓动画',
    isRandom: true,
  },
  {
    value: 'none',
    label: '关闭',
    icon: 'close-circle-outline',
    shortDesc: '跳过动画，直接显示身份',
    isNone: true,
  },
  {
    value: 'roulette',
    label: '轮盘',
    icon: 'radio-button-on-outline',
    shortDesc: '自动旋转，轮盘停下揭晓身份',
    operationType: 'auto',
    petName: '骰灵',
  },
  {
    value: 'roleHunt',
    label: '猎场',
    icon: 'search-outline',
    shortDesc: '点击目标，探照灯锁定揭晓身份',
    operationType: 'tap',
    petName: '猎犬',
  },
  {
    value: 'scratch',
    label: '刮卡',
    icon: 'hand-left-outline',
    shortDesc: '手指滑动刮开银层，揭晓身份',
    operationType: 'swipe',
    petName: '刮刮猫',
  },
  {
    value: 'tarot',
    label: '塔罗',
    icon: 'moon-outline',
    shortDesc: '选一张塔罗牌翻开，揭晓身份',
    operationType: 'tap',
    petName: '水晶球',
  },
  {
    value: 'gachaMachine',
    label: '扭蛋',
    icon: 'baseball-outline',
    shortDesc: '转动旋钮，扭蛋掉落揭晓身份',
    operationType: 'tap',
    petName: '蛋仔',
  },
  {
    value: 'cardPick',
    label: '抽牌',
    icon: 'copy-outline',
    shortDesc: '从牌堆点选一张，翻开揭晓身份',
    operationType: 'tap',
    petName: '牌灵',
  },
  {
    value: 'sealBreak',
    label: '封印',
    icon: 'shield-outline',
    shortDesc: '长按蓄力，破除封印揭晓身份',
    operationType: 'hold',
    petName: '印兽',
  },
  {
    value: 'chainShatter',
    label: '锁链',
    icon: 'link-outline',
    shortDesc: '连续点击 6 次，击碎锁链揭晓身份',
    operationType: 'combo',
    petName: '锁龙',
  },
  {
    value: 'fortuneWheel',
    label: '转盘',
    icon: 'pie-chart-outline',
    shortDesc: '拨动转盘旋转，命运指针定格揭晓',
    operationType: 'drag',
    petName: '幸运星',
  },
  {
    value: 'meteorStrike',
    label: '流星',
    icon: 'flash-outline',
    shortDesc: '点击捕获流星，冲击波揭晓身份',
    operationType: 'tap',
    petName: '陨石仔',
  },
  {
    value: 'filmRewind',
    label: '胶片',
    icon: 'film-outline',
    shortDesc: '老胶片倒数放映，自动揭晓身份',
    operationType: 'auto',
    petName: '胶片虫',
  },
  {
    value: 'vortexCollapse',
    label: '漩涡',
    icon: 'planet-outline',
    shortDesc: '画圈加速漩涡旋转，坍缩爆发揭晓',
    operationType: 'drag',
    petName: '漩涡眼',
  },
] as const satisfies readonly AnimationOptionConfig[];

/** value -> config fast lookup index */
const ANIMATION_OPTIONS_BY_VALUE: ReadonlyMap<string, (typeof ANIMATION_OPTIONS)[number]> = new Map(
  ANIMATION_OPTIONS.map((o) => [o.value, o]),
);

/** Look up animation config by value. Includes random/none. */
export function getAnimationOption(value: string): (typeof ANIMATION_OPTIONS)[number] | undefined {
  return ANIMATION_OPTIONS_BY_VALUE.get(value);
}
