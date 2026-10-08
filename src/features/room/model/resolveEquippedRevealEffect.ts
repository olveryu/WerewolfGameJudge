/**
 * Shared resolver for player's equipped reveal effect.
 *
 * Converts `user.equippedEffect` (which can be 'random', a specific effect ID,
 * or null/undefined) into a concrete `RevealEffectType | null` for the
 * role reveal animation.
 *
 * - 'random' → deterministically resolved via `resolveRandomAnimation(roomCode + userId)`
 * - null/undefined → null (no animation)
 * - specific effect ID → validated against the 16 known RevealEffectType values,
 *   invalid → null
 */

import { resolveRandomAnimation } from '@game-judge/game-engine/product/rewards';

import type { RevealEffectType } from '../components/RoleRevealEffects/types';

/** All 16 valid reveal effect IDs (canonical source: ROLE_REVEAL_EFFECT_IDS). */
const VALID_REVEAL_EFFECTS: readonly string[] = [
  'fateReweave',
  'oceanPearl',
  'unfoldLandscape',
  'fateDecree',
  'roulette',
  'roleHunt',
  'scratch',
  'tarot',
  'gachaMachine',
  'cardPick',
  'sealBreak',
  'chainShatter',
  'fortuneWheel',
  'meteorStrike',
  'filmRewind',
  'vortexCollapse',
];

export function resolveEquippedRevealEffect(
  equippedEffect: string | null | undefined,
  roomCode: string,
  userId: string,
): RevealEffectType | null {
  if (equippedEffect === 'random') {
    const resolved = resolveRandomAnimation(roomCode + userId);
    return VALID_REVEAL_EFFECTS.includes(resolved) ? resolved : null;
  }
  if (equippedEffect == null) return null;
  return VALID_REVEAL_EFFECTS.includes(equippedEffect)
    ? (equippedEffect as RevealEffectType)
    : null;
}
