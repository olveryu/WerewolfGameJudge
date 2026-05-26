/**
 * gachaProbability — Gacha probability engine (pure functions)
 *
 * Core: rollRarity() computes rarity from draw type + pity,
 *       selectReward() randomly picks an item from the target rarity pool (duplicates allowed).
 * Random values are injected by callers; functions themselves have no side effects.
 *
 * @remarks pity mechanism: pityCount forces upgrade on the 10th attempt (>=9).
 *   Pity counter resets after obtaining target rarity or higher.
 *   RARITY_UPGRADE_ORDER fallback chain: when target rarity pool is empty, fall back upward first,
 *   then downward; all empty returns undefined (caller must handle).
 *   selectReward duplicate handling: owned items can still be rolled, converted to shard compensation (SHARD_VALUES[rarity]).
 */

import type { Rarity, RewardItem } from './rewardCatalog';
import { REWARD_POOL, SHARD_VALUES } from './rewardCatalog';

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

/** Rarity upgrade order (used for upward fallback on deduplication) */
const RARITY_UPGRADE_ORDER: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary'];

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
  const rates = drawType === 'golden' ? GOLDEN_RATES : NORMAL_RATES;
  const isPityTrigger = pityCount >= PITY_THRESHOLD - 1; // pityCount=9 -> 10th attempt

  // Normal roll (pity also uses same probability table, only clamps lower bound)
  let rarity: Rarity = rollFromRates(rates, randomValue);

  if (isPityTrigger) {
    // Pity triggered: results below pity floor clamp to floor; high rarity probabilities unchanged
    const pityFloor: Rarity = drawType === 'golden' ? 'epic' : 'rare';
    if (RARITY_UPGRADE_ORDER.indexOf(rarity) < RARITY_UPGRADE_ORDER.indexOf(pityFloor)) {
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
export interface SelectRewardResult {
  readonly reward: RewardItem;
  /** Whether the player already owns the item */
  readonly isDuplicate: boolean;
  /** Shards awarded on duplicate (0 if not duplicate) */
  readonly shardsAwarded: number;
}

/**
 * Randomly pick an item from the target rarity pool. Duplicates allowed; on duplicate, compute shard reward.
 *
 * If target rarity pool is empty (should not happen), fall back upward first (rare->epic->legendary),
 * then downward (rare->common). All empty returns undefined.
 *
 * @param targetRarity - target rarity
 * @param unlockedIds - set of item IDs the player already owns (used for duplicate detection)
 * @param randomFn - (max) => random integer in [0, max)
 * @returns selected item + duplicate flag + shard reward; undefined if all pools are empty
 */
export function selectReward(
  targetRarity: Rarity,
  unlockedIds: ReadonlySet<string>,
  randomFn: (max: number) => number,
): SelectRewardResult | undefined {
  const startIdx = RARITY_UPGRADE_ORDER.indexOf(targetRarity);

  for (let i = startIdx; i < RARITY_UPGRADE_ORDER.length; i++) {
    const r = RARITY_UPGRADE_ORDER[i]!;
    const pool = REWARD_POOL.filter((item) => item.rarity === r);
    if (pool.length > 0) {
      const reward = pool[randomFn(pool.length)]!;
      const isDuplicate = unlockedIds.has(reward.id);
      return {
        reward,
        isDuplicate,
        shardsAwarded: isDuplicate ? SHARD_VALUES[reward.rarity] : 0,
      };
    }
  }

  for (let i = startIdx - 1; i >= 0; i--) {
    const r = RARITY_UPGRADE_ORDER[i]!;
    const pool = REWARD_POOL.filter((item) => item.rarity === r);
    if (pool.length > 0) {
      const reward = pool[randomFn(pool.length)]!;
      const isDuplicate = unlockedIds.has(reward.id);
      return {
        reward,
        isDuplicate,
        shardsAwarded: isDuplicate ? SHARD_VALUES[reward.rarity] : 0,
      };
    }
  }

  return undefined;
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
