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

import { apiClient } from '@/platform/http/client';

export type DrawResultItem = GachaDrawResultItem;
export type DrawResponse = GachaDrawResponse;
export type DailyRewardResponse = GachaDailyRewardResponse;
export type ExchangeResponse = GachaExchangeResponse;

/** Gets the current user's gacha status */
export async function fetchGachaStatus(signal?: AbortSignal): Promise<GachaStatus> {
  return apiClient.json({
    method: 'GET',
    path: '/api/gacha/status',
    auth: 'required',
    idempotent: true,
    decode: parseGachaStatus,
    signal,
  });
}

/** Performs a draw; the server replays the cached response for a repeated idempotencyKey. */
export async function performDraw(
  drawType: 'normal' | 'golden',
  count: number,
  idempotencyKey: string,
): Promise<DrawResponse> {
  return apiClient.json({
    method: 'POST',
    path: '/api/gacha/draw',
    auth: 'required',
    idempotent: true,
    body: { drawType, count, idempotencyKey },
    decode: parseGachaDrawResponse,
  });
}

/** Claims the daily login reward; the server's cooldown rejects a duplicate claim. */
export async function claimDailyReward(): Promise<DailyRewardResponse> {
  return apiClient.json({
    method: 'POST',
    path: '/api/gacha/daily-reward',
    auth: 'required',
    idempotent: true,
    body: {},
    decode: parseGachaDailyRewardResponse,
  });
}

/** Exchanges shards for an item; the server replays the cached response for a repeated idempotencyKey. */
export async function exchangeShard(
  rewardId: string,
  idempotencyKey: string,
): Promise<ExchangeResponse> {
  return apiClient.json({
    method: 'POST',
    path: '/api/gacha/exchange',
    auth: 'required',
    idempotent: true,
    body: { rewardId, idempotencyKey },
    decode: parseGachaExchangeResponse,
  });
}
