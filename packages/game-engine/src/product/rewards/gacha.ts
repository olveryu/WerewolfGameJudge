/**
 * gacha - Gacha probability engine (pure functions)
 *
 * Core: rollRarity() computes rarity from draw type + pity,
 *       selectReward() randomly picks an item from the target rarity pool (duplicates allowed).
 * Random values are injected by callers; functions themselves have no side effects.
 *
 * @remarks pityCount forces an upgrade on the 10th attempt (>=9). Owned items can still be
 *   rolled and are converted to shard compensation.
 */

import { randomPick, type Rng } from '../../platform/random';
import type { Rarity, RewardItem } from './catalog';
import { REWARD_POOL, SHARD_VALUES } from './catalog';

/** Draw type: normal / golden. */
export type DrawType = 'normal' | 'golden';

/** How many consecutive draws without triggering high rarity before forced pity */
export const PITY_THRESHOLD = 10;

/** Normal draw probabilities (%), total = 100 */
export const NORMAL_RATES: Readonly<Record<Rarity, number>> = {
  legendary: 2.5,
  epic: 4,
  rare: 10,
  common: 83.5,
};

/** Golden draw probabilities (%), total = 100 */
export const GOLDEN_RATES: Readonly<Record<Rarity, number>> = {
  legendary: 5,
  epic: 8,
  rare: 20,
  common: 67,
};

/** Rarity order used to enforce the pity floor. */
const RARITY_ORDER: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary'];

const REWARD_POOLS_BY_RARITY: Readonly<Record<Rarity, readonly RewardItem[]>> = {
  common: REWARD_POOL.filter((item) => item.rarity === 'common'),
  rare: REWARD_POOL.filter((item) => item.rarity === 'rare'),
  epic: REWARD_POOL.filter((item) => item.rarity === 'epic'),
  legendary: REWARD_POOL.filter((item) => item.rarity === 'legendary'),
};

for (const [rarity, pool] of Object.entries(REWARD_POOLS_BY_RARITY)) {
  if (pool.length === 0) {
    throw new Error(`[FAIL-FAST] Reward catalog has no ${rarity} items`);
  }
}

/**
 * Roll rarity based on draw type and pity count.
 *
 * Pity rules:
 * - Normal draw: 10 consecutive draws without Rare+ -> guaranteed Rare+
 * - Golden draw: 10 consecutive draws without Epic+ -> guaranteed Epic+
 *
 * @param drawType - 'normal' | 'golden'
 * @param pityCount - current pity count (0-9)
 * @param randomValue - random float in [0, 100)
 * @returns { rarity, pityReset } — pityReset=true means pity is reset to 0
 */
export function rollRarity(
  drawType: DrawType,
  pityCount: number,
  randomValue: number,
): { rarity: Rarity; pityReset: boolean } {
  if (!Number.isSafeInteger(pityCount) || pityCount < 0) {
    throw new Error(`[FAIL-FAST] Pity count must be a non-negative integer: ${pityCount}`);
  }
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 100) {
    throw new Error(`[FAIL-FAST] Rarity roll must be in [0, 100): ${randomValue}`);
  }
  const rates = drawType === 'golden' ? GOLDEN_RATES : NORMAL_RATES;
  const isPityTrigger = pityCount >= PITY_THRESHOLD - 1; // pityCount=9 -> 10th attempt

  // Normal roll (pity also uses same probability table, only clamps lower bound)
  let rarity: Rarity = rollFromRates(rates, randomValue);

  if (isPityTrigger) {
    // Pity triggered: results below pity floor clamp to floor; high rarity probabilities unchanged
    const pityFloor: Rarity = drawType === 'golden' ? 'epic' : 'rare';
    if (RARITY_ORDER.indexOf(rarity) < RARITY_ORDER.indexOf(pityFloor)) {
      rarity = pityFloor;
    }
    return { rarity, pityReset: true };
  }

  // Determine whether to reset pity
  const resetsNormalPity = rarity !== 'common'; // Rare/Epic/Legendary reset
  const resetsGoldenPity = rarity === 'epic' || rarity === 'legendary';
  const pityReset = drawType === 'golden' ? resetsGoldenPity : resetsNormalPity;

  return { rarity, pityReset };
}

/** selectReward return result */
interface SelectRewardResult {
  readonly reward: RewardItem;
  /** Whether the player already owns the item */
  readonly isDuplicate: boolean;
  /** Shards awarded on duplicate (0 if not duplicate) */
  readonly shardsAwarded: number;
}

/**
 * Randomly pick an item from the target rarity pool. Duplicates allowed; on duplicate, compute shard reward.
 *
 * @param targetRarity - target rarity
 * @param unlockedIds - set of item IDs the player already owns (used for duplicate detection)
 * @param rng - random number generator returning a float in [0, 1)
 * @returns selected item + duplicate flag + shard reward
 */
export function selectReward(
  targetRarity: Rarity,
  unlockedIds: ReadonlySet<string>,
  rng: Rng,
): SelectRewardResult {
  const pool = REWARD_POOLS_BY_RARITY[targetRarity];
  const reward = randomPick(pool, rng);
  const isDuplicate = unlockedIds.has(reward.id);
  return {
    reward,
    isDuplicate,
    shardsAwarded: isDuplicate ? SHARD_VALUES[reward.rarity] : 0,
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────

/** Roll using full probability table */
function rollFromRates(rates: Readonly<Record<Rarity, number>>, value: number): Rarity {
  let cumulative = 0;
  cumulative += rates.legendary;
  if (value < cumulative) return 'legendary';
  cumulative += rates.epic;
  if (value < cumulative) return 'epic';
  cumulative += rates.rare;
  if (value < cumulative) return 'rare';
  return 'common';
}
