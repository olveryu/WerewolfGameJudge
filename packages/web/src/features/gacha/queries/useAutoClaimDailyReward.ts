/** Daily login reward: claimed automatically once per signed-in account, wherever the app opens. */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

import { useAuthContext } from '@/contexts/AuthContext';
import { useServices } from '@/contexts/ServiceContext';
import { claimDailyReward, type DailyRewardResponse } from '@/features/gacha/services/gachaApi';
import { gachaLog } from '@/utils/logger';

import { gachaStatusOptions } from './gachaQueryOptions';
import { useGachaStatusQuery } from './useGachaQuery';

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
 * Claims the daily reward after gacha status loads. Attempts once per account session; the
 * server is the sole authority for the 20-hour cooldown.
 */
export function useAutoClaimDailyReward() {
  const { user } = useAuthContext();
  const { authService } = useServices();
  const userId = user?.id ?? null;
  const { data: status } = useGachaStatusQuery();
  const { mutate: claim, isPending: isClaimPending } = useClaimDailyRewardMutation();
  const attemptedRef = useRef<string | null>(null);

  useEffect(() => {
    if (userId === null) {
      attemptedRef.current = null;
      return;
    }
    if (attemptedRef.current === userId || !status || isClaimPending) return;

    attemptedRef.current = userId;
    const session = authService.getAuthSession();
    claim(undefined, {
      onSuccess: (data) => {
        if (session === null || authService.getAuthSession() !== session) return;
        if (data.claimed) {
          toast.success('每日登录奖励', {
            description: `获得 ${data.normalDrawsAdded} 次普通抽 + ${data.goldenDrawsAdded} 次黄金抽！`,
          });
        }
      },
      onError: (error) => {
        if (session === null || authService.getAuthSession() !== session) return;
        gachaLog.warn('Auto claim daily reward failed', { error: String(error) });
      },
    });
  }, [status, claim, isClaimPending, userId, authService]);
}
