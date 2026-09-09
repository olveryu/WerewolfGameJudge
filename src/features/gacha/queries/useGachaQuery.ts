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

import { useAuthContext } from '@/contexts/AuthContext';
import { useServices } from '@/contexts/ServiceContext';
import { userStatsOptions } from '@/features/account/queries/accountQueryOptions';
import { useAuthenticatedQuery } from '@/features/auth/queries/useAuthenticatedQuery';
import {
  claimDailyReward,
  type DailyRewardResponse,
  type DrawResponse,
  type ExchangeResponse,
  exchangeShard,
  performDraw,
} from '@/features/gacha/services/gachaApi';
import { gachaLog } from '@/utils/logger';

import { gachaStatusOptions } from './gachaQueryOptions';

/**
 * useGachaStatusQuery — gacha status (ticket count/pity/unlocked count).
 *
 * enabled=false for anonymous users or when auth is not yet complete; no request is made.
 */
export function useGachaStatusQuery(options?: { enabled?: boolean }) {
  const { user } = useAuthContext();
  return useAuthenticatedQuery({
    ...gachaStatusOptions(user?.id ?? null),
    ...options,
  });
}

export function useDrawMutation() {
  const queryClient = useQueryClient();
  const { authService } = useServices();

  return useMutation({
    mutationKey: ['gacha', 'draw'],
    onMutate: () => authService.getAuthSession(),
    mutationFn: ({ drawType, count }: { drawType: 'normal' | 'golden'; count?: number }) => {
      gachaLog.debug('Draw requested', { drawType, count });
      return performDraw(drawType, count);
    },
    onSuccess: (data: DrawResponse, { drawType, count }, session) => {
      if (!session || session !== authService.getAuthSession()) return;
      const rarities = data.results.map((r) => r.rarity);
      gachaLog.info('Draw success', { drawType, count, rarities });
      // Invalidate both gacha status and user stats (unlocked items changed)
      void queryClient.invalidateQueries({ queryKey: gachaStatusOptions(session.userId).queryKey });
      void queryClient.invalidateQueries({ queryKey: userStatsOptions(session.userId).queryKey });
    },
  });
}

function useClaimDailyRewardMutation() {
  const queryClient = useQueryClient();
  const { authService } = useServices();

  return useMutation({
    onMutate: () => authService.getAuthSession(),
    mutationFn: claimDailyReward,
    onSuccess: (data: DailyRewardResponse, _variables, session) => {
      if (!session || session !== authService.getAuthSession()) return;
      if (data.claimed) {
        void queryClient.invalidateQueries({
          queryKey: gachaStatusOptions(session.userId).queryKey,
        });
      }
    },
  });
}

/**
 * useAutoClaimDailyReward — auto-claims the daily reward after gacha status loads.
 *
 * Attempts once per session; the server is the sole authority for the 20-hour cooldown.
 */
export function useAutoClaimDailyReward() {
  const { user } = useAuthContext();
  const userId = user?.id ?? null;
  const { data: status } = useGachaStatusQuery();
  const { mutate: claimDailyReward, isPending: isClaimPending } = useClaimDailyRewardMutation();
  const attemptedRef = useRef<string | null>(null);

  useEffect(() => {
    if (userId === null || attemptedRef.current === userId || !status || isClaimPending) return;

    attemptedRef.current = userId;
    claimDailyReward(undefined, {
      onSuccess: (data) => {
        if (data.claimed) {
          toast.success('每日登录奖励', {
            description: `获得 ${data.normalDrawsAdded} 次普通抽 + ${data.goldenDrawsAdded} 次黄金抽！`,
          });
        }
      },
      onError: (err) => {
        gachaLog.warn('Auto claim daily reward failed', { error: String(err) });
      },
    });
  }, [status, claimDailyReward, isClaimPending, userId]);
}

export function useExchangeShardMutation() {
  const queryClient = useQueryClient();
  const { authService } = useServices();

  return useMutation({
    onMutate: () => authService.getAuthSession(),
    mutationFn: (rewardId: string) => {
      gachaLog.debug('Exchange requested', { rewardId });
      return exchangeShard(rewardId);
    },
    onSuccess: (data: ExchangeResponse, _variables, session) => {
      if (!session || session !== authService.getAuthSession()) return;
      gachaLog.info('Exchange success', {
        rewardId: data.rewardId,
        cost: data.cost,
        remainingShards: data.remainingShards,
      });
      void queryClient.invalidateQueries({ queryKey: gachaStatusOptions(session.userId).queryKey });
      void queryClient.invalidateQueries({ queryKey: userStatsOptions(session.userId).queryKey });
    },
  });
}
