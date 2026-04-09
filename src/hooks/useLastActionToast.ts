/**
 * useLastActionToast — 被动操作 toast 通知
 *
 * 检测 STATE_UPDATE 广播中的 lastAction envelope，
 * 为非 Host 玩家显示 toast 通知（kick/clearAllSeats/assignRoles/startNight/endNight/restartGame）。
 * 使用 consumeLastAction 一次性消费，不影响其他逻辑。
 */

import { useEffect, useRef } from 'react';
import { toast } from 'sonner-native';

import type { IGameFacade } from '@/services/types/IGameFacade';

interface UseLastActionToastParams {
  facade: IGameFacade;
  isHost: boolean;
  mySeatNumber: number | null;
  isFocused: boolean;
}

/**
 * Toast 显示规则：
 * - KICK_PLAYER: 被踢玩家（seat number→null 且非 Host）
 * - CLEAR_ALL_SEATS: 非 Host 在座玩家（seat number→null）
 * - ASSIGN_ROLES / START_NIGHT / END_NIGHT / RESTART_GAME: 非 Host 玩家
 */
export function useLastActionToast({
  facade,
  isHost,
  mySeatNumber,
  isFocused,
}: UseLastActionToastParams): void {
  const prevSeatRef = useRef(mySeatNumber);

  // Track seat changes for kick/clearAllSeats detection
  useEffect(() => {
    if (!isFocused) return;

    const prevSeat = prevSeatRef.current;
    prevSeatRef.current = mySeatNumber;

    const lastAction = facade.consumeLastAction();
    if (!lastAction || isHost) return;

    switch (lastAction) {
      case 'KICK_PLAYER':
        if (prevSeat !== null && mySeatNumber === null) {
          toast.warning(`你已被移出 ${prevSeat} 号座位`);
        }
        break;
      case 'CLEAR_ALL_SEATS':
        if (prevSeat !== null && mySeatNumber === null) {
          toast.warning('房主已清空所有座位');
        }
        break;
      case 'ASSIGN_ROLES':
        toast.info('角色已分配，点击你的座位查看');
        break;
      case 'START_NIGHT':
        toast.info('夜幕降临，请等待指示');
        break;
      case 'END_NIGHT':
        toast.info('天亮了，请查看顶部发言顺序');
        break;
      case 'RESTART_GAME':
        toast.info('房主已重新开始游戏');
        break;
    }
  }, [facade, isHost, mySeatNumber, isFocused]);
}
