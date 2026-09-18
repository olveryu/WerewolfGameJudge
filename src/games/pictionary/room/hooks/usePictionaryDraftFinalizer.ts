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
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

export type PictionaryDraftFinalizationStatus =
  | 'idle'
  | 'submitting'
  | 'waiting'
  | 'failed'
  | 'empty';

interface PictionaryDraftFinalizer {
  readonly status: PictionaryDraftFinalizationStatus;
  readonly retry: () => void;
  readonly submitEmpty: () => void;
}

interface LocallyOwnedTask {
  readonly seat: number;
  readonly controlledSeat: number | null;
  readonly task: PictionaryTask;
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
    { controlledSeat: ownedTask.controlledSeat, label: '发送最终文字' },
  );
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
    { controlledSeat: ownedTask.controlledSeat, label: '预留最终画作' },
  );
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
): Promise<void> {
  const scope = createPictionaryTaskDraftScope(state, ownedTask.task, userId);
  const draft = pictionaryDrawingDraftStore.read(scope);
  if (draft === null || draft.elements.length === 0) {
    throw new Error('Pictionary drawing draft cannot be submitted; local content is retained');
  }
  const png = renderPictionaryDrawing(draft.elements);
  const reservation = await reserveDrawing(state, ownedTask, session);
  const result = await uploadPictionaryDrawing(
    state.roomCode,
    reservation.submissionId,
    png,
    ownedTask.controlledSeat,
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
): Promise<void> {
  if (ownedTask.task.expectedKind === 'text') {
    await submitTextDraft(state, ownedTask, userId, session);
    return;
  }
  await submitDrawingDraft(state, ownedTask, userId, session);
}

async function submitAllLocalDrafts(
  state: PictionaryState,
  userId: string,
  session: PictionaryRoomSession,
  shouldSubmitEmpty: boolean,
): Promise<boolean> {
  let hasEmptyTasks = false;
  const failures = await Promise.all(
    getLocallyOwnedTasks(state, userId).map(async (ownedTask): Promise<Error | null> => {
      try {
        const scope = createPictionaryTaskDraftScope(state, ownedTask.task, userId);
        const isEmpty =
          ownedTask.task.expectedKind === 'text'
            ? pictionaryTextDraftStore.read(scope) === null
            : (pictionaryDrawingDraftStore.read(scope)?.elements.length ?? 0) === 0;
        if (isEmpty) {
          if (!shouldSubmitEmpty) {
            hasEmptyTasks = true;
            return null;
          }
          const result = await session.dispatch(
            { type: 'pictionary.task.empty.submit' },
            { controlledSeat: ownedTask.controlledSeat, label: '提交空白' },
          );
          if (!isSuccessfulRoomCommand(result)) {
            throw new Error(
              `Empty Pictionary task was rejected: ${getRoomCommandFailureReason(result)}`,
            );
          }
          return null;
        }
        await submitOwnedTask(state, ownedTask, userId, session);
        return null;
      } catch (error: unknown) {
        return error instanceof Error ? error : new Error('Unknown Pictionary finalization error');
      }
    }),
  );
  const firstFailure = failures.find((error) => error !== null);
  if (firstFailure !== undefined && firstFailure !== null) throw firstFailure;
  return hasEmptyTasks;
}

/** Coordinate exactly one local finalization attempt per authoritative collection phase. */
export function usePictionaryDraftFinalizer(
  state: PictionaryState,
  userId: string,
  session: PictionaryRoomSession,
): PictionaryDraftFinalizer {
  const [status, setStatus] = useState<PictionaryDraftFinalizationStatus>('idle');
  const [attempt, setAttempt] = useState(0);
  const [shouldSubmitEmpty, setShouldSubmitEmpty] = useState(false);
  const collectionKey =
    state.phase === 'settling'
      ? `${state.roundId}:${state.stepIndex}:${state.phaseRevision}`
      : null;
  const submitCurrentDrafts = useEffectEvent(async (): Promise<boolean> => {
    return submitAllLocalDrafts(state, userId, session, shouldSubmitEmpty);
  });

  useEffect(() => {
    if (collectionKey === null) {
      setStatus('idle');
      setShouldSubmitEmpty(false);
      return;
    }
    let isCurrentAttempt = true;
    setStatus('submitting');
    void submitCurrentDrafts()
      .then((hasEmptyTasks) => {
        if (isCurrentAttempt) setStatus(hasEmptyTasks ? 'empty' : 'waiting');
      })
      .catch((error: unknown) => {
        if (!isCurrentAttempt) return;
        setStatus('failed');
        handleError(error, {
          label: '发送最终内容',
          logger: roomScreenLog,
          alertMessage: '最终内容发送失败，草稿仍保留在本机，请恢复连接后重试。',
        });
      });
    return () => {
      isCurrentAttempt = false;
    };
  }, [attempt, collectionKey]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);
  const submitEmpty = useCallback(() => {
    setShouldSubmitEmpty(true);
    setAttempt((current) => current + 1);
  }, []);
  return { status, retry, submitEmpty };
}
