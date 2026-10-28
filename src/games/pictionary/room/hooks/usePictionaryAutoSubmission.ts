/** Automatically submit current-page Pictionary input during authoritative collection. */

import {
  createPictionaryCommand,
  getPictionaryTaskForSeat,
  getPictionaryUserSeat,
  isBotSeat,
  isValidPictionaryText,
  type PictionaryDrawingReservation,
  type PictionaryState,
  type PictionaryTask,
} from '@game-judge/game-engine/games/pictionary/public';
import { useCallback, useEffect, useEffectEvent, useState } from 'react';

import type { DrawingDraft } from '@/features/drawing/model/drawing';
import {
  getRoomCommandFailureReason,
  isSuccessfulRoomCommand,
} from '@/features/room/link/roomCommandResult';
import type { PictionaryRoomSession } from '@/games/pictionary/model/PictionaryRoomSession';
import { pictionaryMediaTransport } from '@/games/pictionary/services/pictionaryMediaTransport';
import { renderPictionaryDrawing } from '@/games/pictionary/services/renderPictionaryDrawing';
import { ApiError } from '@/platform/http/ApiError';
import type { DispatchOutcome } from '@/platform/realtime/types';
import { handleError } from '@/utils/errorPipeline';
import { isAbortError, isNetworkError } from '@/utils/errorUtils';
import { roomScreenLog } from '@/utils/logger';

export type PictionarySubmissionStatus = 'idle' | 'submitting' | 'retrying' | 'waiting' | 'failed';

export type PictionaryTaskInput = string | DrawingDraft;

interface PictionaryAutoSubmission {
  readonly status: PictionarySubmissionStatus;
  readonly retry: () => void;
}

interface LocallyOwnedTask {
  readonly seat: number;
  readonly controlledSeat: number | null;
  readonly task: PictionaryTask;
}

/** Media upload retry ladder; room commands are durable and need no local retry. */
const UPLOAD_RETRY_LADDER_MS = [1_000, 3_000, 10_000] as const;

/** The link epoch ended before the durable command was decided; the next epoch replays it. */
class PictionaryLinkCancelledError extends Error {}

function isRetryableDeliveryError(error: unknown): boolean {
  return (
    isNetworkError(error) ||
    isAbortError(error) ||
    (error instanceof ApiError &&
      error.isHttp() &&
      (error.status === 408 || error.status === 429 || error.status >= 500))
  );
}

/** Durable dispatch: committed success passes; cancellation aborts; rejection is terminal. */
function assertDurableSuccess(result: DispatchOutcome<PictionaryState>, label: string): void {
  if (result.kind === 'cancelled') throw new PictionaryLinkCancelledError(label);
  if (!isSuccessfulRoomCommand(result)) {
    throw new Error(`${label} was rejected: ${getRoomCommandFailureReason(result)}`);
  }
}

function collectionKeyFor(state: PictionaryState): string | null {
  return state.phase === 'settling'
    ? `${state.roomCode}:${state.roundId}:${state.stepIndex}:${state.phaseRevision}`
    : null;
}

function getLocallyOwnedTasks(state: PictionaryState, userId: string): readonly LocallyOwnedTask[] {
  const userSeat = getPictionaryUserSeat(state, userId);
  const isHost = state.hostUserId === userId;
  return Array.from({ length: state.config.numberOfPlayers }, (_, seat) => seat).flatMap((seat) => {
    const isOwnSeat = seat === userSeat;
    const isControlledBot = isHost && isBotSeat(state.roster, seat);
    if (!isOwnSeat && !isControlledBot) return [];
    const task = getPictionaryTaskForSeat(state, seat);
    if (task === null) {
      throw new Error(`[FAIL-FAST] Locally owned Pictionary seat ${seat} has no active task`);
    }
    if (task.chain.entries.length > state.stepIndex) return [];
    return [{ seat, controlledSeat: isOwnSeat ? null : seat, task }];
  });
}

function findDrawingReservation(
  state: PictionaryState,
  seat: number,
): PictionaryDrawingReservation | null {
  return state.reservations.find((reservation) => reservation.authorSeat === seat) ?? null;
}

