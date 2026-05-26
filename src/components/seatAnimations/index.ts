/**
 * seatAnimations — sit animation registry.
 *
 * SeatAnimationId type is derived from SEAT_ANIMATION_IDS in `@werewolf/game-engine/growth/rewardCatalog`.
 * Use getSeatAnimationById to look up the corresponding Reanimated animation component by id.
 * Structure mirrors `seatFlairs/index.ts`.
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
  /** Chinese display name */
  name: string;
  /** Reanimated sit animation component */
  Component: React.ComponentType<SeatAnimationProps>;
}

/**
 * Sit animation registry (exhaustive Record) — TS will fail to compile if SEAT_ANIMATION_IDS gains a new id not added here.
 * UI display order follows SEAT_ANIMATION_IDS.
 * Legendary entries are listed manually; Common/Rare/Epic are spread from their respective factories.
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

/** All available sit animations (order = SEAT_ANIMATION_IDS display order) */
export const SEAT_ANIMATIONS: readonly (SeatAnimationConfig & { id: SeatAnimationId })[] =
  SEAT_ANIMATION_IDS.map((id) => ({ id, ...ANIMATION_REGISTRY[id] }));

const ANIMATION_MAP = new Map<string, SeatAnimationConfig>(SEAT_ANIMATIONS.map((a) => [a.id, a]));

/** Look up sit animation config by id. Returns undefined for invalid id. */
export function getSeatAnimationById(
  id: string | null | undefined,
): SeatAnimationConfig | undefined {
  if (!id) return undefined;
  return ANIMATION_MAP.get(id);
}
