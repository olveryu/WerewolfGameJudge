/**
 * StatsService — 用户成长数据客户端 service
 *
 * 只读查询：获取用户 XP/等级/局数、查看其他玩家公开资料。
 * 使用 cfGet 统一封装（自动注入 token + 超时 + 错误处理）。
 */

import { cfGet } from '@/services/cloudflare/cfFetch';

export interface UserStats {
  xp: number;
  level: number;
  gamesPlayed: number;
  unlockedItems: readonly string[];
}

export interface UserPublicProfile {
  displayName: string;
  avatarUrl?: string;
  avatarFrame?: string;
  seatFlair?: string;
  level: number;
  title: string;
  xp: number;
  gamesPlayed: number;
  unlockedItemCount: number;
  /** 最近解锁的物品 ID（最多 4 个），用于资料卡精选展示 */
  showcaseItems: readonly string[];
}

/** 获取当前用户的成长数据 */
export async function fetchUserStats(): Promise<UserStats> {
  return cfGet<UserStats>('/api/user/stats');
}

/** 获取指定用户的公开资料 */
export async function fetchUserProfile(userId: string): Promise<UserPublicProfile> {
  return cfGet<UserPublicProfile>(`/api/user/${encodeURIComponent(userId)}/profile`);
}
