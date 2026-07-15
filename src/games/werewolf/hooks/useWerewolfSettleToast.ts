/**
 * useWerewolfSettleToast -- settle XP/level-up/draw-ticket toast notifications
 *
 * Registers the Werewolf handler on the shared room session; on SETTLE_RESULT shows:
 * - Level-up + golden ticket: "升级 Lv.{n}！获得黄金抽奖券"
 * - Normal XP + tickets: "+{xp} XP · 获得抽奖券"
 *
 * Also invalidates gachaStatus + userStats queries to refresh the header badge.
 */

import { useQueryClient } from '@tanstack/react-query';
import type { WerewolfPublicCommand } from '@werewolf/game-engine/games/werewolf/public';
import type { GameState } from '@werewolf/game-engine/games/werewolf/public';
import { useEffect } from 'react';
import { toast } from 'sonner-native';

import { userStatsOptions } from '@/features/account/queries/accountQueryOptions';
import { gachaStatusOptions } from '@/features/gacha/queries/gachaQueryOptions';
import type { RoomSessionClient } from '@/features/room/session/types';
import type {
  WerewolfSettlementEvent,
  WerewolfUserEvent,
} from '@/games/werewolf/realtime/werewolfUserEventCodec';
import { gameRoomLog } from '@/utils/logger';

interface UseSettleToastParams {
  session: RoomSessionClient<GameState, WerewolfPublicCommand, WerewolfUserEvent>;
  isFocused: boolean;
}

function showSettleToast(result: WerewolfSettlementEvent): void {
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
 * @param params.session - Active shared room session
 * @param params.isFocused - Whether the current screen is focused (avoid background toasts)
 */
export function useWerewolfSettleToast({ session, isFocused }: UseSettleToastParams): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isFocused) return;

    const unsub = session.setUserEventHandler(async (result) => {
      showSettleToast(result);

      // Refresh cached ticket counts so header badge updates immediately
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: gachaStatusOptions().queryKey }),
        queryClient.invalidateQueries({ queryKey: userStatsOptions().queryKey }),
      ]);
    });

    return unsub;
  }, [isFocused, queryClient, session]);
}
