/**
 * useGachaQuery — gacha status query + draw mutation + daily login reward
 *
 * useGachaStatusQuery: queries ticket count/pity/unlocked count/daily reward status
 * useDrawMutation: performs a draw and auto-invalidates gachaStatus + userStats cache
 * useClaimDailyRewardMutation: claims the daily login reward
 * useAutoClaimDailyReward: auto-detects and claims daily reward + shows a toast
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner-native';

import {
  claimDailyReward,
  type DailyRewardResponse,
  type DrawResponse,
  type ExchangeResponse,
  exchangeShard,
  performDraw,
} from '@/services/feature/GachaService';
import { gachaLog } from '@/utils/logger';

import { gachaStatusOptions, userStatsOptions } from './queryOptions';
import { useAuthenticatedQuery } from './useAuthenticatedQuery';

/** Player's local date as YYYY-MM-DD (locale-independent, zero-padded) */
function getLocalDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * useGachaStatusQuery — gacha status (ticket count/pity/unlocked count).
 *
 * enabled=false for anonymous users or when auth is not yet complete; no request is made.
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
    mutationKey: ['gacha', 'draw'],
    mutationFn: ({ drawType, count }: { drawType: 'normal' | 'golden'; count?: number }) => {
      gachaLog.debug('Draw requested', { drawType, count });
      return performDraw(drawType, count);
    },
    onSuccess: (data: DrawResponse, { drawType, count }) => {
      const rarities = data.results.map((r) => r.rarity);
      gachaLog.info('Draw success', { drawType, count, rarities });
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
 * useAutoClaimDailyReward — auto-claims the daily reward after gacha status loads.
 *
 * Checks lastLoginRewardAt !== today's local date → auto-claim → toast.
 * Attempts only once per session (useRef guard).
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
          toast.success('每日登录奖励', {
            description: `获得 ${data.normalDrawsAdded ?? 1} 次普通抽 + ${data.goldenDrawsAdded ?? 1} 次黄金抽！`,
          });
        }
      },
      onError: (err) => {
        gachaLog.warn('Auto claim daily reward failed', { error: String(err) });
      },
    });
  }, [status, claimDailyReward, isClaimPending]);
}

export function useExchangeShardMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rewardId: string) => {
      gachaLog.debug('Exchange requested', { rewardId });
      return exchangeShard(rewardId);
    },
    onSuccess: (data: ExchangeResponse) => {
      gachaLog.info('Exchange success', {
        rewardId: data.rewardId,
        cost: data.cost,
        remainingShards: data.remainingShards,
      });
      void queryClient.invalidateQueries({ queryKey: gachaStatusOptions().queryKey });
      void queryClient.invalidateQueries({ queryKey: userStatsOptions().queryKey });
    },
  });
}
