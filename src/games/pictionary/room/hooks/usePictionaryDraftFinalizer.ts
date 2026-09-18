/** Submit locally persisted Pictionary drafts only during authoritative collection. */

import {
  getPictionaryTaskForSeat,
  isPictionaryImplicitBotSeat,
  isValidPictionaryText,
  type PictionaryDrawingReservation,
  type PictionaryState,
  type PictionaryTask,
} from '@game-judge/game-engine/games/pictionary/public';
import { useCallback, useEffect, useEffectEvent, useState } from 'react';

import {
  getRoomCommandFailureReason,
  isSuccessfulRoomCommand,
} from '@/features/room/session/roomCommandResult';
import type { PictionaryRoomSession } from '@/games/pictionary/model/PictionaryRoomSession';
import { getPictionaryUserSeat } from '@/games/pictionary/model/pictionarySelectors';
import { pictionaryDrawingDraftStore } from '@/games/pictionary/services/PictionaryDrawingDraftStore';
import { uploadPictionaryDrawing } from '@/games/pictionary/services/pictionaryMediaApi';
import { createPictionaryTaskDraftScope } from '@/games/pictionary/services/pictionaryTaskDraftScope';
import { pictionaryTextDraftStore } from '@/games/pictionary/services/PictionaryTextDraftStore';
import { renderPictionaryDrawing } from '@/games/pictionary/services/renderPictionaryDrawing';
import { CloudflareHttpError, CloudflareResponseJsonError } from '@/services/cloudflare/cfFetch';
import { calculateBackoff } from '@/services/connection/backoff';
import { handleError } from '@/utils/errorPipeline';
import { isAbortError, isNetworkError } from '@/utils/errorUtils';
import { roomScreenLog } from '@/utils/logger';

export type PictionaryDraftFinalizationStatus =
  | 'idle'
  | 'submitting'
  | 'retrying'
  | 'waiting'
  | 'failed';

interface PictionaryDraftFinalizer {
  readonly status: PictionaryDraftFinalizationStatus;
  readonly retry: () => void;
}

interface LocallyOwnedTask {
  readonly seat: number;
  readonly controlledSeat: number | null;
  readonly task: PictionaryTask;
}

/** Delivery is unresolved; RoomSession retains the exact command for recovery. */
class PictionaryDeliveryPendingError extends Error {}

