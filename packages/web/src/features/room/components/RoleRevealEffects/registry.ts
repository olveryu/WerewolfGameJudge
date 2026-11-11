/**
 * Reveal effect registry: all effect components are statically imported. Stable promises let the
 * reveal prepare an effect ahead of mounting it. `satisfies` requires every catalog id.
 */
import type { ComponentType } from 'react';

import CardPick from './effects/CardPick';
import ChainShatter from './effects/ChainShatter';
import EnhancedRoulette from './effects/EnhancedRoulette';
import FateDecree from './effects/FateDecree';
import FilmRewind from './effects/FilmRewind';
import FortuneWheel from './effects/FortuneWheel';
import GachaMachine from './effects/GachaMachine';
import MeteorStrike from './effects/MeteorStrike';
import {
  AstralCollectionReveal,
  InkCollectionReveal,
  OceanCollectionReveal,
} from './effects/MythicCollectionReveal';
import RoleHunt from './effects/RoleHunt';
import ScratchReveal from './effects/ScratchReveal';
import SealBreak from './effects/SealBreak';
import TarotDraw from './effects/TarotDraw';
import VortexCollapse from './effects/VortexCollapse';
import type { RevealEffectProps, RevealEffectType } from './types';

const REVEAL_EFFECTS = {
  fateDecree: FateDecree,
  fateReweave: AstralCollectionReveal,
  oceanPearl: OceanCollectionReveal,
  unfoldLandscape: InkCollectionReveal,
  roulette: EnhancedRoulette,
  roleHunt: RoleHunt,
  scratch: ScratchReveal,
  tarot: TarotDraw,
  gachaMachine: GachaMachine,
  cardPick: CardPick,
  sealBreak: SealBreak,
  chainShatter: ChainShatter,
  fortuneWheel: FortuneWheel,
  meteorStrike: MeteorStrike,
  filmRewind: FilmRewind,
  vortexCollapse: VortexCollapse,
} satisfies Record<RevealEffectType, ComponentType<RevealEffectProps>>;

/** A loaded reveal effect; rendered as `<Effect />` after a property read, never a call result. */
interface LoadedRevealEffect {
  readonly Effect: ComponentType<RevealEffectProps>;
}

const loadedEffects = new Map<RevealEffectType, Promise<LoadedRevealEffect>>();

/** Reveal effect `id`, loaded once and shared (a stable promise for `use()`). */
export function loadRevealEffect(id: RevealEffectType): Promise<LoadedRevealEffect> {
  let effect = loadedEffects.get(id);
  if (!effect) {
    effect = Promise.resolve({ Effect: REVEAL_EFFECTS[id] });
    loadedEffects.set(id, effect);
  }
  return effect;
}
