/**
 * RevealConfig - Per-game configuration for role reveal animations.
 *
 * Each game defines which reveal effects are available and the default effect.
 * The shared RoleRevealAnimator uses this config to validate effect types.
 */

import type { RevealEffectType } from './types';

/** Configuration for a game's reveal animations */
export interface RevealConfig {
  /** Game identifier (e.g., 'werewolf', 'avalon') */
  readonly gameId: string;
  /** Effect types available for this game */
  readonly availableEffects: readonly RevealEffectType[];
  /** Default effect type when none is specified */
  readonly defaultEffect: RevealEffectType;
  /** Whether to enable the crack background effect */
  readonly enableCrackEffect: boolean;
}

/** Werewolf game reveal configuration: all 16 effects, default roleHunt */
export const WEREWOLF_REVEAL_CONFIG: RevealConfig = {
  gameId: 'werewolf',
  availableEffects: [
    'cardPick',
    'chainShatter',
    'fateDecree',
    'filmRewind',
    'roulette',
    'fortuneWheel',
    'roleHunt',
    'scratch',
    'gachaMachine',
    'meteorStrike',
    'sealBreak',
    'tarot',
    'fateReweave',
    'oceanPearl',
    'unfoldLandscape',
    'vortexCollapse',
  ],
  defaultEffect: 'roleHunt',
  enableCrackEffect: true,
} as const;

/** Avalon game reveal configuration: all 16 effects, default tarot */
export const AVALON_REVEAL_CONFIG: RevealConfig = {
  gameId: 'avalon',
  availableEffects: [
    'cardPick',
    'chainShatter',
    'fateDecree',
    'filmRewind',
    'roulette',
    'fortuneWheel',
    'roleHunt',
    'scratch',
    'gachaMachine',
    'meteorStrike',
    'sealBreak',
    'tarot',
    'fateReweave',
    'oceanPearl',
    'unfoldLandscape',
    'vortexCollapse',
  ],
  defaultEffect: 'tarot',
  enableCrackEffect: false,
} as const;
