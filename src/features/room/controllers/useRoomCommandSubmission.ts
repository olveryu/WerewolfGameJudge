/** Shared submission lock and failure presentation for room operation results. */

import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner-native';

import {
  getRoomCommandFailureReason,
  isSuccessfulRoomCommand,
} from '@/features/room/link/roomCommandResult';
import type { DispatchOutcome } from '@/platform/realtime/types';
import { showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

/**
 * Where a committed domain rejection is presented: by this submission
 * (`alert`), or by the game from the rejection the engine committed into
 * state (`state`, e.g. werewolf `actionRejected`), so it shows once.
 */
export type DomainRejectionPresentation = 'alert' | 'state';

/**
 * How a transport failure (thrown error, `undelivered`, `unavailable`) is
 * presented. `alert` (default) shows the modal error. `toastAndRethrow` is
 * for a submit issued from an open dialog's button: the failure shows as a
 * toast and the promise rejects, which is the `AlertModal` protocol for
 * "keep the dialog open and let the user retry" — a modal alert would
 * replace that dialog. Decisions (rejections) are never rethrown: the
 * dialog's request was answered, so it closes.
 */
export type TransportFailurePresentation = 'alert' | 'toastAndRethrow';

export interface RoomCommandSubmitOptions {
  readonly domainRejection?: DomainRejectionPresentation;
  readonly transportFailure?: TransportFailurePresentation;
}

/** A transport failure rethrown to an open dialog so it stays up for retry (already presented). */
class RoomCommandUndeliveredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoomCommandUndeliveredError';
  }
}

export interface RoomCommandSubmission<TState extends BaseGameState<string>> {
  readonly isSubmitting: boolean;
  readonly submit: (
    label: string,
    operation: () => Promise<DispatchOutcome<TState>>,
    options?: RoomCommandSubmitOptions,
  ) => Promise<boolean>;
}

export function useRoomCommandSubmission<TState extends BaseGameState<string>>(
  getFailureMessage: (result: DispatchOutcome<TState>) => string,
): RoomCommandSubmission<TState> {
  const submissionRef = useRef<Promise<DispatchOutcome<TState>> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = useCallback(
    async (
      label: string,
      operation: () => Promise<DispatchOutcome<TState>>,
      options: RoomCommandSubmitOptions = {},
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
        const rethrow = options.transportFailure === 'toastAndRethrow';
        if (settled.kind === 'error') {
          handleError(settled.error, {
            label,
            logger: roomScreenLog,
            feedback: rethrow ? 'toast' : 'alert',
            alertMessage: `${label}失败，请稍后重试`,
          });
          if (rethrow) throw settled.error;
          return false;
        }

        const result = settled.result;
        if (isSuccessfulRoomCommand(result)) return true;
        const reason = getRoomCommandFailureReason(result);
        const message = getFailureMessage(result);
        if (result.kind === 'undelivered' || result.kind === 'unavailable') {
          roomScreenLog.warn('room operation not delivered', { label, reason });
          if (rethrow) {
            toast.error(message);
            throw new RoomCommandUndeliveredError(reason);
          }
          showErrorAlert(`${label}失败`, message);
          return false;
        }
        roomScreenLog.warn('room operation rejected', { label, reason });
        const isDomainRejection =
          result.kind === 'committed' && result.outcome.kind === 'domainRejected';
        if (!(isDomainRejection && options.domainRejection === 'state')) {
          showErrorAlert(`${label}失败`, message);
        }
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
