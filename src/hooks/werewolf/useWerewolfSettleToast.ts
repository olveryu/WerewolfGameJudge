/**
 * useWerewolfSettleToast -- settle XP/level-up/draw-ticket toast notifications
 *
 * Subscribes to facade.addSettleResultListener; on SETTLE_RESULT shows:
 * - Level-up + golden ticket: "升级 Lv.{n}！获得黄金抽奖券"
 * - Normal XP + tickets: "+{xp} XP · 获得抽奖券"
 *
 * Also invalidates gachaStatus + userStats queries to refresh the header badge.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toast } from 'sonner-native';

import type { IWerewolfFacade } from '@/services/games/werewolf/IWerewolfFacade';
import type { SettleResultMessage } from '@/services/types/IRealtimeTransport';
import { gameRoomLog } from '@/utils/logger';

import { gachaStatusOptions, userStatsOptions } from '../queries/queryOptions';

interface UseSettleToastParams {
  facade: IWerewolfFacade;
  isFocused: boolean;
}

function showSettleToast(result: SettleResultMessage): void {
  const leveledUp = result.newLevel > result.previousLevel;
  gameRoomLog.debug('Settle toast', { xpEarned: result.xpEarned, leveledUp });

  if (leveledUp && result.goldenDrawsEarned > 0) {
    toast.success(`升级 Lv.${result.newLevel}！获得黄金抽奖券`, {
      description: `+${result.xpEarned} XP · 获得 ${result.normalDrawsEarned} 张抽奖券`,
      duration: 10000,
    });
  } else if (leveledUp) {
    toast.success(`升级 Lv.${result.newLevel}！`, {
      description: `+${result.xpEarned} XP · 获得 ${result.normalDrawsEarned} 张抽奖券`,
      duration: 10000,
    });
  } else if (result.normalDrawsEarned > 0) {
    toast.info(`+${result.xpEarned} XP · 获得 ${result.normalDrawsEarned} 张抽奖券`, {
      duration: 10000,
    });
  } else {
    toast.info(`+${result.xpEarned} XP`, { duration: 10000 });
  }
}

/**
 * Listen for settle results, pop XP/level-up toast, and refresh gacha/stats query cache.
 *
 * @param params.facade - WerewolfFacade instance
 * @param params.isFocused - Whether the current screen is focused (avoid background toasts)
 */
export function useWerewolfSettleToast({ facade, isFocused }: UseSettleToastParams): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isFocused) return;

    const unsub = facade.addSettleResultListener((result) => {
      showSettleToast(result);

      // Refresh cached ticket counts so header badge updates immediately
      void queryClient.invalidateQueries({ queryKey: gachaStatusOptions().queryKey });
      void queryClient.invalidateQueries({ queryKey: userStatsOptions().queryKey });
    });

    return unsub;
  }, [facade, isFocused, queryClient]);
}
