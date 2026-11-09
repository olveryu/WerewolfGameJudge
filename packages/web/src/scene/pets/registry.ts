/**
 * Seat pet registry: one spec loader per catalog role reveal effect id, since the previous
 * client keyed each companion by the equipped reveal effect. Every pet is its own lazy chunk
 * (the three mythic collection pets share one), loaded the first time a seat shows it. The map
 * is exhaustive over the catalog; loading checks the spec's id.
 */
import type { RoleRevealEffectId } from '@game-judge/game-engine/product/rewards';

import type { DecorationSpec } from '@/scene/decoration';

const PET_LOADERS: Record<RoleRevealEffectId, () => Promise<DecorationSpec>> = {
  fateDecree: () => import('./nightRaven').then((module) => module.nightRavenPet),
  fateReweave: () => import('./mythicCollection').then((module) => module.starShuttlePet),
  oceanPearl: () => import('./mythicCollection').then((module) => module.pearlRayPet),
  unfoldLandscape: () => import('./mythicCollection').then((module) => module.paintedCranePet),
  roulette: () => import('./dice').then((module) => module.dicePet),
  roleHunt: () => import('./hound').then((module) => module.houndPet),
  scratch: () => import('./scratchCat').then((module) => module.scratchCatPet),
  tarot: () => import('./crystal').then((module) => module.crystalPet),
  gachaMachine: () => import('./capsule').then((module) => module.capsulePet),
  cardPick: () => import('./cardSprite').then((module) => module.cardSpritePet),
  sealBreak: () => import('./sealBeast').then((module) => module.sealBeastPet),
  chainShatter: () => import('./chainDragon').then((module) => module.chainDragonPet),
  fortuneWheel: () => import('./luckyStar').then((module) => module.luckyStarPet),
  meteorStrike: () => import('./meteorBuddy').then((module) => module.meteorBuddyPet),
  filmRewind: () => import('./filmBug').then((module) => module.filmBugPet),
  vortexCollapse: () => import('./vortexEye').then((module) => module.vortexEyePet),
};

const loadedPets = new Map<RoleRevealEffectId, Promise<DecorationSpec>>();

/**
 * The pet of reveal effect `id`, loaded once and shared (a stable promise for `use()`). Rejects
 * when its chunk fails to load or holds a spec registered under another id.
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
