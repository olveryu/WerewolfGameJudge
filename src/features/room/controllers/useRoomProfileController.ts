/** Shared player-profile target and profile action controller. */

import { useCallback, useMemo, useRef, useState } from 'react';

import type {
  RoomOperationResult,
  RoomProfileTarget,
} from '@/features/room/model/RoomCapabilities';
import { showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { getUserFacingMessage } from '@/utils/errorUtils';
import { roomScreenLog } from '@/utils/logger';

interface UseRoomProfileControllerParams {
  readonly myUserId: string | null;
  readonly kickSeat: (seat: number) => Promise<RoomOperationResult>;
}

export interface RoomProfileSelection {
  readonly target: RoomProfileTarget;
  readonly isSelf: boolean;
}

export interface RoomProfileController {
  readonly selection: RoomProfileSelection | null;
  readonly open: (target: RoomProfileTarget) => void;
  readonly close: () => void;
  readonly kick: (seat: number) => void;
  readonly requestSelfLeave: (executeLeave: () => void) => void;
}

function assertProfileTarget(target: RoomProfileTarget): void {
  if (!Number.isSafeInteger(target.seat) || target.seat < 0) {
    throw new Error(`Profile target seat must be a non-negative safe integer: ${target.seat}`);
  }
  if (target.userId.length === 0) {
    throw new Error('Profile target userId must be non-empty');
  }
  if (target.rosterName.length === 0) {
    throw new Error('Profile target rosterName must be non-empty');
  }
}

export function useRoomProfileController({
  myUserId,
  kickSeat,
}: UseRoomProfileControllerParams): RoomProfileController {
  const [target, setTarget] = useState<RoomProfileTarget | null>(null);
  const kickSubmissionRef = useRef<Promise<RoomOperationResult> | null>(null);

  const open = useCallback(
    (nextTarget: RoomProfileTarget) => {
      if (myUserId === null) {
        throw new Error('Cannot open a room profile before user identity is available');
      }
      assertProfileTarget(nextTarget);
      if (target !== null) {
        throw new Error(`Cannot open profile for seat ${nextTarget.seat} while another is open`);
      }
      setTarget(nextTarget);
    },
    [myUserId, target],
  );

  const close = useCallback(() => {
    if (target === null) {
      throw new Error('Cannot close a room profile when none is open');
    }
    setTarget(null);
  }, [target]);

  const kick = useCallback(
    (seat: number) => {
      if (target === null) {
        throw new Error('Cannot kick from a room profile when none is open');
      }
      if (target.seat !== seat) {
        throw new Error(`Profile target seat ${target.seat} does not match kick seat ${seat}`);
      }
      if (target.userId === myUserId) {
        throw new Error('Cannot kick the current user through the profile controller');
      }
      if (kickSubmissionRef.current !== null) {
        throw new Error('Room profile kick is already in progress');
      }

      setTarget(null);
      const submission = Promise.resolve().then(() => kickSeat(seat));
      kickSubmissionRef.current = submission;
      void submission
        .then((result) => {
          if (!result.success) {
            roomScreenLog.warn('kick seat rejected', { seat, reason: result.reason });
            showErrorAlert('移出失败', getUserFacingMessage(result));
          }
        })
        .catch((error: unknown) => {
          handleError(error, {
            label: '移出',
            logger: roomScreenLog,
            alertMessage: '房间响应异常，请重新进入房间后重试。',
          });
        })
        .finally(() => {
          kickSubmissionRef.current = null;
        });
    },
    [kickSeat, myUserId, target],
  );

  const requestSelfLeave = useCallback(
    (executeLeave: () => void) => {
      if (target === null) {
        throw new Error('Cannot leave a seat from a room profile when none is open');
      }
      if (target.userId !== myUserId) {
        throw new Error(`Profile target ${target.userId} is not the current user`);
      }
      setTarget(null);
      executeLeave();
    },
    [myUserId, target],
  );

  const selection = useMemo(
    (): RoomProfileSelection | null =>
      target === null ? null : { target, isSelf: target.userId === myUserId },
    [myUserId, target],
  );

  return { selection, open, close, kick, requestSelfLeave };
}
