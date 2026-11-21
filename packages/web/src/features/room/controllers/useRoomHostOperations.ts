/** Shared confirmation and submission handling for destructive room-wide operations. */

import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { useCallback, useMemo } from 'react';

import { HOST_ACTION_KEYS } from '@/features/room/model/hostManagementActions';
import type { DispatchOutcome } from '@/platform/realtime/types';
import { showConfirmAlert, showDestructiveAlert } from '@/utils/alertPresets';

import type { RoomCommandSubmission } from './useRoomCommandSubmission';

interface UseRoomHostOperationsParams<TState extends BaseGameState<string>> {
  readonly clearSeats: () => Promise<DispatchOutcome<TState>>;
  readonly fillBots: () => Promise<DispatchOutcome<TState>>;
  readonly submitOperation: RoomCommandSubmission<TState>['submit'];
}

export interface RoomHostOperations {
  readonly requestClearSeats: () => void;
  readonly requestFillBots: () => void;
}

export function useRoomHostOperations<TState extends BaseGameState<string>>({
  clearSeats,
  fillBots,
  submitOperation,
}: UseRoomHostOperationsParams<TState>): RoomHostOperations {
  const requestClearSeats = useCallback(() => {
    showDestructiveAlert(
      '清空所有座位？',
      '所有玩家会离开座位，机器人填充也会关闭。',
      '清空座位',
      async () => {
        await submitOperation('清空座位', clearSeats, {
          actionKey: HOST_ACTION_KEYS.clearSeats,
        });
      },
    );
  }, [clearSeats, submitOperation]);

  const requestFillBots = useCallback(() => {
    showConfirmAlert('填充机器人？', '机器人会补满当前所有空位。', async () => {
      await submitOperation('填充机器人', fillBots, {
        actionKey: HOST_ACTION_KEYS.fillBots,
      });
    });
  }, [fillBots, submitOperation]);

  return useMemo(
    () => ({ requestClearSeats, requestFillBots }),
    [requestClearSeats, requestFillBots],
  );
}
