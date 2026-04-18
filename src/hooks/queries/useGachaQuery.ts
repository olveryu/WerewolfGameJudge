/**
 * useGachaQuery — 扭蛋状态查询 + 抽奖 mutation
 *
 * useGachaStatusQuery: 查询抽奖券数量/pity/已解锁数
 * useDrawMutation: 执行抽奖并自动刷新 gachaStatus + userStats cache
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { type DrawResponse, fetchGachaStatus, performDraw } from '@/services/feature/GachaService';

import { queryKeys } from './queryKeys';
import { useAuthenticatedQuery } from './useAuthenticatedQuery';

/**
 * useGachaStatusQuery — 扭蛋状态（抽奖券/pity/已解锁数）。
 *
 * 匿名用户 / auth 未完成时 enabled=false，不发请求。
 */
export function useGachaStatusQuery(options?: { enabled?: boolean }) {
  return useAuthenticatedQuery({
    queryKey: queryKeys.gachaStatus(),
    queryFn: fetchGachaStatus,
    ...options,
  });
}

export function useDrawMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ drawType, count }: { drawType: 'normal' | 'golden'; count?: number }) =>
      performDraw(drawType, count),
    onSuccess: (_data: DrawResponse) => {
      // Invalidate both gacha status and user stats (unlocked items changed)
      void queryClient.invalidateQueries({ queryKey: queryKeys.gachaStatus() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.userStats() });
    },
  });
}
