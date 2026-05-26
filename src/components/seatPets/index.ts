/**
 * seatPets -- Seat pet registry
 *
 * Each role-reveal effect (RoleRevealEffectId) maps to a companion pet.
 * After equipping a reveal animation, the corresponding pet appears at the
 * bottom-right of the seat and is visible to all players.
 * Pattern follows `seatFlairs/index.ts`.
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
  /** Chinese display name */
  name: string;
  /** SVG + Reanimated animation component */
  Component: React.ComponentType<PetProps>;
}

/**
 * Reveal effect -> seat pet map (exhaustive Record).
 * Adding a new ID to ROLE_REVEAL_EFFECT_IDS without adding it here causes a TS compile error.
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

/** All seat pets (order = ROLE_REVEAL_EFFECT_IDS) */
const SEAT_PETS: readonly (SeatPetConfig & { id: RoleRevealEffectId })[] =
  ROLE_REVEAL_EFFECT_IDS.map((id) => ({ id, ...PET_REGISTRY[id] }));

const PET_MAP = new Map<string, SeatPetConfig>(SEAT_PETS.map((p) => [p.id, p]));

/** Get seat pet config by reveal effect ID. Invalid / none / random -> undefined. */
export function getPetByEffectId(effectId: string | null | undefined): SeatPetConfig | undefined {
  if (!effectId) return undefined;
  return PET_MAP.get(effectId);
}
