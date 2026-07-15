/** Product-level draw-ticket earning policy. */

import { randomIntInclusive, type Rng, secureRng } from '../../platform/random';

interface DrawWeight {
  readonly draws: number;
  readonly cumulativeWeight: number;
}

/** Per-game normal-ticket distribution. */
const NORMAL_DRAW_WEIGHTS: readonly DrawWeight[] = [
  { draws: 1, cumulativeWeight: 30 },
  { draws: 2, cumulativeWeight: 65 },
  { draws: 3, cumulativeWeight: 85 },
  { draws: 4, cumulativeWeight: 95 },
  { draws: 5, cumulativeWeight: 100 },
];

/** Level-up golden-ticket distribution. */
const GOLDEN_DRAW_WEIGHTS: readonly DrawWeight[] = [
  { draws: 1, cumulativeWeight: 35 },
  { draws: 2, cumulativeWeight: 70 },
  { draws: 3, cumulativeWeight: 88 },
  { draws: 4, cumulativeWeight: 96 },
  { draws: 5, cumulativeWeight: 100 },
];

function rollWeightedDraws(weights: readonly DrawWeight[], rng: Rng): number {
  const roll = randomIntInclusive(0, 99, rng);
  for (const { draws, cumulativeWeight } of weights) {
    if (roll < cumulativeWeight) return draws;
  }
  throw new Error('[FAIL-FAST] Draw reward weights do not cover the RNG range');
}

/** Roll per-game normal ticket count. */
export function rollNormalDraws(rng: Rng = secureRng): number {
  return rollWeightedDraws(NORMAL_DRAW_WEIGHTS, rng);
}

/** Roll level-up golden ticket count. */
export function rollGoldenDraws(rng: Rng = secureRng): number {
  return rollWeightedDraws(GOLDEN_DRAW_WEIGHTS, rng);
}
