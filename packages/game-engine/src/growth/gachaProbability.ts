/**
 * gachaProbability — 扭蛋概率引擎（纯函数）
 *
 * 核心：rollRarity() 根据抽奖类型 + pity 计算稀有度，
 *       selectReward() 从指定稀有度池中随机选取物品（允许重复）。
 * 随机数由调用方注入，函数本身无副作用。
 */

import type { Rarity, RewardItem } from './rewardCatalog';
import { REWARD_POOL, SHARD_VALUES } from './rewardCatalog';

export type DrawType = 'normal' | 'golden';

/** 连续多少次未触发高稀有度后强制保底 */
export const PITY_THRESHOLD = 10;

/** 普通抽概率（%），总和 = 100 */
export const NORMAL_RATES: Readonly<Record<Rarity, number>> = {
  legendary: 2.5,
  epic: 4,
  rare: 10,
  common: 83.5,
};

/** 黄金抽概率（%），总和 = 100 */
export const GOLDEN_RATES: Readonly<Record<Rarity, number>> = {
  legendary: 5,
  epic: 8,
  rare: 20,
  common: 67,
};

/** 稀有度升级顺序（用于去重时向上 fallback） */
const RARITY_UPGRADE_ORDER: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary'];

/**
 * 根据抽奖类型和 pity 计数 roll 稀有度。
 *
 * 保底规则：
 * - 普通抽：连续 10 次未抽到 Rare+ → 保底 Rare+
 * - 黄金抽：连续 10 次未抽到 Epic+ → 保底 Epic+
 *
 * @param drawType - 'normal' | 'golden'
 * @param pityCount - 当前 pity 计数（0–9）
 * @param randomValue - [0, 100) 的随机浮点数
 * @returns { rarity, pityReset } — pityReset=true 表示 pity 被重置为 0
 */
export function rollRarity(
  drawType: DrawType,
  pityCount: number,
  randomValue: number,
): { rarity: Rarity; pityReset: boolean } {
  const rates = drawType === 'golden' ? GOLDEN_RATES : NORMAL_RATES;
  const isPityTrigger = pityCount >= PITY_THRESHOLD - 1; // pityCount=9 → 第 10 次

  // 正常 roll（保底时也走同一概率表，仅 clamp 下限）
  let rarity: Rarity = rollFromRates(rates, randomValue);

  if (isPityTrigger) {
    // 保底触发：低于保底线的结果 clamp 到保底线，高稀有度概率不变
    const pityFloor: Rarity = drawType === 'golden' ? 'epic' : 'rare';
    if (RARITY_UPGRADE_ORDER.indexOf(rarity) < RARITY_UPGRADE_ORDER.indexOf(pityFloor)) {
      rarity = pityFloor;
    }
    return { rarity, pityReset: true };
  }

  // 判断是否 reset pity
  const resetsNormalPity = rarity !== 'common'; // Rare/Epic/Legendary reset
  const resetsGoldenPity = rarity === 'epic' || rarity === 'legendary';
  const pityReset = drawType === 'golden' ? resetsGoldenPity : resetsNormalPity;

  return { rarity, pityReset };
}

/** selectReward 返回结果 */
export interface SelectRewardResult {
  readonly reward: RewardItem;
  /** 玩家是否已拥有该物品 */
  readonly isDuplicate: boolean;
  /** 重复时获得的碎片数（非重复为 0） */
  readonly shardsAwarded: number;
}

/**
 * 从指定稀有度池中随机选取物品。允许重复，重复时计算碎片奖励。
 *
 * 如果目标稀有度池为空（不应发生），向上 fallback。
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

/** 按完整概率表 roll */
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
