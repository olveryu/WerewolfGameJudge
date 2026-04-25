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

interface AnimationOptionConfig {
  readonly value: RoleRevealAnimation;
  readonly label: string;
  readonly icon: string;
  readonly shortDesc: string;
  readonly operationType?: string;
  readonly isRandom?: true;
  readonly isNone?: true;
}

// ---------------------------------------------------------------------------
// Registry — 新增动画在此追加，satisfies 保证字段完整
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
    value: 'fortuneWheel',
    label: '转盘',
    icon: 'pie-chart-outline',
    shortDesc: '拨动转盘旋转，命运指针定格揭晓',
    operationType: 'drag',
  },
  {
    value: 'meteorStrike',
    label: '流星',
    icon: 'flash-outline',
    shortDesc: '点击捕获流星，冲击波揭晓身份',
    operationType: 'tap',
  },
  {
    value: 'filmRewind',
    label: '胶片',
    icon: 'film-outline',
    shortDesc: '老胶片倒数放映，自动揭晓身份',
    operationType: 'auto',
  },
  {
    value: 'vortexCollapse',
    label: '漩涡',
    icon: 'planet-outline',
    shortDesc: '画圈加速漩涡旋转，坍缩爆发揭晓',
    operationType: 'drag',
  },
] as const satisfies readonly AnimationOptionConfig[];

/** value → config 快速查找索引 */
const ANIMATION_OPTIONS_BY_VALUE: ReadonlyMap<string, (typeof ANIMATION_OPTIONS)[number]> = new Map(
  ANIMATION_OPTIONS.map((o) => [o.value, o]),
);

/** 按 value 查找动画配置。random/none 也在内。 */
export function getAnimationOption(value: string): (typeof ANIMATION_OPTIONS)[number] | undefined {
  return ANIMATION_OPTIONS_BY_VALUE.get(value);
}