function isRetryableDeliveryError(error: unknown): boolean {
  return (
    error instanceof PictionaryDeliveryPendingError ||
    isNetworkError(error) ||
    isAbortError(error) ||
    (error instanceof CloudflareResponseJsonError && error.phase === 'body-read') ||
    (error instanceof CloudflareHttpError &&
      (error.status === 408 || error.status === 429 || error.status >= 500))
  );
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
    const isControlledBot = isHost && isPictionaryImplicitBotSeat(state, seat);
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

async function submitTextDraft(
  state: PictionaryState,
  ownedTask: LocallyOwnedTask,
  userId: string,
  session: PictionaryRoomSession,
): Promise<void> {
  const scope = createPictionaryTaskDraftScope(state, ownedTask.task, userId);
  const text = pictionaryTextDraftStore.read(scope);
  if (text === null || !isValidPictionaryText(text)) {
    throw new Error('Pictionary text draft cannot be submitted; local content is retained');
  }
  const result = await session.dispatch(
    { type: 'pictionary.text.submit', text },
    { controlledSeat: ownedTask.controlledSeat, label: '发送最终文字', isRecoverable: true },
  );
  if (result.kind !== 'decided') throw new PictionaryDeliveryPendingError(result.reason);
  if (!isSuccessfulRoomCommand(result)) {
    throw new Error(`Final Pictionary text was rejected: ${getRoomCommandFailureReason(result)}`);
  }
  pictionaryTextDraftStore.clear(scope);
}

async function reserveDrawing(
  state: PictionaryState,
  ownedTask: LocallyOwnedTask,
  session: PictionaryRoomSession,
): Promise<PictionaryDrawingReservation> {
  const existingReservation = findDrawingReservation(state, ownedTask.seat);
  if (existingReservation !== null) return existingReservation;
  const result = await session.dispatch(
    { type: 'pictionary.drawing.reserve' },
    { controlledSeat: ownedTask.controlledSeat, label: '预留最终画作', isRecoverable: true },
  );
  if (result.kind !== 'decided') throw new PictionaryDeliveryPendingError(result.reason);
  if (!isSuccessfulRoomCommand(result)) {
    throw new Error(
      `Final Pictionary drawing reservation was rejected: ${getRoomCommandFailureReason(result)}`,
    );
  }
  const reservation = findDrawingReservation(result.decision.snapshot.state, ownedTask.seat);
  if (reservation === null) {
    throw new Error('[FAIL-FAST] Successful final drawing reservation is missing from snapshot');
  }
  return reservation;
}

async function submitDrawingDraft(
  state: PictionaryState,
  ownedTask: LocallyOwnedTask,
  userId: string,
  session: PictionaryRoomSession,
  signal: AbortSignal,
): Promise<void> {
  const scope = createPictionaryTaskDraftScope(state, ownedTask.task, userId);
  const draft = pictionaryDrawingDraftStore.read(scope);
  if (draft === null || draft.elements.length === 0) {
    throw new Error('Pictionary drawing draft cannot be submitted; local content is retained');
  }
  const png = renderPictionaryDrawing(draft.elements);
  const reservation = await reserveDrawing(state, ownedTask, session);
  signal.throwIfAborted();
  const result = await uploadPictionaryDrawing(
    state.roomCode,
    reservation.submissionId,
    png,
    ownedTask.controlledSeat,
    signal,
  );
  if (result.kind !== 'committed' || result.outcome.kind !== 'success') {
    throw new Error('Server rejected the final Pictionary drawing');
  }
  pictionaryDrawingDraftStore.clear(scope);
}

async function submitOwnedTask(
  state: PictionaryState,
  ownedTask: LocallyOwnedTask,
  userId: string,
  session: PictionaryRoomSession,
  signal: AbortSignal,
): Promise<void> {
  if (ownedTask.task.expectedKind === 'text') {
    await submitTextDraft(state, ownedTask, userId, session);
    return;
  }
  await submitDrawingDraft(state, ownedTask, userId, session, signal);
}

async function submitAllLocalDrafts(
  state: PictionaryState,
  userId: string,
  session: PictionaryRoomSession,
  signal: AbortSignal,
): Promise<void> {
  const failures = await Promise.all(
    getLocallyOwnedTasks(state, userId).map(async (ownedTask): Promise<Error | null> => {
      try {
        const scope = createPictionaryTaskDraftScope(state, ownedTask.task, userId);
        const isEmpty =
          ownedTask.task.expectedKind === 'text'
            ? (pictionaryTextDraftStore.read(scope)?.length ?? 0) === 0
            : (pictionaryDrawingDraftStore.read(scope)?.elements.length ?? 0) === 0;
        if (isEmpty) {
          const result = await session.dispatch(
            { type: 'pictionary.task.empty.submit' },
            { controlledSeat: ownedTask.controlledSeat, label: '提交空白', isRecoverable: true },
          );
          if (result.kind !== 'decided') throw new PictionaryDeliveryPendingError(result.reason);
          if (!isSuccessfulRoomCommand(result)) {
            throw new Error(
              `Empty Pictionary task was rejected: ${getRoomCommandFailureReason(result)}`,
            );
          }
          return null;
        }
        await submitOwnedTask(state, ownedTask, userId, session, signal);
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
export function usePictionaryDraftFinalizer(
  state: PictionaryState,
  userId: string,
  session: PictionaryRoomSession,
): PictionaryDraftFinalizer {
  const [status, setStatus] = useState<PictionaryDraftFinalizationStatus>('idle');
  const [attempt, setAttempt] = useState(0);
  const collectionKey = collectionKeyFor(state);
  const submitCurrentDrafts = useEffectEvent(
    async (current: PictionaryState, signal: AbortSignal): Promise<void> => {
      return submitAllLocalDrafts(current, userId, session, signal);
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
    const pendingTasks = getLocallyOwnedTasks(initial.snapshot.state, userId);
    const reconcile = (): boolean => {
      const current = session.getSnapshot();
      if (current.phase !== 'ready') return false;
      const latest = current.snapshot.state;
      const unresolved = pendingTasks.filter(({ task }) => {
        const entry = latest.chains.find((chain) => chain.id === task.chain.id)?.entries[
          initial.snapshot.state.stepIndex
        ];
        if (latest.roundId !== initial.snapshot.state.roundId || entry === undefined) return true;
        const scope = createPictionaryTaskDraftScope(initial.snapshot.state, task, userId);
        if (entry.kind === 'text') pictionaryTextDraftStore.clear(scope);
        if (entry.kind === 'drawing') pictionaryDrawingDraftStore.clear(scope);
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
        current.connection !== 'live' ||
        current.pendingCommandCount > 0
      ) {
        setStatus('retrying');
        return;
      }
      if (collectionKeyFor(current.snapshot.state) !== collectionKey) return;
      isSubmitting = true;
      setStatus(retryCount === 0 ? 'submitting' : 'retrying');
      try {
        await submitCurrentDrafts(current.snapshot.state, controller.signal);
        if (!controller.signal.aborted) setStatus('waiting');
      } catch (error: unknown) {
        if (controller.signal.aborted) return;
        if (reconcile()) {
          setStatus('waiting');
        } else if (isRetryableDeliveryError(error)) {
          roomScreenLog.warn('Pictionary draft delivery pending; retry scheduled', { error });
          setStatus('retrying');
          timer = setTimeout(() => {
            void run();
          }, calculateBackoff(retryCount));
          retryCount += 1;
        } else {
          hasTerminalFailure = true;
          setStatus('failed');
          handleError(error, {
            label: '发送最终内容',
            logger: roomScreenLog,
            alertMessage: '最终内容发送失败，草稿仍保留在本机，请重试。',
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
        current.connection === 'live' &&
        (previous.connection !== 'live' ||
          (previous.pendingCommandCount > 0 && current.pendingCommandCount === 0));
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

  const retry = useCallback(() => setAttempt((current) => current + 1), []);
  return { status, retry };
}
