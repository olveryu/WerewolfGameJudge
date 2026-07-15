/** Product reveal-effect types and deterministic random selection. */

import { ROLE_REVEAL_EFFECT_IDS, type RoleRevealEffectId } from './rewardCatalog';

export type RandomizableAnimation = RoleRevealEffectId;

export type RoleRevealAnimation = RandomizableAnimation | 'none' | 'random';

export type ResolvedRoleRevealAnimation = RandomizableAnimation | 'none';

export const RANDOMIZABLE_ANIMATIONS: readonly RandomizableAnimation[] = ROLE_REVEAL_EFFECT_IDS;

function hashSeed(seed: string): number {
  let hash = 5381;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 33) ^ (seed.codePointAt(index) ?? 0);
  }
  return hash >>> 0;
}

export function resolveRandomAnimation(
  seed: string,
  previous?: RandomizableAnimation,
): RandomizableAnimation {
  const animationCount = RANDOMIZABLE_ANIMATIONS.length;
  let index = hashSeed(seed) % animationCount;
  if (previous !== undefined && RANDOMIZABLE_ANIMATIONS[index] === previous) {
    index = (index + 1) % animationCount;
  }
  return RANDOMIZABLE_ANIMATIONS[index]!;
}
