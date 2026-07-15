/** Shared submission lock and failure presentation for room operation results. */

import { useCallback, useMemo, useRef, useState } from 'react';

import type {
  RoomOperationFailureMessage,
  RoomOperationResult,
} from '@/features/room/model/RoomCapabilities';
import { showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

export interface RoomOperationSubmission {
  readonly isSubmitting: boolean;
  readonly submit: (
    label: string,
    operation: () => Promise<RoomOperationResult>,
  ) => Promise<boolean>;
}

export function useRoomOperationSubmission(
  getFailureMessage: RoomOperationFailureMessage,
): RoomOperationSubmission {
  const submissionRef = useRef<Promise<RoomOperationResult> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = useCallback(
    async (label: string, operation: () => Promise<RoomOperationResult>): Promise<boolean> => {
      if (submissionRef.current !== null) {
        throw new Error(`Room operation is already in progress while requesting ${label}`);
      }

      const submission = operation();
      submissionRef.current = submission;
      setIsSubmitting(true);
      try {
        const result = await submission;
        if (result.success) return true;
        roomScreenLog.warn('room operation rejected', { label, reason: result.reason });
        showErrorAlert(`${label}失败`, getFailureMessage(result));
        return false;
      } catch (error) {
        handleError(error, {
          label,
          logger: roomScreenLog,
          alertMessage: `${label}失败，请稍后重试。`,
        });
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
