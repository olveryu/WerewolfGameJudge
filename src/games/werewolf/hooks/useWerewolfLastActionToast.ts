/**
 * useWerewolfLastActionToast — passive-action toast notifications
 *
 * Detects lastCommandType in STATE_UPDATE broadcasts,
 * shows toast notifications to non-Host players (kick/clearAllSeats/assignRoles/startNight/endNight/restartGame).
 * Uses the immutable session command marker keyed by revision.
 */

import { useEffect, useRef } from 'react';
import { toast } from 'sonner-native';

import { gameRoomLog } from '@/utils/logger';

interface UseLastActionToastParams {
  lastCommand: { readonly revision: number; readonly type: string } | null;
  isHost: boolean;
  mySeat: number | null;
  isFocused: boolean;
}

/**
 * Toast display rules:
 * - KICK_PLAYER: kicked player (seat number -> null and non-Host)
 * - CLEAR_ALL_SEATS: seated non-Host players (seat number -> null)
 * - ASSIGN_ROLES / START_NIGHT / END_NIGHT / RESTART_GAME: non-Host players
 */
export function useWerewolfLastActionToast({
  lastCommand,
  isHost,
  mySeat,
  isFocused,
}: UseLastActionToastParams): void {
  const prevSeatRef = useRef(mySeat);
  const handledRevisionRef = useRef<number | null>(null);

  // Track seat changes for kick/clearAllSeats detection
  useEffect(() => {
    if (!isFocused) return;

    const prevSeat = prevSeatRef.current;
    prevSeatRef.current = mySeat;

    if (lastCommand === null || handledRevisionRef.current === lastCommand.revision) return;
    handledRevisionRef.current = lastCommand.revision;
    if (isHost) return;

    gameRoomLog.debug('lastCommandType handled', { commandType: lastCommand.type });

    switch (lastCommand.type) {
      case 'KICK_PLAYER':
        if (prevSeat !== null && mySeat === null) {
          toast.warning(`你已被移出 ${prevSeat} 号座位`);
        }
        break;
      case 'CLEAR_ALL_SEATS':
        if (prevSeat !== null && mySeat === null) {
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
  }, [isFocused, isHost, lastCommand, mySeat]);
}
