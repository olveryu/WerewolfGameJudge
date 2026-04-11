/**
 * useSettleToast — 结算 XP/升级 toast 通知
 *
 * 订阅 facade.addSettleResultListener，收到 SETTLE_RESULT 时显示：
 * - 普通获取 XP："+{xp} XP"
 * - 升级 + 解锁奖励："升级！Lv.{n} 解锁 {奖励名}"
 */

import { getRoleDisplayName } from '@werewolf/game-engine/models/roles';
import { useEffect } from 'react';
import { toast } from 'sonner-native';

import { AVATAR_FRAMES } from '@/components/avatarFrames';
import type { IGameFacade } from '@/services/types/IGameFacade';
import type { SettleResultMessage } from '@/services/types/IRealtimeTransport';

interface UseSettleToastParams {
  facade: IGameFacade;
  isFocused: boolean;
}

function getRewardDisplayName(reward: { type: string; id: string }): string {
  if (reward.type === 'avatar') {
    return `头像「${getRoleDisplayName(reward.id)}」`;
  }
  const frame = AVATAR_FRAMES.find((f) => f.id === reward.id);
  return `头像框「${frame?.name ?? reward.id}」`;
}

function showSettleToast(result: SettleResultMessage): void {
  const leveledUp = result.newLevel > result.previousLevel;

  if (leveledUp && result.reward) {
    toast.success(`升级！Lv.${result.newLevel} 解锁${getRewardDisplayName(result.reward)}`, {
      description: `+${result.xpEarned} XP`,
    });
  } else if (leveledUp) {
    toast.success(`升级！Lv.${result.newLevel}`, {
      description: `+${result.xpEarned} XP`,
    });
  } else {
    toast.info(`+${result.xpEarned} XP`);
  }
}

export function useSettleToast({ facade, isFocused }: UseSettleToastParams): void {
  useEffect(() => {
    if (!isFocused) return;

    const unsub = facade.addSettleResultListener((result) => {
      showSettleToast(result);
    });

    return unsub;
  }, [facade, isFocused]);
}
