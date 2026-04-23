/**
 * useGachaQuery — 扭蛋状态查询 + 抽奖 mutation + 每日登录奖励
 *
 * useGachaStatusQuery: 查询抽奖券数量/pity/已解锁数/每日奖励状态
 * useDrawMutation: 执行抽奖并自动刷新 gachaStatus + userStats cache
 * useClaimDailyRewardMutation: 领取每日登录奖励
 * useAutoClaimDailyReward: 自动检测并领取每日奖励 + toast 提示
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner-native';

import {
  claimDailyReward,
  type DailyRewardResponse,
  type DrawResponse,
  performDraw,
} from '@/services/feature/GachaService';

import { gachaStatusOptions, userStatsOptions } from './queryOptions';
import { useAuthenticatedQuery } from './useAuthenticatedQuery';

/** Player's local date as YYYY-MM-DD */
function getLocalDate(): string {
  return new Date().toLocaleDateString('en-CA');
}

/**
 * useGachaStatusQuery — 扭蛋状态（抽奖券/pity/已解锁数）。
 *
 * 匿名用户 / auth 未完成时 enabled=false，不发请求。
 */
export function useGachaStatusQuery(options?: { enabled?: boolean }) {
  return useAuthenticatedQuery({
    ...gachaStatusOptions(),
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
      void queryClient.invalidateQueries({ queryKey: gachaStatusOptions().queryKey });
      void queryClient.invalidateQueries({ queryKey: userStatsOptions().queryKey });
    },
  });
}

function useClaimDailyRewardMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => claimDailyReward(getLocalDate()),
    onSuccess: (data: DailyRewardResponse) => {
      if (data.claimed) {
        void queryClient.invalidateQueries({ queryKey: gachaStatusOptions().queryKey });
      }
    },
  });
}

/**
 * useAutoClaimDailyReward — gacha status 加载后自动领取每日奖励。
 *
 * 检查 lastLoginRewardAt !== 今天本地日期 → 自动 claim → toast。
 * 一个 session 内只尝试一次（useRef guard）。
 */
export function useAutoClaimDailyReward() {
  const { data: status } = useGachaStatusQuery();
  const { mutate: claimDailyReward, isPending: isClaimPending } = useClaimDailyRewardMutation();
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (attemptedRef.current || !status || isClaimPending) return;

    const today = getLocalDate();
    if (status.lastLoginRewardAt?.startsWith(today)) return;

    attemptedRef.current = true;
    claimDailyReward(undefined, {
      onSuccess: (data) => {
        if (data.claimed) {
          toast.success('每日登录奖励', { description: '获得 1 次普通抽！' });
        }
      },
    });
  }, [status, claimDailyReward, isClaimPending]);
}
