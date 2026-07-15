/** Shared confirmation and submission handling for destructive room-wide operations. */

import { useCallback, useMemo } from 'react';

import type { RoomOperationResult } from '@/features/room/model/RoomCapabilities';
import { showConfirmAlert, showDestructiveAlert } from '@/utils/alertPresets';
import { getUserFacingMessage } from '@/utils/errorUtils';

import { useRoomOperationSubmission } from './useRoomOperationSubmission';

interface UseRoomHostOperationsParams {
  readonly clearSeats: () => Promise<RoomOperationResult>;
  readonly fillBots: () => Promise<RoomOperationResult>;
}

export interface RoomHostOperations {
  readonly requestClearSeats: () => void;
  readonly requestFillBots: () => void;
}

export function useRoomHostOperations({
  clearSeats,
  fillBots,
}: UseRoomHostOperationsParams): RoomHostOperations {
  const { submit } = useRoomOperationSubmission(getUserFacingMessage);

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
