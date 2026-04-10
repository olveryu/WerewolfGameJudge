/**
 * StatsService — 用户成长数据客户端 service
 *
 * 只读查询：获取用户 XP/等级/局数/角色收集数/上局月相。
 * 使用 cfGet 统一封装（自动注入 token + 超时 + 错误处理）。
 */

import { cfGet } from '@/services/cloudflare/cfFetch';

export interface UserStats {
  xp: number;
  level: number;
  gamesPlayed: number;
  rolesCollected: number;
  totalRoles: number;
  lastMoonPhase: { id: string; xpEarned: number } | null;
}

/** 获取当前用户的成长数据 */
export async function fetchUserStats(): Promise<UserStats> {
  return cfGet<UserStats>('/api/user/stats');
}
