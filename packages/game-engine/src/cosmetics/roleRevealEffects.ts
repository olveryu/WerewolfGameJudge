/**
 * roleRevealEffects — role reveal cosmetic IDs and animation resolution.
 *
 * Cosmetics own the stable effect ID list. Growth consumes these IDs when building
 * the reward pool; game logic and UI consume them for equipped reveal effects.
 */

/** All role-reveal effect IDs (1:1 with RoleRevealEffects UI registry). */
// prettier-ignore
export const ROLE_REVEAL_EFFECT_IDS = [
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
] as const;

/** Role-reveal effect ID literal union. */
export type RoleRevealEffectId = (typeof ROLE_REVEAL_EFFECT_IDS)[number];

/** Free role-reveal effect IDs granted on registration (none). */
export const FREE_ROLE_REVEAL_EFFECT_IDS: ReadonlySet<string> = new Set<string>();

/**
 * Animation types eligible for random selection (excludes none and random).
 * Derived from ROLE_REVEAL_EFFECT_IDS to maintain a single source of truth.
 */
export type RandomizableAnimation = RoleRevealEffectId;

/** Role reveal animation config type (includes random / none) */
export type RoleRevealAnimation = RandomizableAnimation | 'none' | 'random';

/** Resolved role reveal animation type (excludes random) */
export type ResolvedRoleRevealAnimation = RandomizableAnimation | 'none';

/**
 * Animation array eligible for random selection (used in random resolution).
 * Derived from ROLE_REVEAL_EFFECT_IDS — not maintained separately.
 */
export const RANDOMIZABLE_ANIMATIONS: readonly RandomizableAnimation[] = [
  ...ROLE_REVEAL_EFFECT_IDS,
];

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
