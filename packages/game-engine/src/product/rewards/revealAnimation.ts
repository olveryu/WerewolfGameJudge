/** Product reveal-effect types and deterministic random selection. */

import { createSeededRng, randomIntInclusive } from '../../platform/random';
import { ROLE_REVEAL_EFFECT_IDS, type RoleRevealEffectId } from './catalog';

type RandomizableAnimation = RoleRevealEffectId;

export type RoleRevealAnimation = RandomizableAnimation | 'none' | 'random';

export type ResolvedRoleRevealAnimation = RandomizableAnimation | 'none';

export const RANDOMIZABLE_ANIMATIONS: readonly RandomizableAnimation[] = ROLE_REVEAL_EFFECT_IDS;

/** Parse a reveal animation after account-level `random` resolution. */
export function parseResolvedRoleRevealAnimation(value: unknown): ResolvedRoleRevealAnimation {
  if (value === 'none') return value;
  const animation = RANDOMIZABLE_ANIMATIONS.find((candidate) => candidate === value);
  if (animation === undefined) {
    throw new Error(`[FAIL-FAST] Unknown resolved role reveal animation: ${String(value)}`);
  }
  return animation;
}

export function resolveRandomAnimation(
  seed: string,
  previous?: RandomizableAnimation,
): RandomizableAnimation {
  const animationCount = RANDOMIZABLE_ANIMATIONS.length;
  let index = randomIntInclusive(0, animationCount - 1, createSeededRng(seed));
  if (previous !== undefined && RANDOMIZABLE_ANIMATIONS[index] === previous) {
    index = (index + 1) % animationCount;
  }
  return RANDOMIZABLE_ANIMATIONS[index]!;
}
