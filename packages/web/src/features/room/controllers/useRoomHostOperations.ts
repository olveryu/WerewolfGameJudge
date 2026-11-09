/** Shared confirmation and submission handling for destructive room-wide operations. */

import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { useCallback, useMemo } from 'react';

import { getRoomCommandFailureReason } from '@/features/room/link/roomCommandResult';
import type { DispatchOutcome } from '@/platform/realtime/types';
import { showConfirmAlert, showDestructiveAlert } from '@/utils/alertPresets';
import { translateReasonCode } from '@/utils/errorUtils';

import { useRoomCommandSubmission } from './useRoomCommandSubmission';

interface UseRoomHostOperationsParams<TState extends BaseGameState<string>> {
  readonly clearSeats: () => Promise<DispatchOutcome<TState>>;
  readonly fillBots: () => Promise<DispatchOutcome<TState>>;
}

export interface RoomHostOperations {
  readonly requestClearSeats: () => void;
  readonly requestFillBots: () => void;
}

export function useRoomHostOperations<TState extends BaseGameState<string>>({
  clearSeats,
  fillBots,
}: UseRoomHostOperationsParams<TState>): RoomHostOperations {
  const getFailureMessage = useCallback((result: DispatchOutcome<TState>): string => {
    const reason = getRoomCommandFailureReason(result);
    return translateReasonCode(reason);
  }, []);
  const { submit } = useRoomCommandSubmission(getFailureMessage);

  const requestClearSeats = useCallback(() => {
    showDestructiveAlert(
      '清空所有座位？',
      '所有玩家会离开座位，机器人填充也会关闭。',
      '清空座位',
      async () => {
        await submit('清空座位', clearSeats);
      },
    );
  }, [clearSeats, submit]);

  const requestFillBots = useCallback(() => {
    showConfirmAlert('填充机器人？', '机器人会补满当前所有空位。', async () => {
      await submit('填充机器人', fillBots);
    });
  }, [fillBots, submit]);

  return useMemo(
    () => ({ requestClearSeats, requestFillBots }),
    [requestClearSeats, requestFillBots],
  );
}
