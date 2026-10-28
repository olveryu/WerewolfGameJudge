/** Shared submission lock and failure presentation for room operation results. */

import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { useCallback, useMemo, useRef, useState } from 'react';

import {
  getRoomCommandFailureReason,
  isSuccessfulRoomCommand,
} from '@/features/room/link/roomCommandResult';
import type { DispatchOutcome } from '@/platform/realtime/types';
import { showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

export interface RoomCommandSubmission<TState extends BaseGameState<string>> {
  readonly isSubmitting: boolean;
  readonly submit: (
    label: string,
    operation: () => Promise<DispatchOutcome<TState>>,
  ) => Promise<boolean>;
}

export function useRoomCommandSubmission<TState extends BaseGameState<string>>(
  getFailureMessage: (result: DispatchOutcome<TState>) => string,
): RoomCommandSubmission<TState> {
  const submissionRef = useRef<Promise<DispatchOutcome<TState>> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = useCallback(
    async (label: string, operation: () => Promise<DispatchOutcome<TState>>): Promise<boolean> => {
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
        showErrorAlert(`${label}失败`, getFailureMessage(result));
        return false;
      } finally {
        submissionRef.current = null;
        setIsSubmitting(false);
      }
    },
    [getFailureMessage],
  );

  return useMemo(() => ({ isSubmitting, submit }), [isSubmitting, submit]);
}
