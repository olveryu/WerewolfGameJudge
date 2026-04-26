/**
 * seatAnimations — 入座动画注册表
 *
 * SeatAnimationId 类型从 `@werewolf/game-engine/growth/rewardCatalog` 的 SEAT_ANIMATION_IDS 派生。
 * 通过 getSeatAnimationById 按 id 获取对应的 Reanimated 动画组件。
 * 结构同 `seatFlairs/index.ts`。
 */
import {
  SEAT_ANIMATION_IDS,
  type SeatAnimationId,
} from '@werewolf/game-engine/growth/rewardCatalog';
import type React from 'react';

import { COMMON_ANIMATION_ENTRIES, RARE_ANIMATION_ENTRIES } from './common';
import { EPIC_ANIMATION_ENTRIES } from './epic';
import { BloodMoonRise } from './legendary/BloodMoonRise';
import { CardReveal } from './legendary/CardReveal';
import { DawnBreak } from './legendary/DawnBreak';
import { GuardShield } from './legendary/GuardShield';
import { HunterShot } from './legendary/HunterShot';
import { NightFall } from './legendary/NightFall';
import { SeerVision } from './legendary/SeerVision';
import { SpiritSummon } from './legendary/SpiritSummon';
import { WitchBrew } from './legendary/WitchBrew';
import { WolfKingEntry } from './legendary/WolfKingEntry';
import type { SeatAnimationProps } from './SeatAnimationProps';

interface SeatAnimationConfig {
  /** 中文显示名 */
  name: string;
  /** Reanimated 入座动画组件 */
  Component: React.ComponentType<SeatAnimationProps>;
}

/**
 * 入座动画注册表（exhaustive Record）—— SEAT_ANIMATION_IDS 新增 ID 而此处未添加 → TS 编译报错。
 * UI 展示顺序跟随 SEAT_ANIMATION_IDS。
 * Legendary 手动列举；Common/Rare/Epic 从各自 factory 展开。
 */
function buildAnimationRegistry(): Record<SeatAnimationId, SeatAnimationConfig> {
  const legendaryEntries: Record<string, SeatAnimationConfig> = {
    wolfKingEntry: { name: '狼王登场', Component: WolfKingEntry },
    witchBrew: { name: '女巫秘药', Component: WitchBrew },
    seerVision: { name: '预言之眼', Component: SeerVision },
    hunterShot: { name: '猎人开枪', Component: HunterShot },
    guardShield: { name: '守卫之盾', Component: GuardShield },
    nightFall: { name: '夜幕降临', Component: NightFall },
    dawnBreak: { name: '破晓黎明', Component: DawnBreak },
    bloodMoonRise: { name: '血月升起', Component: BloodMoonRise },
    spiritSummon: { name: '灵魂召唤', Component: SpiritSummon },
    cardReveal: { name: '翻牌登场', Component: CardReveal },
  };
  return {
    ...legendaryEntries,
    ...EPIC_ANIMATION_ENTRIES,
    ...COMMON_ANIMATION_ENTRIES,
    ...RARE_ANIMATION_ENTRIES,
  } as Record<SeatAnimationId, SeatAnimationConfig>;
}
const ANIMATION_REGISTRY = buildAnimationRegistry();

/** 所有可用入座动画（顺序 = SEAT_ANIMATION_IDS 展示顺序） */
export const SEAT_ANIMATIONS: readonly (SeatAnimationConfig & { id: SeatAnimationId })[] =
  SEAT_ANIMATION_IDS.map((id) => ({ id, ...ANIMATION_REGISTRY[id] }));

const ANIMATION_MAP = new Map<string, SeatAnimationConfig>(SEAT_ANIMATIONS.map((a) => [a.id, a]));

/** 按 id 获取入座动画配置。无效 id 返回 undefined。 */
export function getSeatAnimationById(
  id: string | null | undefined,
): SeatAnimationConfig | undefined {
  if (!id) return undefined;
  return ANIMATION_MAP.get(id);
}
