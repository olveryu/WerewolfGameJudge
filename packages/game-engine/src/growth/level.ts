/**
 * level — level system
 *
 * 52 levels (Lv.0–Lv.51), level up via cumulative XP. Each level unlocks 1 avatar or avatar frame.
 * XP/game: 50 + random(0~20), expected ~60. Early game ~1 game/level, late game ~2 games/level.
 * Pure function, no side effects.
 */

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

/** Compute level from cumulative XP */
export function getLevel(xp: number): number {
  for (let i = MAX_LEVEL; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]!) return i;
  }
  return 0;
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
  for (const { min, max, title } of LEVEL_TITLES) {
    if (level >= min && level <= max) return title;
  }
  return '传奇';
}

/** Roll an XP value (server-side). 50 + random(0 ~ 20 + level). */
export function rollXp(level: number): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const range = XP_RANDOM_BASE + level;
  return XP_BASE + (array[0]! % (range + 1));
}

// ─── Per-game normal draw reward ────────────────────────────────────────

/**
 * Per-game normal-ticket random distribution (weighted). E[X] = 2.25.
 *
 * | Count | Prob | Cumulative weight |
 * |-------|------|-------------------|
 * | 1     | 30%  | 30                |
 * | 2     | 35%  | 65                |
 * | 3     | 20%  | 85                |
 * | 4     | 10%  | 95                |
 * | 5     | 5%   | 100               |
 */
const NORMAL_DRAW_WEIGHTS: readonly { draws: number; cumulativeWeight: number }[] = [
  { draws: 1, cumulativeWeight: 30 },
  { draws: 2, cumulativeWeight: 65 },
  { draws: 3, cumulativeWeight: 85 },
  { draws: 4, cumulativeWeight: 95 },
  { draws: 5, cumulativeWeight: 100 },
];

/** Roll per-game normal ticket count (server-side). 1–5, weighted random. */
export function rollNormalDraws(): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const roll = array[0]! % 100; // 0–99
  for (const { draws, cumulativeWeight } of NORMAL_DRAW_WEIGHTS) {
    if (roll < cumulativeWeight) return draws;
  }
  return 1; // unreachable — satisfies TypeScript
}

// ─── Level-up golden draw reward ───────────────────────────────────────

/**
 * Level-up golden-ticket random distribution (weighted). E[X] = 2.11.
 *
 * | Count | Prob | Cumulative weight |
 * |-------|------|-------------------|
 * | 1     | 35%  | 35                |
 * | 2     | 35%  | 70                |
 * | 3     | 18%  | 88                |
 * | 4     | 8%   | 96                |
 * | 5     | 4%   | 100               |
 */
const GOLDEN_DRAW_WEIGHTS: readonly { draws: number; cumulativeWeight: number }[] = [
  { draws: 1, cumulativeWeight: 35 },
  { draws: 2, cumulativeWeight: 70 },
  { draws: 3, cumulativeWeight: 88 },
  { draws: 4, cumulativeWeight: 96 },
  { draws: 5, cumulativeWeight: 100 },
];

/** Roll level-up golden ticket count (server-side). 1–5, weighted random. */
export function rollGoldenDraws(): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const roll = array[0]! % 100; // 0–99
  for (const { draws, cumulativeWeight } of GOLDEN_DRAW_WEIGHTS) {
    if (roll < cumulativeWeight) return draws;
  }
  return 1; // unreachable — satisfies TypeScript
}
