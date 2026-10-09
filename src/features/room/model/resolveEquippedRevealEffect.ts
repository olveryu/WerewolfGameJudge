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

/** Canonical ID 集合（Set 查找，避免对元组类型做放宽断言）。 */
const REVEAL_EFFECT_ID_SET: ReadonlySet<string> = new Set(ROLE_REVEAL_EFFECT_IDS);

/** Type guard: narrows string to RevealEffectType via canonical ID list. */
function isRevealEffectType(id: string): id is RevealEffectType {
  return REVEAL_EFFECT_ID_SET.has(id);
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
