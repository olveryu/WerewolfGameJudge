/**
 * seatPets — 座位宠物注册表
 *
 * 每个翻牌动画效果 (RoleRevealEffectId) 对应一个伴生宠物。
 * 装备翻牌动画后，座位右下角出现对应宠物，所有玩家可见。
 * Pattern 同 `seatFlairs/index.ts`。
 */
import {
  ROLE_REVEAL_EFFECT_IDS,
  type RoleRevealEffectId,
} from '@werewolf/game-engine/growth/rewardCatalog';
import type React from 'react';

import { CapsulePet } from './CapsulePet';
import { CardSpritePet } from './CardSpritePet';
import { ChainDragonPet } from './ChainDragonPet';
import { CrystalPet } from './CrystalPet';
import { DicePet } from './DicePet';
import { FilmBugPet } from './FilmBugPet';
import { HoundPet } from './HoundPet';
import { LuckyStarPet } from './LuckyStarPet';
import { MeteorBuddyPet } from './MeteorBuddyPet';
import type { PetProps } from './PetProps';
import { ScratchCatPet } from './ScratchCatPet';
import { SealBeastPet } from './SealBeastPet';
import { VortexEyePet } from './VortexEyePet';

interface SeatPetConfig {
  /** 中文显示名 */
  name: string;
  /** SVG + Reanimated 动画组件 */
  Component: React.ComponentType<PetProps>;
}

/**
 * 翻牌动画 → 座位宠物映射（exhaustive Record）。
 * ROLE_REVEAL_EFFECT_IDS 新增 ID 而此处未添加 → TS 编译报错。
 */
const PET_REGISTRY: Record<RoleRevealEffectId, SeatPetConfig> = {
  roulette: { name: '骰灵', Component: DicePet },
  roleHunt: { name: '猎犬', Component: HoundPet },
  scratch: { name: '刮刮猫', Component: ScratchCatPet },
  tarot: { name: '水晶球', Component: CrystalPet },
  gachaMachine: { name: '蛋仔', Component: CapsulePet },
  cardPick: { name: '牌灵', Component: CardSpritePet },
  sealBreak: { name: '印兽', Component: SealBeastPet },
  chainShatter: { name: '锁龙', Component: ChainDragonPet },
  fortuneWheel: { name: '幸运星', Component: LuckyStarPet },
  meteorStrike: { name: '陨石仔', Component: MeteorBuddyPet },
  filmRewind: { name: '胶片虫', Component: FilmBugPet },
  vortexCollapse: { name: '漩涡眼', Component: VortexEyePet },
};

/** 所有座位宠物列表（顺序 = ROLE_REVEAL_EFFECT_IDS） */
const SEAT_PETS: readonly (SeatPetConfig & { id: RoleRevealEffectId })[] =
  ROLE_REVEAL_EFFECT_IDS.map((id) => ({ id, ...PET_REGISTRY[id] }));

const PET_MAP = new Map<string, SeatPetConfig>(SEAT_PETS.map((p) => [p.id, p]));

/** 按翻牌动画效果 ID 获取座位宠物配置。无效 / none / random → undefined。 */
export function getPetByEffectId(effectId: string | null | undefined): SeatPetConfig | undefined {
  if (!effectId) return undefined;
  return PET_MAP.get(effectId);
}
