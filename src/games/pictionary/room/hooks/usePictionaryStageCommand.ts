/** Submit one user-facing Pictionary stage command with typed failure presentation. */

import {
  type PictionaryPublicCommand,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';
import { useCallback, useMemo, useRef, useState } from 'react';

import {
  getRoomCommandFailureReason,
  isSuccessfulRoomCommand,
  type SuccessfulRoomCommandDispatchOutcome,
} from '@/features/room/session/roomCommandResult';
import type { PictionaryRoomSession } from '@/games/pictionary/model/PictionaryRoomSession';
import { showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

import { getPictionaryRoomCommandFailureMessage } from '../pictionaryRoomCommandFailureMessage';

interface PictionaryStageCommand {
  readonly isSubmitting: boolean;
  readonly submit: (
    label: string,
    command: PictionaryPublicCommand,
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
): PictionaryStageCommand {
  const inFlight = useRef<InFlightStageCommand | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = useCallback(
    (
      label: string,
      command: PictionaryPublicCommand,
    ): Promise<SuccessfulRoomCommandDispatchOutcome<PictionaryState> | null> => {
      if (inFlight.current !== null) {
        if (inFlight.current.commandType === command.type) return inFlight.current.promise;
        throw new Error(
          `[FAIL-FAST] ${command.type} requested while ${inFlight.current.commandType} is pending`,
        );
      }
      const operation = session
        .dispatch(command, { controlledSeat, label })
        .then((result) => {
          if (isSuccessfulRoomCommand(result)) return result;
          const reason = getRoomCommandFailureReason(result);
          roomScreenLog.warn('Pictionary stage command was not accepted', {
            commandType: command.type,
            reason,
          });
          showErrorAlert(`${label}失败`, getPictionaryRoomCommandFailureMessage(result));
          return null;
        })
        .catch((error: unknown) => {
          handleError(error, {
            label,
            logger: roomScreenLog,
            alertMessage: `${label}失败，请稍后重试。`,
          });
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
    [controlledSeat, session],
  );

  return useMemo(() => ({ isSubmitting, submit }), [isSubmitting, submit]);
}
