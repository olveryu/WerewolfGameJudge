/** Submit one user-facing Pictionary stage command with typed failure presentation. */

import {
  createPictionaryCommand,
  type PictionaryCommandInput,
  type PictionaryPublicCommand,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useRoomAlert } from '@/features/room/components/RoomAlertContext';
import {
  getRoomCommandFailureReason,
  isSuccessfulRoomCommand,
  type SuccessfulRoomCommandDispatchOutcome,
} from '@/features/room/session/roomCommandResult';
import type { PictionaryRoomSession } from '@/games/pictionary/model/PictionaryRoomSession';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

import { getPictionaryRoomCommandFailureMessage } from '../pictionaryRoomCommandFailureMessage';

interface PictionaryStageCommand {
  readonly isSubmitting: boolean;
  readonly submit: (
    label: string,
    command: PictionaryCommandInput,
  ) => Promise<SuccessfulRoomCommandDispatchOutcome<PictionaryState> | null>;
}

interface InFlightStageCommand {
  readonly commandType: PictionaryPublicCommand['type'];
  readonly promise: Promise<SuccessfulRoomCommandDispatchOutcome<PictionaryState> | null>;
}

/** Keep task and gallery controls single-flight while preserving the full command snapshot. */
export function usePictionaryStageCommand(
  session: PictionaryRoomSession,
  controlledSeat: number | null,
  state: PictionaryState,
  effectiveSeat: number | null = null,
): PictionaryStageCommand {
  const inFlight = useRef<InFlightStageCommand | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showRoomAlert } = useRoomAlert();

  const submit = useCallback(
    (
      label: string,
      command: PictionaryCommandInput,
    ): Promise<SuccessfulRoomCommandDispatchOutcome<PictionaryState> | null> => {
      if (inFlight.current !== null) {
        if (inFlight.current.commandType === command.type) return inFlight.current.promise;
        throw new Error(
          `[FAIL-FAST] ${command.type} requested while ${inFlight.current.commandType} is pending`,
        );
      }
      const operation = session
        .dispatch(createPictionaryCommand(state, command, effectiveSeat), {
          controlledSeat,
          label,
          isRecoverable: true,
        })
        .then((result) => {
          if (isSuccessfulRoomCommand(result)) return result;
          const reason = getRoomCommandFailureReason(result);
          roomScreenLog.warn('Pictionary stage command was not accepted', {
            commandType: command.type,
            reason,
          });
          showRoomAlert({
            title: `${label}失败`,
            message: getPictionaryRoomCommandFailureMessage(result),
            buttons: [{ text: '确定', style: 'default' }],
          });
          return null;
        })
        .catch((error: unknown) => {
          const result = handleError(error, {
            label,
            logger: roomScreenLog,
            alertMessage: `${label}失败，请稍后重试。`,
          });
          if (!result.aborted) {
            showRoomAlert({
              title: `${label}失败`,
              message: result.message,
              buttons: [{ text: '确定', style: 'default' }],
            });
          }
          return null;
        })
        .finally(() => {
          inFlight.current = null;
          setIsSubmitting(false);
        });
      inFlight.current = { commandType: command.type, promise: operation };
      setIsSubmitting(true);
      return operation;
    },
    [controlledSeat, session, state, effectiveSeat, showRoomAlert],
  );

  return useMemo(() => ({ isSubmitting, submit }), [isSubmitting, submit]);
}
