/** Shared submission lock and failure presentation for room operation results. */

import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useOptionalRoomAlert } from '@/features/room/components/RoomAlertContext';
import {
  getRoomCommandFailureReason,
  isSuccessfulRoomCommand,
} from '@/features/room/session/roomCommandResult';
import type { RoomCommandDispatchOutcome } from '@/features/room/session/types';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

export interface RoomCommandSubmission<TState extends BaseGameState<string>> {
  readonly isSubmitting: boolean;
  readonly submit: (
    label: string,
    operation: () => Promise<RoomCommandDispatchOutcome<TState>>,
  ) => Promise<boolean>;
  /** 房间外调用者（如配置页）用此渲染 <AlertModal>；房间内走 RoomAlertContext 通道 */
  readonly alert: { title: string; message: string } | null;
  readonly clearAlert: () => void;
}

export function useRoomCommandSubmission<TState extends BaseGameState<string>>(
  getFailureMessage: (result: RoomCommandDispatchOutcome<TState>) => string,
): RoomCommandSubmission<TState> {
  const submissionRef = useRef<Promise<RoomCommandDispatchOutcome<TState>> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);
  const clearAlert = useCallback(() => setAlert(null), []);
  const roomAlert = useOptionalRoomAlert();

  const submit = useCallback(
    async (
      label: string,
      operation: () => Promise<RoomCommandDispatchOutcome<TState>>,
    ): Promise<boolean> => {
      if (submissionRef.current !== null) {
        throw new Error(`Room operation is already in progress while requesting ${label}`);
      }

      const submission = operation();
      submissionRef.current = submission;
      setIsSubmitting(true);
      try {
        const settled = await submission.then(
          (result) => ({ kind: 'result', result }) as const,
          (error: unknown) => ({ kind: 'error', error }) as const,
        );
        if (settled.kind === 'error') {
          handleError(settled.error, {
            label,
            logger: roomScreenLog,
            alertMessage: `${label}失败，请稍后重试`,
          });
          return false;
        }

        const result = settled.result;
        if (isSuccessfulRoomCommand(result)) return true;
        const reason = getRoomCommandFailureReason(result);
        roomScreenLog.warn('room operation rejected', { label, reason });
        const failure = { title: `${label}失败`, message: getFailureMessage(result) };
        if (roomAlert) {
          roomAlert.showRoomAlert({
            ...failure,
            buttons: [{ text: '确定', style: 'default' }],
          });
        } else {
          setAlert(failure);
        }
        return false;
      } finally {
        submissionRef.current = null;
        setIsSubmitting(false);
      }
    },
    [getFailureMessage, roomAlert],
  );

  return useMemo(
    () => ({ isSubmitting, submit, alert, clearAlert }),
    [isSubmitting, submit, alert, clearAlert],
  );
}
