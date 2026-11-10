/**
 * Reveal effect registry: one component loader per catalog reveal effect id. Each effect is its own
 * lazy chunk (the three mythic collection reveals share one), so neither the room chunk nor the
 * scene chunk carries any effect. The `satisfies` clause fails the build when a catalog id has no
 * loader.
 */
import type { ComponentType } from 'react';

import type { RevealEffectProps, RevealEffectType } from './types';

type RevealEffectLoader = () => Promise<ComponentType<RevealEffectProps>>;

const mythic =
  (
    pick: (
      module: typeof import('./effects/MythicCollectionReveal'),
    ) => ComponentType<RevealEffectProps>,
  ) =>
  () =>
    import('./effects/MythicCollectionReveal').then(pick);

const REVEAL_EFFECT_LOADERS = {
  fateDecree: () => import('./effects/FateDecree').then((module) => module.default),
  fateReweave: mythic((module) => module.AstralCollectionReveal),
  oceanPearl: mythic((module) => module.OceanCollectionReveal),
  unfoldLandscape: mythic((module) => module.InkCollectionReveal),
  roulette: () => import('./effects/EnhancedRoulette').then((module) => module.default),
  roleHunt: () => import('./effects/RoleHunt').then((module) => module.default),
  scratch: () => import('./effects/ScratchReveal').then((module) => module.default),
  tarot: () => import('./effects/TarotDraw').then((module) => module.default),
  gachaMachine: () => import('./effects/GachaMachine').then((module) => module.default),
  cardPick: () => import('./effects/CardPick').then((module) => module.default),
  sealBreak: () => import('./effects/SealBreak').then((module) => module.default),
  chainShatter: () => import('./effects/ChainShatter').then((module) => module.default),
  fortuneWheel: () => import('./effects/FortuneWheel').then((module) => module.default),
  meteorStrike: () => import('./effects/MeteorStrike').then((module) => module.default),
  filmRewind: () => import('./effects/FilmRewind').then((module) => module.default),
  vortexCollapse: () => import('./effects/VortexCollapse').then((module) => module.default),
} satisfies Record<RevealEffectType, RevealEffectLoader>;

/** A loaded reveal effect; rendered as `<Effect />` after a property read, never a call result. */
interface LoadedRevealEffect {
  readonly Effect: ComponentType<RevealEffectProps>;
}

const loadedEffects = new Map<RevealEffectType, Promise<LoadedRevealEffect>>();

/** Reveal effect `id`, loaded once and shared (a stable promise for `use()`). */
export function loadRevealEffect(id: RevealEffectType): Promise<LoadedRevealEffect> {
  let effect = loadedEffects.get(id);
  if (!effect) {
    effect = REVEAL_EFFECT_LOADERS[id]().then((component) => ({ Effect: component }));
    loadedEffects.set(id, effect);
  }
  return effect;
}
