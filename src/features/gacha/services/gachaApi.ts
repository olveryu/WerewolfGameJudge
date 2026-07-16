/**
 * gachaApi — gacha/draw client API
 *
 * Queries draw status, performs draws, claims daily login rewards, and exchanges shards.
 * Wrapped uniformly via cfGet/cfPost.
 */

import type { Rarity, RewardType } from '@game-judge/game-engine/product/rewards';

import { cfGet, cfPost } from '@/services/cloudflare/cfFetch';

interface GachaStatus {
  normalDraws: number;
  goldenDraws: number;
  normalPity: number;
  goldenPity: number;
  shards: number;
  unlockedCount: number;
}

export interface DrawResultItem {
  rarity: Rarity;
  rewardType: RewardType;
  rewardId: string;
  isNew: boolean;
  isPityTriggered: boolean;
  isDuplicate: boolean;
  shardsAwarded: number;
}

export interface DrawResponse {
  results: DrawResultItem[];
  totalShardsAwarded: number;
  remaining: {
    normalDraws: number;
    goldenDraws: number;
  };
}

export type DailyRewardResponse =
  | {
      claimed: true;
      normalDrawsAdded: number;
      goldenDrawsAdded: 1;
    }
  | {
      claimed: false;
      reason: 'cooldown';
    };

export interface ExchangeResponse {
  rewardId: string;
  rewardType: RewardType;
  rarity: Rarity;
  cost: number;
  remainingShards: number;
}

/** Gets the current user's gacha status */
export async function fetchGachaStatus(): Promise<GachaStatus> {
  return cfGet<GachaStatus>('/api/gacha/status');
}

/** Performs a draw (idempotent: retrying with the same idempotencyKey returns the same result) */
export async function performDraw(
  drawType: 'normal' | 'golden',
  count: number = 1,
): Promise<DrawResponse> {
  const idempotencyKey = crypto.randomUUID();
  return cfPost<DrawResponse>('/api/gacha/draw', { drawType, count, idempotencyKey });
}

/** Claims daily login reward (1-5 normal draws + 1 golden draw) */
export async function claimDailyReward(): Promise<DailyRewardResponse> {
  return cfPost<DailyRewardResponse>('/api/gacha/daily-reward', {});
}

/** Exchanges shards for the specified item (idempotent: retrying with the same idempotencyKey returns the same result) */
export async function exchangeShard(rewardId: string): Promise<ExchangeResponse> {
  const idempotencyKey = crypto.randomUUID();
  return cfPost<ExchangeResponse>('/api/gacha/exchange', { rewardId, idempotencyKey });
}
