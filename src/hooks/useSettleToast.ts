/**
 * useSettleToast — 结算 XP/升级/抽奖券 toast 通知
 *
 * 订阅 facade.addSettleResultListener，收到 SETTLE_RESULT 时显示：
 * - 升级 + 黄金券："升级 Lv.{n}！获得黄金抽奖券"
 * - 普通获取 XP + 抽奖券："+{xp} XP · 获得抽奖券"
 *
 * 同时 invalidate gachaStatus + userStats query，触发 header badge 刷新。
 */

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toast } from 'sonner-native';

import type { IGameFacade } from '@/services/types/IGameFacade';
import type { SettleResultMessage } from '@/services/types/IRealtimeTransport';
import { gameRoomLog } from '@/utils/logger';

import { queryKeys } from './queries/queryKeys';

interface UseSettleToastParams {
  facade: IGameFacade;
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

export function useSettleToast({ facade, isFocused }: UseSettleToastParams): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isFocused) return;

    const unsub = facade.addSettleResultListener((result) => {
      showSettleToast(result);

      // Refresh cached ticket counts so header badge updates immediately
      void queryClient.invalidateQueries({ queryKey: queryKeys.gachaStatus() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.userStats() });
    });

    return unsub;
  }, [facade, isFocused, queryClient]);
}
