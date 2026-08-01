/** Shared player-profile target and profile action controller. */

import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { useCallback, useMemo, useRef, useState } from 'react';

import type { RoomProfileTarget } from '@/features/room/model/RoomCapabilities';
import {
  getRoomCommandFailureReason,
  isSuccessfulRoomCommand,
} from '@/features/room/session/roomCommandResult';
import type { RoomCommandDispatchOutcome } from '@/features/room/session/types';
import { showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { translateReasonCode } from '@/utils/errorUtils';
import { roomScreenLog } from '@/utils/logger';

interface UseRoomProfileControllerParams<TState extends BaseGameState<string>> {
  readonly myUserId: string | null;
  readonly kickSeat: (seat: number) => Promise<RoomCommandDispatchOutcome<TState>>;
  readonly leaveSeat: () => Promise<RoomCommandDispatchOutcome<TState>>;
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
  readonly leaveSelf: () => void;
}

type RoomProfileCommand = {
  readonly kind: 'kick' | 'leave';
  readonly seat: number;
  readonly label: '移出' | '离座';
};

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

export function useRoomProfileController<TState extends BaseGameState<string>>({
  myUserId,
  kickSeat,
  leaveSeat,
}: UseRoomProfileControllerParams<TState>): RoomProfileController {
  const [target, setTarget] = useState<RoomProfileTarget | null>(null);
  const submissionRef = useRef<Promise<RoomCommandDispatchOutcome<TState>> | null>(null);

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

  const submit = useCallback(
    (command: RoomProfileCommand, execute: () => Promise<RoomCommandDispatchOutcome<TState>>) => {
      if (submissionRef.current !== null) {
        throw new Error('Room profile command is already in progress');
      }
      setTarget(null);
      const submission = Promise.resolve().then(execute);
      submissionRef.current = submission;
      void submission
        .then(
          (result) => {
            if (isSuccessfulRoomCommand(result)) return;
            const reason = getRoomCommandFailureReason(result);
            roomScreenLog.warn(`${command.kind} seat rejected`, { seat: command.seat, reason });
            showErrorAlert(`${command.label}失败`, translateReasonCode(reason));
          },
          (error: unknown) => {
            handleError(error, {
              label: command.label,
              logger: roomScreenLog,
              alertMessage: '房间响应异常，请重新进入房间后重试。',
            });
          },
        )
        .finally(() => {
          submissionRef.current = null;
        });
    },
    [],
  );

  const kick = useCallback(
    (seat: number) => {
      if (target === null) throw new Error('Cannot kick from a room profile when none is open');
      if (target.seat !== seat) {
        throw new Error(`Profile target seat ${target.seat} does not match kick seat ${seat}`);
      }
      if (target.userId === myUserId) {
        throw new Error('Cannot kick the current user through the profile controller');
      }
      submit({ kind: 'kick', seat, label: '移出' }, () => kickSeat(seat));
    },
    [kickSeat, myUserId, submit, target],
  );

  const leaveSelf = useCallback(() => {
    if (target === null)
      throw new Error('Cannot leave a seat from a room profile when none is open');
    if (target.userId !== myUserId) {
      throw new Error(`Profile target ${target.userId} is not the current user`);
    }
    submit({ kind: 'leave', seat: target.seat, label: '离座' }, leaveSeat);
  }, [leaveSeat, myUserId, submit, target]);

  const selection = useMemo(
    (): RoomProfileSelection | null =>
      target === null ? null : { target, isSelf: target.userId === myUserId },
    [myUserId, target],
  );

  return { selection, open, close, kick, leaveSelf };
}
