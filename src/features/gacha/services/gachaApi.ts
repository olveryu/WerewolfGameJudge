/**
 * gachaApi — gacha/draw client API
 *
 * Queries draw status, performs draws, claims daily login rewards, and exchanges shards.
 * Wrapped uniformly via cfGet/cfPost.
 */

import {
  type GachaDailyRewardResponse,
  type GachaDrawResponse,
  type GachaDrawResultItem,
  type GachaExchangeResponse,
  type GachaStatus,
  parseGachaDailyRewardResponse,
  parseGachaDrawResponse,
  parseGachaExchangeResponse,
  parseGachaStatus,
} from '@game-judge/game-engine/product/rewards';

import { cfGet, cfPost } from '@/services/cloudflare/cfFetch';

export type DrawResultItem = GachaDrawResultItem;
export type DrawResponse = GachaDrawResponse;
export type DailyRewardResponse = GachaDailyRewardResponse;
export type ExchangeResponse = GachaExchangeResponse;

/** Gets the current user's gacha status */
export async function fetchGachaStatus(): Promise<GachaStatus> {
  return cfGet('/api/gacha/status', parseGachaStatus);
}

/** Performs a draw (idempotent: retrying with the same idempotencyKey returns the same result) */
export async function performDraw(
  drawType: 'normal' | 'golden',
  count: number = 1,
): Promise<DrawResponse> {
  const idempotencyKey = crypto.randomUUID();
  return cfPost('/api/gacha/draw', { drawType, count, idempotencyKey }, parseGachaDrawResponse);
}

/** Claims daily login reward (1-5 normal draws + 1 golden draw) */
export async function claimDailyReward(): Promise<DailyRewardResponse> {
  return cfPost('/api/gacha/daily-reward', {}, parseGachaDailyRewardResponse);
}

/** Exchanges shards for the specified item (idempotent: retrying with the same idempotencyKey returns the same result) */
export async function exchangeShard(rewardId: string): Promise<ExchangeResponse> {
  const idempotencyKey = crypto.randomUUID();
  return cfPost('/api/gacha/exchange', { rewardId, idempotencyKey }, parseGachaExchangeResponse);
}
