/**
 * Seat pet registry: one spec loader per catalog role reveal effect id, since the previous
 * client keyed each companion by the equipped reveal effect. Code is statically imported; specs
 * are prepared and cached on demand. The map is exhaustive; preparation checks the spec's id.
 */
import type { RoleRevealEffectId } from '@game-judge/game-engine/product/rewards';

import type { DecorationSpec } from '@/scene/decoration';

import { capsulePet } from './capsule';
import { cardSpritePet } from './cardSprite';
import { chainDragonPet } from './chainDragon';
import { crystalPet } from './crystal';
import { dicePet } from './dice';
import { filmBugPet } from './filmBug';
import { houndPet } from './hound';
import { luckyStarPet } from './luckyStar';
import { meteorBuddyPet } from './meteorBuddy';
import { paintedCranePet, pearlRayPet, starShuttlePet } from './mythicCollection';
import { nightRavenPet } from './nightRaven';
import { scratchCatPet } from './scratchCat';
import { sealBeastPet } from './sealBeast';
import { vortexEyePet } from './vortexEye';

const PET_LOADERS: Record<RoleRevealEffectId, () => Promise<DecorationSpec>> = {
  fateDecree: async () => nightRavenPet,
  fateReweave: async () => starShuttlePet,
  oceanPearl: async () => pearlRayPet,
  unfoldLandscape: async () => paintedCranePet,
  roulette: async () => dicePet,
  roleHunt: async () => houndPet,
  scratch: async () => scratchCatPet,
  tarot: async () => crystalPet,
  gachaMachine: async () => capsulePet,
  cardPick: async () => cardSpritePet,
  sealBreak: async () => sealBeastPet,
  chainShatter: async () => chainDragonPet,
  fortuneWheel: async () => luckyStarPet,
  meteorStrike: async () => meteorBuddyPet,
  filmRewind: async () => filmBugPet,
  vortexCollapse: async () => vortexEyePet,
};

const loadedPets = new Map<RoleRevealEffectId, Promise<DecorationSpec>>();

/**
 * The pet of reveal effect `id`, loaded once and shared (a stable promise for `use()`). Rejects
 * when preparation fails or the spec is registered under another id.
 */
export function loadPetSpec(id: RoleRevealEffectId): Promise<DecorationSpec> {
  let spec = loadedPets.get(id);
  if (!spec) {
    spec = PET_LOADERS[id]().then((loaded) => {
      if (loaded.id !== id) {
        throw new Error(`Seat pet spec "${loaded.id}" is registered under "${id}"`);
      }
      return loaded;
    });
    loadedPets.set(id, spec);
  }
  return spec;
}
