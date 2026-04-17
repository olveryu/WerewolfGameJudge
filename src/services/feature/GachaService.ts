/**
 * GachaService — 扭蛋/抽奖客户端 service
 *
 * 查询抽奖状态、执行抽奖。
 * 使用 cfGet/cfPost 统一封装。
 */

import type { Rarity } from '@werewolf/game-engine';

import { cfGet, cfPost } from '@/services/cloudflare/cfFetch';

export interface GachaStatus {
  normalDraws: number;
  goldenDraws: number;
  normalPity: number;
  goldenPity: number;
  unlockedCount: number;
}

export interface DrawResultItem {
  rarity: Rarity;
  rewardType: string;
  rewardId: string;
  isNew: boolean;
  pityTriggered: boolean;
}

export interface DrawResponse {
  results: DrawResultItem[];
  remaining: {
    normalDraws: number;
    goldenDraws: number;
  };
}

/** 获取当前用户的抽奖状态 */
export async function fetchGachaStatus(): Promise<GachaStatus> {
  return cfGet<GachaStatus>('/api/gacha/status');
}

/** 执行抽奖 */
export async function performDraw(
  drawType: 'normal' | 'golden',
  count: number = 1,
): Promise<DrawResponse> {
  return cfPost<DrawResponse>('/api/gacha/draw', { drawType, count });
}