async function submitTextInput(
  state: PictionaryState,
  ownedTask: LocallyOwnedTask,
  text: string,
  session: PictionaryRoomSession,
): Promise<void> {
  if (!isValidPictionaryText(text)) {
    throw new Error('Pictionary text cannot be submitted');
  }
  const result = await session.dispatch(
    createPictionaryCommand(state, { type: 'pictionary.text.submit', text }, ownedTask.seat),
    { controlledSeat: ownedTask.controlledSeat, label: '发送最终文字', durable: true },
  );
  assertDurableSuccess(result, 'Final Pictionary text');
}

async function reserveDrawing(
  state: PictionaryState,
  ownedTask: LocallyOwnedTask,
  session: PictionaryRoomSession,
): Promise<PictionaryDrawingReservation> {
  const existingReservation = findDrawingReservation(state, ownedTask.seat);
  if (existingReservation !== null) return existingReservation;
  const result = await session.dispatch(
    createPictionaryCommand(state, { type: 'pictionary.drawing.reserve' }, ownedTask.seat),
    { controlledSeat: ownedTask.controlledSeat, label: '预留最终画作', durable: true },
  );
  assertDurableSuccess(result, 'Final Pictionary drawing reservation');
  if (result.kind !== 'committed') throw new Error('unreachable');
  const reservation = findDrawingReservation(result.snapshot.state, ownedTask.seat);
  if (reservation === null) {
    throw new Error('[FAIL-FAST] Successful final drawing reservation is missing from snapshot');
  }
  return reservation;
}

async function submitDrawingInput(
  state: PictionaryState,
  ownedTask: LocallyOwnedTask,
  drawing: DrawingDraft,
  session: PictionaryRoomSession,
  signal: AbortSignal,
): Promise<void> {
  const png = renderPictionaryDrawing(drawing.elements);
  const reservation = await reserveDrawing(state, ownedTask, session);
  signal.throwIfAborted();
  const result = await pictionaryMediaTransport.uploadDrawing(
    state.roomCode,
    reservation.submissionId,
    png,
    ownedTask.controlledSeat,
    signal,
  );
  if (result.kind !== 'committed' || result.outcome.kind !== 'success') {
    throw new Error('Server rejected the final Pictionary drawing');
  }
}

async function submitOwnedTask(
  state: PictionaryState,
  ownedTask: LocallyOwnedTask,
  input: PictionaryTaskInput,
  session: PictionaryRoomSession,
  signal: AbortSignal,
): Promise<void> {
  if (ownedTask.task.expectedKind === 'text') {
    if (typeof input !== 'string') throw new Error('Pictionary text task requires text input');
    await submitTextInput(state, ownedTask, input, session);
    return;
  }
  if (typeof input === 'string') throw new Error('Pictionary drawing task requires drawing input');
  await submitDrawingInput(state, ownedTask, input, session, signal);
}

async function submitAllInputs(
  state: PictionaryState,
  userId: string,
  session: PictionaryRoomSession,
  signal: AbortSignal,
  inputs: ReadonlyMap<number, PictionaryTaskInput>,
): Promise<void> {
  const failures = await Promise.all(
    getLocallyOwnedTasks(state, userId).map(async (ownedTask): Promise<Error | null> => {
      try {
        const input = inputs.get(ownedTask.seat);
        const isEmpty =
          input === undefined ||
          (typeof input === 'string' ? input.length === 0 : input.elements.length === 0);
        if (isEmpty) {
          const result = await session.dispatch(
            createPictionaryCommand(
              state,
              { type: 'pictionary.task.empty.submit' },
              ownedTask.seat,
            ),
            { controlledSeat: ownedTask.controlledSeat, label: '提交空白', durable: true },
          );
          assertDurableSuccess(result, 'Empty Pictionary task');
          return null;
        }
        await submitOwnedTask(state, ownedTask, input, session, signal);
        return null;
      } catch (error: unknown) {
        return error instanceof Error ? error : new Error('Unknown Pictionary finalization error');
      }
    }),
  );
  const firstFailure = failures.find((error) => error !== null);
  if (firstFailure !== undefined && firstFailure !== null) throw firstFailure;
}

