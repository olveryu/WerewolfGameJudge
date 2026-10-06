/** Shared confirmation and submission handling for destructive room-wide operations. */

import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { useCallback, useMemo } from 'react';

import { useRoomAlert } from '@/features/room/components/RoomAlertContext';
import { getRoomCommandFailureReason } from '@/features/room/session/roomCommandResult';
import type { RoomCommandDispatchOutcome } from '@/features/room/session/types';
import { translateReasonCode } from '@/utils/errorUtils';

import { useRoomCommandSubmission } from './useRoomCommandSubmission';

interface UseRoomHostOperationsParams<TState extends BaseGameState<string>> {
  readonly clearSeats: () => Promise<RoomCommandDispatchOutcome<TState>>;
  readonly fillBots: () => Promise<RoomCommandDispatchOutcome<TState>>;
}

export interface RoomHostOperations {
  readonly requestClearSeats: () => void;
  readonly requestFillBots: () => void;
}

export function useRoomHostOperations<TState extends BaseGameState<string>>({
  clearSeats,
  fillBots,
}: UseRoomHostOperationsParams<TState>): RoomHostOperations {
  const { showRoomAlert } = useRoomAlert();
  const getFailureMessage = useCallback((result: RoomCommandDispatchOutcome<TState>): string => {
    const reason = getRoomCommandFailureReason(result);
    return translateReasonCode(reason);
  }, []);
  const { submit } = useRoomCommandSubmission(getFailureMessage);

  const requestClearSeats = useCallback(() => {
    showRoomAlert({
      title: '清空所有座位？',
      message: '所有玩家会离开座位，机器人填充也会关闭。',
      buttons: [
        { text: '取消', style: 'cancel' },
        {
          text: '清空座位',
          style: 'destructive',
          onPress: async () => {
            await submit('清空座位', clearSeats);
          },
        },
      ],
    });
  }, [clearSeats, submit, showRoomAlert]);

  const requestFillBots = useCallback(() => {
    showRoomAlert({
      title: '填充机器人？',
      message: '机器人会补满当前所有空位。',
      buttons: [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          style: 'default',
          onPress: async () => {
            await submit('填充机器人', fillBots);
          },
        },
      ],
    });
  }, [fillBots, submit, showRoomAlert]);

  return useMemo(
    () => ({ requestClearSeats, requestFillBots }),
    [requestClearSeats, requestFillBots],
  );
}
