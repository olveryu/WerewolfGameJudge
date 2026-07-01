/**
 * useRoomActionRunner — shared action-result handling for room-like games.
 *
 * It turns server action results into boolean UI flow decisions and centralizes
 * the alert/error pipeline. Game-specific callers provide reason copy.
 */
import { useCallback } from 'react';

import { showAlert } from '@/utils/alert';
import { handleError } from '@/utils/errorPipeline';

export interface RoomActionResultLike {
  success: boolean;
  reason?: string;
}

interface UseRoomActionRunnerParams {
  reasonToMessage: (reason: string | undefined) => string;
  logger: Parameters<typeof handleError>[1]['logger'];
  isExpectedError?: (err: unknown) => boolean;
}

export function useRoomActionRunner({
  reasonToMessage,
  logger,
  isExpectedError,
}: UseRoomActionRunnerParams): (
  fn: () => Promise<RoomActionResultLike>,
  failTitle: string,
) => Promise<boolean> {
  return useCallback(
    async (fn: () => Promise<RoomActionResultLike>, failTitle: string): Promise<boolean> => {
      try {
        const result = await fn();
        if (!result.success) {
          showAlert(failTitle, reasonToMessage(result.reason));
          return false;
        }
        return true;
      } catch (err) {
        handleError(err, {
          label: failTitle,
          logger,
          alertMessage: isExpectedError?.(err) === true ? undefined : '请稍后重试',
          isExpected: isExpectedError,
        });
        return false;
      }
    },
    [isExpectedError, logger, reasonToMessage],
  );
}