/** Recover local collection with one in-flight attempt, backoff, and authoritative acknowledgements. */
export function usePictionaryAutoSubmission(
  state: PictionaryState,
  userId: string,
  session: PictionaryRoomSession,
  inputs: ReadonlyMap<number, PictionaryTaskInput>,
): PictionaryAutoSubmission {
  const [status, setStatus] = useState<PictionarySubmissionStatus>('idle');
  const [attempt, setAttempt] = useState(0);
  const collectionKey = collectionKeyFor(state);
  const submitCurrentInputs = useEffectEvent(
    async (current: PictionaryState, signal: AbortSignal): Promise<void> => {
      return submitAllInputs(current, userId, session, signal, inputs);
    },
  );

  useEffect(() => {
    if (collectionKey === null) {
      setStatus('idle');
      return;
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let isSubmitting = false;
    let hasTerminalFailure = false;
    let retryCount = 0;
    const initial = session.getSnapshot();
    if (initial.phase !== 'ready') return;
    const initialState = initial.room.state;
    const pendingTasks = getLocallyOwnedTasks(initialState, userId);
    const reconcile = (): boolean => {
      const current = session.getSnapshot();
      if (current.phase !== 'ready') return false;
      const latest = current.room.state;
      const unresolved = pendingTasks.filter(({ task }) => {
        const entry = latest.chains.find((chain) => chain.id === task.chain.id)?.entries[
          initialState.stepIndex
        ];
        if (latest.roundId !== initialState.roundId || entry === undefined) return true;
        return false;
      });
      return unresolved.length === 0;
    };
    const run = async (): Promise<void> => {
      if (controller.signal.aborted || isSubmitting || hasTerminalFailure) return;
      clearTimeout(timer);
      timer = undefined;
      const current = session.getSnapshot();
      if (reconcile()) {
        setStatus('waiting');
        return;
      }
      if (
        current.phase !== 'ready' ||
        current.status.kind !== 'live' ||
        current.pendingDurableCount > 0
      ) {
        setStatus('retrying');
        return;
      }
      if (collectionKeyFor(current.room.state) !== collectionKey) return;
      isSubmitting = true;
      setStatus(retryCount === 0 ? 'submitting' : 'retrying');
      try {
        await submitCurrentInputs(current.room.state, controller.signal);
        if (!controller.signal.aborted) setStatus('waiting');
      } catch (error: unknown) {
        if (controller.signal.aborted || error instanceof PictionaryLinkCancelledError) return;
        if (reconcile()) {
          setStatus('waiting');
        } else if (isRetryableDeliveryError(error)) {
          roomScreenLog.warn('Pictionary submission pending; retry scheduled', { error });
          setStatus('retrying');
          const delayMs =
            UPLOAD_RETRY_LADDER_MS[Math.min(retryCount, UPLOAD_RETRY_LADDER_MS.length - 1)]!;
          timer = setTimeout(() => {
            void run();
          }, delayMs);
          retryCount += 1;
        } else {
          hasTerminalFailure = true;
          setStatus('failed');
          handleError(error, {
            label: '发送最终内容',
            logger: roomScreenLog,
            alertMessage: '内容发送失败，请重试。',
          });
        }
      } finally {
        isSubmitting = false;
      }
    };
    let previous = session.getSnapshot();
    const unsubscribe = session.subscribe(() => {
      const current = session.getSnapshot();
      const hasRecovered =
        current.status.kind === 'live' &&
        (previous.status.kind !== 'live' ||
          (previous.pendingDurableCount > 0 && current.pendingDurableCount === 0));
      previous = current;
      if (hasRecovered || reconcile()) void run();
    });
    void run();
    return () => {
      controller.abort();
      clearTimeout(timer);
      unsubscribe();
    };
  }, [attempt, collectionKey, session, userId]);

  const retry = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);
  return { status, retry };
}
