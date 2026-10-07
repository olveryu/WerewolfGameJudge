/** Automatically submit current-page text through the platform's recoverable command queue. */

import {
  getStoryRelayTaskForSeat,
  STORY_RELAY_TEXT_MAX_LENGTH,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';
import { useEffect, useState } from 'react';

import {
  getRoomCommandFailureReason,
  isSuccessfulRoomCommand,
} from '@/features/room/session/roomCommandResult';
import {
  getStoryRelayUserSeat,
  type StoryRelayRoomSession,
} from '@/games/storyrelay/model/StoryRelayRoomSession';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

export type StoryRelayFinalizationStatus =
  | 'idle'
  | 'submitting'
  | 'retrying'
  | 'waiting'
  | 'failed';

function getStoryRelayOwnedTasks(state: StoryRelayState, userId: string) {
  const mySeat = getStoryRelayUserSeat(state, userId);
  const seats = [
    ...(mySeat === null ? [] : [mySeat]),
    ...(state.hostUserId === userId ? state.botSeats : []),
  ];
  return seats.map((seat) => {
    const task = getStoryRelayTaskForSeat(state, seat);
    if (task === null) throw new Error('Story Relay active task missing');
    return task;
  });
}

/** Collect all owned seats, including empty inputs, without persisting editable content. */
export function useStoryRelayAutoSubmission(
  state: StoryRelayState,
  userId: string,
  session: StoryRelayRoomSession,
  inputs: ReadonlyMap<number, string>,
) {
  const [status, setStatus] = useState<StoryRelayFinalizationStatus>('idle');
  const [attempt, setAttempt] = useState(0);
  const roundId = state.roundId;
  const stepIndex = state.stepIndex;
  const phase = state.phase;
  useEffect(() => {
    const initial = session.getSnapshot();
    if (initial.phase !== 'ready') return;
    if (phase === 'answering') {
      setStatus('idle');
      return;
    }
    if (phase !== 'settling') {
      setStatus('idle');
      return;
    }
    let isMounted = true;
    let isRunning = false;
    let hasFailure = false;
    const run = async () => {
      if (!isMounted || isRunning || hasFailure) return;
      const current = session.getSnapshot();
      if (current.phase !== 'ready') return;
      if (current.connection !== 'live' || current.pendingCommandCount > 0) {
        setStatus('retrying');
        return;
      }
      if (
        current.snapshot.state.roundId !== roundId ||
        current.snapshot.state.stepIndex !== stepIndex ||
        current.snapshot.state.phase !== 'settling'
      )
        return;
      isRunning = true;
      setStatus('submitting');
      try {
        const mySeat = getStoryRelayUserSeat(current.snapshot.state, userId);
        let hasInvalidInputs = false;
        for (const task of getStoryRelayOwnedTasks(current.snapshot.state, userId)) {
          if (task.isSubmitted) continue;
          const text = inputs.get(task.authorSeat) ?? '';
          if (text.length > STORY_RELAY_TEXT_MAX_LENGTH) {
            hasInvalidInputs = true;
            continue;
          }
          const identity = {
            roundId: task.roundId,
            stepIndex: task.stepIndex,
            chainId: task.chainId,
          };
          const result = await session.dispatch(
            text.trim().length === 0
              ? { type: 'storyrelay.task.empty.submit', ...identity }
              : { type: 'storyrelay.text.submit', ...identity, text },
            {
              controlledSeat: task.authorSeat === mySeat ? null : task.authorSeat,
              label: '提交故事稿件',
              isRecoverable: true,
            },
          );
          if (!isMounted) return;
          if (result.kind !== 'decided') {
            setStatus('retrying');
            return;
          }
          if (!isSuccessfulRoomCommand(result)) {
            const latest = session.getSnapshot();
            if (latest.phase === 'ready') {
              if (
                latest.snapshot.state.chains.find((chain) => chain.id === task.chainId)?.entries[
                  task.stepIndex
                ] !== undefined
              )
                continue;
            }
            throw new Error(getRoomCommandFailureReason(result));
          }
        }
        if (hasInvalidInputs) throw new Error('正文超过 512 字符');
        if (isMounted) setStatus('waiting');
      } catch (error: unknown) {
        if (isMounted) {
          hasFailure = true;
          setStatus('failed');
          handleError(error, {
            label: '提交故事稿件',
            logger: roomScreenLog,
            alertMessage: '收稿失败，请重试',
          });
        }
      } finally {
        isRunning = false;
      }
    };
    const unsubscribe = session.subscribe(() => {
      void run();
    });
    void run();
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [attempt, phase, roundId, session, stepIndex, userId, inputs]);
  return { status, retry: () => setAttempt((current) => current + 1) };
}
