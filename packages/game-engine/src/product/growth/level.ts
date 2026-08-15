/**
 * level — level system
 *
 * Unbounded levels via cumulative XP. The progression curve is shared with settlement SQL.
 * XP/game: 50 + random(0~20+level), so rewards continue scaling after Lv.51.
 * Pure function, no side effects.
 */

import { randomIntInclusive, type Rng, secureRng } from '../../platform/random';

/** XP base value */
export const XP_BASE = 50;

/** Upper bound (inclusive) of XP random base range; actual range = XP_RANDOM_BASE + level */
export const XP_RANDOM_BASE = 20;

/**
 * Piecewise cumulative-XP curve. The final segment has no product-level cap.
 */
export const LEVEL_PROGRESSION_SEGMENTS = [
  { startingLevel: 0, startingXp: 0, xpPerLevel: 60 },
  { startingLevel: 20, startingXp: 1_200, xpPerLevel: 90 },
  { startingLevel: 40, startingXp: 3_000, xpPerLevel: 120 },
] as const;

type LevelProgressionSegment = (typeof LEVEL_PROGRESSION_SEGMENTS)[number];

function assertNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`[FAIL-FAST] ${label} must be a non-negative safe integer: ${value}`);
  }
}

function assertLevel(level: number): void {
  assertNonNegativeSafeInteger(level, 'Level');
}

function getProgressionSegmentForLevel(level: number): LevelProgressionSegment {
  for (let index = LEVEL_PROGRESSION_SEGMENTS.length - 1; index >= 0; index -= 1) {
    const segment = LEVEL_PROGRESSION_SEGMENTS[index]!;
    if (level >= segment.startingLevel) return segment;
  }
  throw new Error(`[FAIL-FAST] Level progression does not cover level: ${level}`);
}

function getProgressionSegmentForXp(xp: number): LevelProgressionSegment {
  for (let index = LEVEL_PROGRESSION_SEGMENTS.length - 1; index >= 0; index -= 1) {
    const segment = LEVEL_PROGRESSION_SEGMENTS[index]!;
    if (xp >= segment.startingXp) return segment;
  }
  throw new Error(`[FAIL-FAST] Level progression does not cover XP: ${xp}`);
}

/** Return the cumulative XP required to reach a level. */
export function getLevelThreshold(level: number): number {
  assertLevel(level);
  const segment = getProgressionSegmentForLevel(level);
  const threshold = segment.startingXp + (level - segment.startingLevel) * segment.xpPerLevel;
  if (!Number.isSafeInteger(threshold)) {
    throw new Error(`[FAIL-FAST] Level threshold exceeds the safe integer range: ${level}`);
  }
  return threshold;
}

/** Compute level from cumulative XP */
export function getLevel(xp: number): number {
  assertNonNegativeSafeInteger(xp, 'XP');
  const segment = getProgressionSegmentForXp(xp);
  return segment.startingLevel + Math.floor((xp - segment.startingXp) / segment.xpPerLevel);
}

/** Current level progress ratio from 0 inclusive to 1 exclusive. */
export function getLevelProgress(xp: number): number {
  const level = getLevel(xp);
  const currentThreshold = getLevelThreshold(level);
  const nextThreshold = getLevelThreshold(level + 1);
  return (xp - currentThreshold) / (nextThreshold - currentThreshold);
}

/** Level titles ordered from highest minimum level to lowest. */
const LEVEL_TITLES = [
  { minimumLevel: 201, title: '无尽' },
  { minimumLevel: 151, title: '永恒' },
  { minimumLevel: 101, title: '不朽' },
  { minimumLevel: 76, title: '超凡' },
  { minimumLevel: 52, title: '神话' },
  { minimumLevel: 41, title: '传奇' },
  { minimumLevel: 31, title: '元老' },
  { minimumLevel: 21, title: '老手' },
  { minimumLevel: 11, title: '常客' },
  { minimumLevel: 6, title: '入门' },
  { minimumLevel: 0, title: '新手' },
] as const;

/** Return the Chinese title for a given level */
export function getLevelTitle(level: number): string {
  assertLevel(level);
  for (const { minimumLevel, title } of LEVEL_TITLES) {
    if (level >= minimumLevel) return title;
  }
  throw new Error(`[FAIL-FAST] Level title ranges do not cover level: ${level}`);
}

/** Roll an XP value. 50 + random(0 ~ 20 + level). */
export function rollXp(level: number, rng: Rng = secureRng): number {
  assertLevel(level);
  const range = XP_RANDOM_BASE + level;
  if (!Number.isSafeInteger(XP_BASE + range)) {
    throw new Error(`[FAIL-FAST] XP reward exceeds the safe integer range at level: ${level}`);
  }
  return XP_BASE + randomIntInclusive(0, range, rng);
}
