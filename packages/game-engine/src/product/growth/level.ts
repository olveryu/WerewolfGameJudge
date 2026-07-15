/**
 * level — level system
 *
 * 52 levels (Lv.0–Lv.51), level up via cumulative XP. Each level unlocks 1 avatar or avatar frame.
 * XP/game: 50 + random(0~20), expected ~60. Early game ~1 game/level, late game ~2 games/level.
 * Pure function, no side effects.
 */

import { randomIntInclusive, type Rng, secureRng } from '../../platform/random';

/** XP base value */
export const XP_BASE = 50;

/** Upper bound (inclusive) of XP random base range; actual range = XP_RANDOM_BASE + level */
export const XP_RANDOM_BASE = 20;

/**
 * Cumulative XP threshold table. index = level.
 *
 * Lv.0 = 0 (free), Lv.1–20 +60 per level, Lv.21–40 +90 per level, Lv.41–51 +120 per level.
 */
export const LEVEL_THRESHOLDS: readonly number[] = /* @__PURE__ */ (() => {
  const t = [0];
  for (let lv = 1; lv <= 51; lv++) {
    const delta = lv <= 20 ? 60 : lv <= 40 ? 90 : 120;
    t.push(t[lv - 1]! + delta);
  }
  return t;
})();

const MAX_LEVEL = LEVEL_THRESHOLDS.length - 1;

function assertNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`[FAIL-FAST] ${label} must be a non-negative safe integer: ${value}`);
  }
}

function assertLevel(level: number): void {
  assertNonNegativeSafeInteger(level, 'Level');
  if (level > MAX_LEVEL) {
    throw new Error(`[FAIL-FAST] Level must be between 0 and ${MAX_LEVEL}: ${level}`);
  }
}

/** Compute level from cumulative XP */
export function getLevel(xp: number): number {
  assertNonNegativeSafeInteger(xp, 'XP');
  for (let i = MAX_LEVEL; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]!) return i;
  }
  throw new Error(`[FAIL-FAST] Level thresholds do not cover XP: ${xp}`);
}

/** Current level progress ratio 0–1 (returns 1 at max level) */
export function getLevelProgress(xp: number): number {
  const level = getLevel(xp);
  if (level >= MAX_LEVEL) return 1;
  const currentThreshold = LEVEL_THRESHOLDS[level]!;
  const nextThreshold = LEVEL_THRESHOLDS[level + 1]!;
  return (xp - currentThreshold) / (nextThreshold - currentThreshold);
}

/** Level titles (bucketed by level range) */
const LEVEL_TITLES = [
  { min: 0, max: 5, title: '新手' },
  { min: 6, max: 10, title: '入门' },
  { min: 11, max: 20, title: '常客' },
  { min: 21, max: 30, title: '老手' },
  { min: 31, max: 40, title: '元老' },
  { min: 41, max: 51, title: '传奇' },
] as const;

/** Return the Chinese title for a given level */
export function getLevelTitle(level: number): string {
  assertLevel(level);
  for (const { min, max, title } of LEVEL_TITLES) {
    if (level >= min && level <= max) return title;
  }
  throw new Error(`[FAIL-FAST] Level title ranges do not cover level: ${level}`);
}

/** Roll an XP value. 50 + random(0 ~ 20 + level). */
export function rollXp(level: number, rng: Rng = secureRng): number {
  assertLevel(level);
  const range = XP_RANDOM_BASE + level;
  return XP_BASE + randomIntInclusive(0, range, rng);
}
