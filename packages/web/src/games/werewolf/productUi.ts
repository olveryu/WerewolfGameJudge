/** Werewolf-owned presentation for product rewards with Werewolf semantics. */
import { getRoleDisplayName } from '@game-judge/game-engine/games/werewolf/public';
import { HAND_DRAWN_AVATAR_IDS } from '@game-judge/game-engine/product/rewards';

import type { IoniconName } from '@/components/icons/IonIcon';
import type {
  GameProductUiContribution,
  RevealEffectSelectionId,
} from '@/features/product/model/GameProductUi';
import { WerewolfRevealEffectPreview } from '@/games/werewolf/components/WerewolfRevealEffectPreview';

interface RevealEffectOption {
  readonly label: string;
  readonly icon: IoniconName;
  readonly shortDescription: string;
  readonly petName: string | null;
}

/** Every reveal effect plus `none` / `random`; the record type enforces completeness. */
const REVEAL_EFFECT_OPTIONS: Readonly<Record<RevealEffectSelectionId, RevealEffectOption>> = {
  fateReweave: {
    label: '命盘重构',
    icon: 'planet-outline',
    shortDescription: '星盘解构，经纬重织揭晓身份',
    petName: '天机星梭',
  },
  oceanPearl: {
    label: '万海开珠',
    icon: 'water-outline',
    shortDescription: '潮退贝开，明珠照出身份',
    petName: '流珠鳐',
  },
  unfoldLandscape: {
    label: '长卷开天',
    icon: 'brush-outline',
    shortDescription: '山河长卷舒展，朱印落定身份',
    petName: '丹青纸鹤',
  },
  fateDecree: {
    label: '命运敕令',
    icon: 'ribbon-outline',
    shortDescription: '银冠封印解开，永夜卷轴展开揭晓身份',
    petName: '永夜渡鸦',
  },
  random: {
    label: '随机',
    icon: 'shuffle-outline',
    shortDescription: '每局随机一种揭晓动画',
    petName: null,
  },
  none: {
    label: '关闭',
    icon: 'close-circle-outline',
    shortDescription: '跳过动画，直接显示身份',
    petName: null,
  },
  roulette: {
    label: '轮盘',
    icon: 'radio-button-on-outline',
    shortDescription: '自动旋转，轮盘停下揭晓身份',
    petName: '骰灵',
  },
  roleHunt: {
    label: '猎场',
    icon: 'search-outline',
    shortDescription: '点击目标，探照灯锁定揭晓身份',
    petName: '猎犬',
  },
  scratch: {
    label: '刮卡',
    icon: 'hand-left-outline',
    shortDescription: '手指滑动刮开银层，揭晓身份',
    petName: '刮刮猫',
  },
  tarot: {
    label: '塔罗',
    icon: 'moon-outline',
    shortDescription: '选一张塔罗牌翻开，揭晓身份',
    petName: '水晶球',
  },
  gachaMachine: {
    label: '扭蛋',
    icon: 'baseball-outline',
    shortDescription: '转动旋钮，扭蛋掉落揭晓身份',
    petName: '蛋仔',
  },
  cardPick: {
    label: '抽牌',
    icon: 'copy-outline',
    shortDescription: '从牌堆点选一张，翻开揭晓身份',
    petName: '牌灵',
  },
  sealBreak: {
    label: '封印',
    icon: 'shield-outline',
    shortDescription: '长按蓄力，破除封印揭晓身份',
    petName: '印兽',
  },
  chainShatter: {
    label: '锁链',
    icon: 'link-outline',
    shortDescription: '连续点击 6 次，击碎锁链揭晓身份',
    petName: '锁龙',
  },
  fortuneWheel: {
    label: '转盘',
    icon: 'pie-chart-outline',
    shortDescription: '拨动转盘旋转，命运指针定格揭晓',
    petName: '幸运星',
  },
  meteorStrike: {
    label: '流星',
    icon: 'flash-outline',
    shortDescription: '点击捕获流星，冲击波揭晓身份',
    petName: '陨石仔',
  },
  filmRewind: {
    label: '胶片',
    icon: 'film-outline',
    shortDescription: '老胶片倒数放映，自动揭晓身份',
    petName: '胶片虫',
  },
  vortexCollapse: {
    label: '漩涡',
    icon: 'planet-outline',
    shortDescription: '画圈加速漩涡旋转，坍缩爆发揭晓',
    petName: '漩涡眼',
  },
};

function isRevealEffectSelectionId(id: string): id is RevealEffectSelectionId {
  return Object.hasOwn(REVEAL_EFFECT_OPTIONS, id);
}

const WEREWOLF_AVATAR_IDS: ReadonlySet<string> = new Set(HAND_DRAWN_AVATAR_IDS);

const MYTHIC_AVATAR_NAMES: Readonly<Record<string, string>> = {
  nightSovereign: '永夜君主',
  fateWeaver: '司命星官',
  tidePriestess: '沧溟鲛姬',
  inkImmortal: '执笔谪仙',
};

/** Names the hand-drawn role avatars and presents the role reveal effects. */
export const werewolfProductUi: GameProductUiContribution = {
  getAvatarDisplayName(avatarId) {
    const mythicName = MYTHIC_AVATAR_NAMES[avatarId];
    if (mythicName !== undefined) return mythicName;
    return WEREWOLF_AVATAR_IDS.has(avatarId) ? getRoleDisplayName(avatarId) : null;
  },
  getRevealEffectPresentation(effectId) {
    if (!isRevealEffectSelectionId(effectId)) return null;
    return {
      id: effectId,
      ...REVEAL_EFFECT_OPTIONS[effectId],
      Preview: WerewolfRevealEffectPreview,
    };
  },
};
