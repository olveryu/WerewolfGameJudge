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
 *
 * Delivery paths (AU-24, registered divergence): avalon/fibking/
 * undercover resolve at view time in their room hooks. Werewolf
 * resolves once at seat time (createSeatProfile) into the roster
 * profile the server distributes, and its client only revalidates.
 * Both paths run this same deterministic function over the same
 * inputs, so results are identical within a room; do not converge
 * them - the werewolf shape is what its roster protocol carries.
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
