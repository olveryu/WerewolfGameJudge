/** Shared take, move, and leave-seat confirmation state machine. */

import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { useCallback, useReducer, useRef } from 'react';

import type { RoomSeatPendingAction } from '@/features/room/model/RoomSeatConfirmation';
import {
  getRoomCommandFailureReason,
  isSuccessfulRoomCommand,
} from '@/features/room/session/roomCommandResult';
import type { RoomCommandDispatchOutcome } from '@/features/room/session/types';
import { showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { translateReasonCode } from '@/utils/errorUtils';
import { roomScreenLog } from '@/utils/logger';

type RoomSeatControllerState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'confirming'; readonly action: RoomSeatPendingAction }
  | { readonly kind: 'submitting'; readonly action: RoomSeatPendingAction };

type RoomSeatControllerEvent =
  | { readonly kind: 'REQUEST'; readonly action: RoomSeatPendingAction }
  | { readonly kind: 'CANCEL' }
  | { readonly kind: 'SUBMIT' }
  | { readonly kind: 'SETTLE' };

interface UseRoomSeatControllerParams<TState extends BaseGameState<string>> {
  readonly currentSeat: number | null;
  readonly takeSeat: (seat: number) => Promise<RoomCommandDispatchOutcome<TState>>;
  readonly leaveSeat: () => Promise<RoomCommandDispatchOutcome<TState>>;
}

export interface RoomSeatController {
  readonly pendingAction: RoomSeatPendingAction | null;
  readonly isSubmitting: boolean;
  readonly requestTakeSeat: (seat: number) => void;
  readonly requestMoveSeat: (seat: number) => void;
  readonly requestLeaveSeat: () => void;
  readonly confirm: () => Promise<void>;
  readonly cancel: () => void;
}

function transitionRoomSeatController(
  state: RoomSeatControllerState,
  event: RoomSeatControllerEvent,
): RoomSeatControllerState {
  switch (state.kind) {
    case 'idle':
      if (event.kind === 'REQUEST') return { kind: 'confirming', action: event.action };
      break;
    case 'confirming':
      if (event.kind === 'CANCEL') return { kind: 'idle' };
      if (event.kind === 'SUBMIT') return { kind: 'submitting', action: state.action };
      break;
    case 'submitting':
      if (event.kind === 'SETTLE') return { kind: 'idle' };
      break;
  }

  throw new Error(`Invalid room seat transition: ${state.kind} + ${event.kind}`);
}

function assertSeat(seat: number): void {
  if (!Number.isSafeInteger(seat) || seat < 0) {
    throw new Error(`Room seat must be a non-negative safe integer: ${seat}`);
  }
}

function getActionLabel(action: RoomSeatPendingAction): '入座' | '换座' | '离座' {
  switch (action.kind) {
    case 'take':
      return '入座';
    case 'move':
      return '换座';
    case 'leave':
      return '离座';
  }
}

export function useRoomSeatController<TState extends BaseGameState<string>>({
  currentSeat,
  takeSeat,
  leaveSeat,
}: UseRoomSeatControllerParams<TState>): RoomSeatController {
  const [state, dispatch] = useReducer(transitionRoomSeatController, { kind: 'idle' });
  const submissionRef = useRef<Promise<RoomCommandDispatchOutcome<TState>> | null>(null);

  const requestTakeSeat = useCallback(
    (seat: number) => {
      assertSeat(seat);
      if (currentSeat !== null) {
        throw new Error(`Cannot request take-seat while already seated at ${currentSeat}`);
      }
      dispatch({ kind: 'REQUEST', action: { kind: 'take', toSeat: seat } });
    },
    [currentSeat],
  );

  const requestMoveSeat = useCallback(
    (seat: number) => {
      assertSeat(seat);
      if (currentSeat === null) {
        throw new Error('Cannot request move-seat while unseated');
      }
      if (currentSeat === seat) {
        throw new Error(`Cannot move from seat ${currentSeat} to the same seat`);
      }
      dispatch({
        kind: 'REQUEST',
        action: { kind: 'move', fromSeat: currentSeat, toSeat: seat },
      });
    },
    [currentSeat],
  );

  const requestLeaveSeat = useCallback(() => {
    if (currentSeat === null) {
      throw new Error('Cannot request leave-seat while unseated');
    }
    dispatch({ kind: 'REQUEST', action: { kind: 'leave', fromSeat: currentSeat } });
  }, [currentSeat]);

  const cancel = useCallback(() => {
    if (state.kind !== 'confirming') {
      throw new Error(`Cannot cancel room seat action while controller is ${state.kind}`);
    }
    dispatch({ kind: 'CANCEL' });
  }, [state.kind]);

  const confirm = useCallback(async (): Promise<void> => {
    if (state.kind !== 'confirming') {
      throw new Error(`Cannot confirm room seat action while controller is ${state.kind}`);
    }
    if (submissionRef.current !== null) {
      throw new Error('Room seat submission is already in progress');
    }

    const action = state.action;
    const label = getActionLabel(action);
    const submission = Promise.resolve().then(() =>
      action.kind === 'leave' ? leaveSeat() : takeSeat(action.toSeat),
    );
    submissionRef.current = submission;
    dispatch({ kind: 'SUBMIT' });

    let settled:
      | { readonly kind: 'result'; readonly result: RoomCommandDispatchOutcome<TState> }
      | { readonly kind: 'error'; readonly error: unknown };
    try {
      settled = await submission.then(
        (result) => ({ kind: 'result', result }) as const,
        (error: unknown) => ({ kind: 'error', error }) as const,
      );
    } finally {
      submissionRef.current = null;
      dispatch({ kind: 'SETTLE' });
    }

    if (settled.kind === 'error') {
      handleError(settled.error, {
        label,
        logger: roomScreenLog,
        alertMessage: '房间响应异常，请重新进入房间后重试。',
      });
      return;
    }

    const result = settled.result;
    if (isSuccessfulRoomCommand(result)) return;

    const reason = getRoomCommandFailureReason(result);
    const rejectionMessage =
      reason === 'seat_taken' && action.kind !== 'leave'
        ? `${action.toSeat + 1}号座位已被占用，请选择其他位置。`
        : translateReasonCode(reason);
    roomScreenLog.warn(`${action.kind} seat rejected`, { action, reason });
    showErrorAlert(`${label}失败`, rejectionMessage);
  }, [leaveSeat, state, takeSeat]);

  return {
    pendingAction: state.kind === 'idle' ? null : state.action,
    isSubmitting: state.kind === 'submitting',
    requestTakeSeat,
    requestMoveSeat,
    requestLeaveSeat,
    confirm,
    cancel,
  };
}
