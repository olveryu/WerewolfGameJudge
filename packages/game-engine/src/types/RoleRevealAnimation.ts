/**
 * RoleRevealAnimation - Role reveal animation type definitions
 *
 * Types + resolveRandomAnimation utility function.
 * The authoritative ID list lives in `rewardCatalog.ts` (ROLE_REVEAL_EFFECT_IDS); this file derives types.
 */

import { ROLE_REVEAL_EFFECT_IDS, type RoleRevealEffectId } from '../growth/rewardCatalog';

/**
 * Animation types eligible for random selection (excludes none and random).
 * Derived from rewardCatalog's ROLE_REVEAL_EFFECT_IDS to maintain a single source of truth.
 */
export type RandomizableAnimation = RoleRevealEffectId;

/** Role reveal animation config type (includes random / none) */
export type RoleRevealAnimation = RandomizableAnimation | 'none' | 'random';

/** Resolved role reveal animation type (excludes random) */
export type ResolvedRoleRevealAnimation = RandomizableAnimation | 'none';

/**
 * Animation array eligible for random selection (used in random resolution).
 * Derived from ROLE_REVEAL_EFFECT_IDS — no longer maintained separately.
 */
export const RANDOMIZABLE_ANIMATIONS: readonly RandomizableAnimation[] = ROLE_REVEAL_EFFECT_IDS;

/**
 * Deterministic hash function (used in random resolution)
 * Uses simple djb2 algorithm, no external dependency
 */
function simpleHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    const codePoint = str.codePointAt(i) ?? 0;
    hash = (hash * 33) ^ codePoint;
  }
  return hash >>> 0; // ensure positive integer
}

/**
 * Resolve random to a specific animation based on seed
 * @param seed Stable seed string (e.g. roomCode:templateId:revision)
 * @param previous Previously used animation; if matched, +1 skip (still deterministic)
 * @returns Resolved animation type
 */
export function resolveRandomAnimation(
  seed: string,
  previous?: RandomizableAnimation,
): RandomizableAnimation {
  const len = RANDOMIZABLE_ANIMATIONS.length;
  let index = simpleHash(seed) % len;
  if (previous != null && RANDOMIZABLE_ANIMATIONS[index] === previous) {
    index = (index + 1) % len;
  }
  return RANDOMIZABLE_ANIMATIONS[index]!;
}
