/**
 * GachaService — 扭蛋/抽奖客户端 service
 *
 * 查询抽奖状态、执行抽奖、领取每日登录奖励。
 * 使用 cfGet/cfPost 统一封装。
 */

import type { Rarity, RewardType } from '@werewolf/game-engine/growth/rewardCatalog';

import { cfGet, cfPost } from '@/services/cloudflare/cfFetch';

interface GachaStatus {
  normalDraws: number;
  goldenDraws: number;
  normalPity: number;
  goldenPity: number;
  unlockedCount: number;
  lastLoginRewardAt: string | null;
}

export interface DrawResultItem {
  rarity: Rarity;
  rewardType: RewardType;
  rewardId: string;
  isNew: boolean;
  isPityTriggered: boolean;
}

export interface DrawResponse {
  results: DrawResultItem[];
  remaining: {
    normalDraws: number;
    goldenDraws: number;
  };
}

export interface DailyRewardResponse {
  claimed: boolean;
  normalDrawsAdded?: number;
  reason?: string;
}

/** 获取当前用户的抽奖状态 */
export async function fetchGachaStatus(): Promise<GachaStatus> {
  return cfGet<GachaStatus>('/api/gacha/status');
}

/** 执行抽奖（非幂等操作，禁用网络层自动重试） */
export async function performDraw(
  drawType: 'normal' | 'golden',
  count: number = 1,
): Promise<DrawResponse> {
  return cfPost<DrawResponse>('/api/gacha/draw', { drawType, count }, { noRetry: true });
}

/** 领取每日登录奖励（1 次普通抽） */
export async function claimDailyReward(localDate: string): Promise<DailyRewardResponse> {
  return cfPost<DailyRewardResponse>('/api/gacha/daily-reward', { localDate });
}
