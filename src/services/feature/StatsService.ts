/**
 * StatsService — 用户成长数据客户端 service
 *
 * 只读查询：获取用户 XP/等级/局数、查看其他玩家公开资料。
 * 使用 cfGet 统一封装（自动注入 token + 超时 + 错误处理）。
 */

import { cfGet } from '@/services/cloudflare/cfFetch';
import { statsLog } from '@/utils/logger';

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
  nameStyle?: string;
  level: number;
  title: string;
  xp: number;
  gamesPlayed: number;
  unlockedItemCount: number;
}

// ── Anonymous guard (provider injected by CFAuthService) ──

let isAnonymousProvider: (() => boolean) | null = null;

export function setAnonymousProvider(provider: () => boolean): void {
  isAnonymousProvider = provider;
}

const ANONYMOUS_STATS: UserStats = { xp: 0, level: 0, gamesPlayed: 0, unlockedItems: [] };

/** 获取当前用户的成长数据。匿名用户直接返回零值，不发请求。 */
export async function fetchUserStats(): Promise<UserStats> {
  if (isAnonymousProvider?.()) return ANONYMOUS_STATS;
  statsLog.debug('Fetching user stats');
  return cfGet<UserStats>('/api/user/stats');
}

/** 获取指定用户的公开资料 */
export async function fetchUserProfile(userId: string): Promise<UserPublicProfile> {
  statsLog.debug('Fetching profile', { userId });
  return cfGet<UserPublicProfile>(`/api/user/${encodeURIComponent(userId)}/profile`);
}

/** 获取指定用户的已解锁物品列表 */
export async function fetchUserUnlocks(
  userId: string,
): Promise<{ unlockedItems: readonly string[] }> {
  statsLog.debug('Fetching unlocks', { userId });
  return cfGet<{ unlockedItems: readonly string[] }>(
    `/api/user/${encodeURIComponent(userId)}/unlocks`,
  );
}
