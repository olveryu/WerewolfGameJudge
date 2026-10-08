/**
 * Shared resolver for player's equipped reveal effect.
 *
 * Converts `user.equippedEffect` (which can be 'random', a specific effect ID,
 * or null/undefined) into a concrete `RevealEffectType | null` for the
 * role reveal animation.
 *
 * - 'random' → deterministically resolved via `resolveRandomAnimation(roomCode + userId)`
 * - null/undefined → null (no animation)
 * - specific effect ID → validated against canonical `ROLE_REVEAL_EFFECT_IDS`,
 *   invalid → null
 */

import {
  resolveRandomAnimation,
  ROLE_REVEAL_EFFECT_IDS,
} from '@game-judge/game-engine/product/rewards';

import type { RevealEffectType } from '../components/RoleRevealEffects/types';

/** Type guard: narrows string to RevealEffectType via canonical ID list. */
function isRevealEffectType(id: string): id is RevealEffectType {
  return (ROLE_REVEAL_EFFECT_IDS as readonly string[]).includes(id);
}

export function resolveEquippedRevealEffect(
  equippedEffect: string | null | undefined,
  roomCode: string,
  userId: string,
): RevealEffectType | null {
  if (equippedEffect === 'random') {
    const resolved = resolveRandomAnimation(roomCode + userId);
    return isRevealEffectType(resolved) ? resolved : null;
  }
  if (equippedEffect == null) return null;
  return isRevealEffectType(equippedEffect) ? equippedEffect : null;
}
